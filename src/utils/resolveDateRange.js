/**
 * Enhanced Date Range Resolver
 * 
 * Resolves date range queries with sensible defaults and backward compatibility.
 * Handles three modes: all-time, explicit range, and preset ranges.
 * 
 * @param {Object} options - Query parameters
 * @param {string} [options.startDate] - ISO date string (e.g., "2024-01-01")
 * @param {string} [options.endDate] - ISO date string (e.g., "2024-01-31")
 * @param {string} [options.range] - Preset range: "all" | "month" | "30days" | "90days" | "year"
 * @returns {Object} { startDate: Date|null, endDate: Date|null }
 */
export function resolveDateRange({ startDate, endDate, range } = {}) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Normalize to start of day

  // ==========================================
  // MODE 1: All-time (no date filtering)
  // ==========================================
  if (range === 'all') {
    return { 
      startDate: null, 
      endDate: null 
    };
  }

  // ==========================================
  // MODE 2: Explicit custom range
  // ==========================================
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Validation: Ensure dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format. Use ISO date strings (YYYY-MM-DD).');
    }
    
    // Validation: Ensure logical order
    if (end < start) {
      throw new Error('endDate must be after or equal to startDate.');
    }
    
    return {
      startDate: start,
      endDate: end
    };
  }

  // ==========================================
  // MODE 3: Preset ranges
  // ==========================================
  
  // Current month (EXISTING DEFAULT - BACKWARD COMPATIBLE)
  if (!range || range === 'month') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    return {
      startDate: firstDay,
      endDate: lastDay
    };
  }

  // Last 30 days
  if (range === '30days') {
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return {
      startDate: thirtyDaysAgo,
      endDate: today
    };
  }

  // Last 90 days
  if (range === '90days') {
    const ninetyDaysAgo = new Date(today);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    return {
      startDate: ninetyDaysAgo,
      endDate: today
    };
  }

  // Year-to-date
  if (range === 'year' || range === 'ytd') {
    const firstDayOfYear = new Date(now.getFullYear(), 0, 1);
    
    return {
      startDate: firstDayOfYear,
      endDate: today
    };
  }

  // Last year (complete)
  if (range === 'lastyear') {
    const lastYear = now.getFullYear() - 1;
    const firstDayLastYear = new Date(lastYear, 0, 1);
    const lastDayLastYear = new Date(lastYear, 11, 31);
    
    return {
      startDate: firstDayLastYear,
      endDate: lastDayLastYear
    };
  }

  // Last month (complete)
  if (range === 'lastmonth') {
    const lastMonth = now.getMonth() - 1;
    const yearForLastMonth = lastMonth < 0 ? now.getFullYear() - 1 : now.getFullYear();
    const monthForLastMonth = lastMonth < 0 ? 11 : lastMonth;
    
    const firstDayLastMonth = new Date(yearForLastMonth, monthForLastMonth, 1);
    const lastDayLastMonth = new Date(yearForLastMonth, monthForLastMonth + 1, 0);
    
    return {
      startDate: firstDayLastMonth,
      endDate: lastDayLastMonth
    };
  }

  // ==========================================
  // FALLBACK: Current month (SAFE DEFAULT)
  // ==========================================
  // This ensures we never return undefined dates
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  return {
    startDate: firstDay,
    endDate: lastDay
  };
}

/**
 * Helper: Format date range for display
 * 
 * @param {Date|null} startDate 
 * @param {Date|null} endDate 
 * @returns {string} Human-readable date range
 */
export function formatDateRange(startDate, endDate) {
  if (!startDate && !endDate) {
    return 'All Time';
  }
  
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  const start = startDate ? startDate.toLocaleDateString('en-US', options) : 'Beginning';
  const end = endDate ? endDate.toLocaleDateString('en-US', options) : 'Now';
  
  return `${start} – ${end}`;
}

/**
 * Helper: Calculate period length in days
 * Safe for null dates (all-time returns 0)
 * 
 * @param {Date|null} startDate 
 * @param {Date|null} endDate 
 * @returns {number} Number of days in period
 */
export function getPeriodLengthInDays(startDate, endDate) {
  if (!startDate || !endDate) {
    return 0; // All-time has no defined length
  }
  
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((endDate - startDate) / millisecondsPerDay) + 1; // +1 to include both start and end
}

/**
 * Helper: Get previous period for comparison
 * Used for period-over-period analytics
 * 
 * @param {Date|null} startDate 
 * @param {Date|null} endDate 
 * @returns {Object} { startDate: Date|null, endDate: Date|null }
 */
export function getPreviousPeriod(startDate, endDate) {
  // Can't calculate previous period for all-time
  if (!startDate || !endDate) {
    return { startDate: null, endDate: null };
  }
  
  const periodLength = getPeriodLengthInDays(startDate, endDate);
  
  const prevEnd = new Date(startDate);
  prevEnd.setDate(prevEnd.getDate() - 1); // Day before current period starts
  
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - periodLength + 1);
  
  return {
    startDate: prevStart,
    endDate: prevEnd
  };
}

/**
 * Helper: Validate if date is in valid range
 * 
 * @param {Date} date 
 * @returns {boolean}
 */
export function isValidDate(date) {
  return date instanceof Date && !isNaN(date.getTime());
}