import Trade from '../models/Trade.model.js';
import AppError from '../utils/appError.js';
import logger from '../config/logger.js';

/**
 * Parse uploaded buffer (CSV/TXT/XLSX) into trade documents.
 * @param {Buffer} buffer - file buffer
 * @param {string} mimetype - original mimetype
 * @param {string} originalname - original filename
 * @param {string} userId - authenticated user id
 * @returns {Promise<number>} count of imported trades
 */
export async function parseAndImportTrades(buffer, mimetype, originalname, userId) {
  const isCSV = /csv|text/.test(mimetype) || originalname.toLowerCase().endsWith('.csv') || originalname.toLowerCase().endsWith('.txt');
  const isXLSX = /sheet|excel/.test(mimetype) || originalname.toLowerCase().endsWith('.xlsx') || originalname.toLowerCase().endsWith('.xls');

  let rows = [];

  if (isCSV) {
    const { parse } = await import('csv-parse/sync');
    const str = buffer.toString('utf8');
    rows = parse(str, { columns: true, skip_empty_lines: true, trim: true });
  } else if (isXLSX) {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const wsname = wb.SheetNames[0];
    const ws = wb.Sheets[wsname];
    rows = XLSX.utils.sheet_to_json(ws, { raw: false, defval: '' });
  } else {
    throw AppError.badRequest('Unsupported file format', 'UNSUPPORTED_FORMAT');
  }

  const docs = [];
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2; // +2 because: index starts at 0, and row 1 is headers

    try {
      // === REQUIRED FIELDS ===
      
      // Symbol/Ticker
      const symbol = String(
        r.symbol || r.ticker || r.Symbol || r.Ticker || r.SYMBOL || r.TICKER || ''
      ).trim().toUpperCase();
      
      // Side/Direction
      const sideRaw = String(
        r.side || r.Side || r.SIDE || r.Type || r.type || r.Direction || r.direction || ''
      ).trim().toLowerCase();
      
      let side = 'long';
      if (sideRaw.includes('short') || sideRaw === 'sell' || sideRaw === 's' || sideRaw === 'put') {
        side = 'short';
      } else if (sideRaw.includes('long') || sideRaw === 'buy' || sideRaw === 'b' || sideRaw === 'call') {
        side = 'long';
      }
      
      // Entry Price
      const entryPrice = parsePrice(
        r.entry || r.Entry || r.ENTRY || r.entryPrice || r.EntryPrice || 
        r['Entry Price'] || r.Price || r.price || r.PRICE
      );
      
      // Size/Quantity
      const size = parseNumber(
        r.size || r.Size || r.SIZE || r.qty || r.Qty || r.QTY || 
        r.quantity || r.Quantity || r.QUANTITY || r.Shares || r.shares || 
        r.SHARES || r.contracts || r.Contracts
      );
      
      // Date/Time
      const dateStr = r.date || r.Date || r.DATE || r.Time || r.time || 
                      r.TIME || r.timestamp || r.Timestamp || r['Entry Time'] || 
                      r['Open Time'] || r.OpenTime;
      const date = dateStr ? parseDate(dateStr) : undefined;
      
      // Validate required fields
      if (!symbol) {
        errors.push(`Row ${rowNum}: Missing symbol/ticker`);
        continue;
      }
      if (!date || isNaN(date.getTime())) {
        errors.push(`Row ${rowNum}: Invalid or missing date for ${symbol}`);
        continue;
      }
      if (isNaN(entryPrice) || entryPrice <= 0) {
        errors.push(`Row ${rowNum}: Invalid entry price for ${symbol}`);
        continue;
      }
      if (isNaN(size) || size <= 0) {
        errors.push(`Row ${rowNum}: Invalid size/quantity for ${symbol}`);
        continue;
      }

      // === OPTIONAL PRICE FIELDS ===
      
      const exitPrice = parsePrice(
        r.exit || r.Exit || r.EXIT || r.exitPrice || r.ExitPrice || 
        r['Exit Price'] || r.Close || r.close
      );
      
      const stopLoss = parsePrice(
        r.stop || r.Stop || r.STOP || r.sl || r.SL || r.stopLoss || 
        r.StopLoss || r['Stop Loss'] || r.stoploss
      );
      
      const targetPrice = parsePrice(
        r.target || r.Target || r.TARGET || r.tp || r.TP || r.takeProfit || 
        r.TakeProfit || r['Take Profit'] || r.targetPrice || r.TargetPrice || 
        r['Target Price']
      );

      // === METADATA FIELDS ===
      
      const tagsRaw = r.tags || r.Tags || r.TAGS || r.labels || r.Labels || '';
      const tags = String(tagsRaw)
        .split(/[,;|]/) // Support multiple delimiters
        .map((t) => t.trim())
        .filter(Boolean);
      
      const notes = String(r.notes || r.Notes || r.NOTES || r.comments || 
                          r.Comments || r.description || r.Description || '').trim();
      
      const sentimentRaw = (r.sentiment || r.Sentiment || r.SENTIMENT || '').toLowerCase().trim();
      const sentiment = ['bullish', 'bearish', 'neutral'].includes(sentimentRaw) 
        ? sentimentRaw 
        : undefined;
      
      const impactRaw = (r.impact || r.Impact || r.IMPACT || r.newsImpact || 
                        r.NewsImpact || r['News Impact'] || '').toLowerCase().trim();
      const newsImpact = ['high', 'medium', 'low', 'none'].includes(impactRaw) 
        ? impactRaw 
        : undefined;

      const mistakesRaw = r.mistakes || r.Mistakes || r.MISTAKES || r.errors || 
                    r.Errors || r.lessons || r.Lessons || '';
      const validMistakes = ['late_exit', 'early_entry', 'position_sizing', 'stop_loss', 
                            'fomo', 'revenge_trading', 'overtrading', 'ignored_plan', 'emotional'];

      const mistakes = String(mistakesRaw)
        .split(/[,;|]/)
        .map(m => m.trim().toLowerCase().replace(/\s+/g, '_'))
        .filter(m => validMistakes.includes(m));
      
      // === CALCULATED FIELDS (PnL, R:R) ===
      // Only accept these if they're explicitly provided AND valid
      
      const pnlRaw = r.pnl || r.PnL || r.PNL || r['P&L'] || r['Profit/Loss'] || 
                     r.profit || r.Profit || r.pl || r.PL;
      const pnl = parseNumber(pnlRaw); // Can be negative
      
      const rrRaw = r.rr || r.RR || r['R:R'] || r['R/R'] || r.riskReward || 
                    r.RiskReward || r['Risk/Reward'] || r['Risk Reward'];
      const rr = parseNumber(rrRaw);

      // === BUILD PAYLOAD ===
      
      const payload = {
        user: userId,
        date,
        symbol,
        side,
        entryPrice,
        size,
      };

      // Add optional fields only if valid
      if (!isNaN(exitPrice) && exitPrice > 0) payload.exitPrice = exitPrice;
      if (!isNaN(stopLoss) && stopLoss > 0) payload.stopLoss = stopLoss;
      if (!isNaN(targetPrice) && targetPrice > 0) payload.targetPrice = targetPrice;
      
      if (notes) payload.notes = notes;
      if (tags.length > 0) payload.tags = tags;
      if (sentiment) payload.sentiment = sentiment;
      if (newsImpact) payload.newsImpact = newsImpact;
      if (mistakes.length > 0) payload.mistakes = mistakes;
      
      // === SMART PnL HANDLING ===
      // Only use imported PnL if:
      // 1. It's explicitly provided
      // 2. Exit price exists (closed trade)
      // 3. The imported PnL is reasonable given the trade parameters
      if (!isNaN(pnl) && payload.exitPrice) {
        // Validate that imported PnL is reasonable
        const calculatedPnL = side === 'long'
          ? (payload.exitPrice - entryPrice) * size
          : (entryPrice - payload.exitPrice) * size;
        
        const pnlDiff = Math.abs(pnl - calculatedPnL);
        const tolerance = Math.abs(calculatedPnL) * 0.05; // 5% tolerance for rounding/fees
        
        if (pnlDiff <= tolerance || pnlDiff <= 1) {
          // PnL matches calculated value (within tolerance), use imported
          payload.pnl = pnl;
        } else {
          // PnL doesn't match - log warning but let model recalculate
          logger.warn(`Row ${rowNum}: Imported PnL (${pnl}) doesn't match calculated (${calculatedPnL.toFixed(2)}) for ${symbol}, using calculated`);
        }
      }
      
      // === SMART R:R HANDLING ===
      // Only use imported R:R if:
      // 1. It's explicitly provided AND valid
      // 2. Target and stop are NOT provided (can't calculate our own)
      if (!isNaN(rr) && rr > 0) {
        if (!payload.targetPrice && !payload.stopLoss) {
          // No target/stop provided, trust imported R:R
          payload.rr = rr;
        } else if (payload.targetPrice && payload.stopLoss) {
          // Both target and stop exist - validate imported R:R
          const risk = Math.abs(entryPrice - payload.stopLoss);
          const reward = Math.abs(payload.targetPrice - entryPrice);
          const calculatedRR = risk > 0 ? reward / risk : 0;
          
          const rrDiff = Math.abs(rr - calculatedRR);
          if (rrDiff <= 0.1) {
            // Close enough, use imported
            payload.rr = rr;
          } else {
            // Mismatch - let model calculate from target/stop
            logger.warn(`Row ${rowNum}: Imported R:R (${rr}) doesn't match calculated (${calculatedRR.toFixed(2)}) for ${symbol}, using calculated`);
          }
        }
        // If only target OR only stop exists, let model calculate if possible
      }

      docs.push(payload);

    } catch (rowErr) {
      errors.push(`Row ${rowNum}: ${rowErr.message}`);
      logger.warn('Error parsing import row', { rowNum, error: rowErr.message });
    }
  }

  // Log all errors for user feedback
  if (errors.length > 0) {
    logger.info(`Import completed with ${errors.length} errors`, { errors: errors.slice(0, 10) });
  }

  if (!docs.length) {
    throw AppError.badRequest(
      `No valid trades found. Errors: ${errors.slice(0, 5).join('; ')}`,
      'EMPTY_IMPORT'
    );
  }

  // Insert trades - ordered: false allows partial success on duplicates
  try {
    const result = await Trade.insertMany(docs, { ordered: false });
    
    if (errors.length > 0) {
      logger.info(`Successfully imported ${result.length} trades, ${errors.length} rows skipped`);
    }
    
    return result.length;
  } catch (err) {
    // Handle duplicate key errors or validation errors
    if (err.writeErrors) {
      const successCount = docs.length - err.writeErrors.length;
      logger.warn(`Partial import: ${successCount} succeeded, ${err.writeErrors.length} failed`);
      return successCount;
    }
    throw err;
  }
}

// === HELPER FUNCTIONS ===

/**
 * Parse price value, handling various formats
 */
function parsePrice(value) {
  if (value === undefined || value === null || value === '') return NaN;
  
  // Remove common currency symbols and whitespace
  const cleaned = String(value)
    .replace(/[$€£¥,\s]/g, '')
    .trim();
  
  const num = Number(cleaned);
  return isNaN(num) || num < 0 ? NaN : num;
}

/**
 * Parse number value (can be negative for PnL)
 */
function parseNumber(value) {
  if (value === undefined || value === null || value === '') return NaN;
  
  const cleaned = String(value)
    .replace(/[$€£¥,\s]/g, '')
    .trim();
  
  return Number(cleaned);
}

/**
 * Parse date from various formats
 */
function parseDate(dateStr) {
  if (!dateStr) return undefined;
  
  // Try native Date parsing first
  let date = new Date(dateStr);
  
  // If invalid, try common formats
  if (isNaN(date.getTime())) {
    // Try MM/DD/YYYY or DD/MM/YYYY
    const parts = String(dateStr).split(/[\/\-\s]/);
    if (parts.length >= 3) {
      // Assume MM/DD/YYYY for US format
      date = new Date(parts[2], parts[0] - 1, parts[1]);
    }
  }
  
  return date;
}