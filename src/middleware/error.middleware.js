import logger from '../config/logger.js';
import { sendError } from '../utils/response.js';
import AppError from '../utils/appError.js';

/**
 * 404 Not Found Handler
 */
export const notFoundHandler = (req, res, next) => {
  return sendError(
    res,
    404,
    'NOT_FOUND',
    `Route not found: ${req.method} ${req.originalUrl}`
  );
};

/**
 * Global Error Handler
 */
export const globalErrorHandler = (err, req, res, next) => {
  // 1. Log the RAW error internally (Critical for debugging)
  // We log this BEFORE sanitizing so you (the dev) see the real issue in your server logs
  logger.error(err.message, {
    name: err.name,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    body: req.body,
  });

  // 2. Default variable initialization
  let statusCode = err.statusCode || 500;
  let message = err.message; 
  let code = err.code || 'INTERNAL_ERROR';
  let details = err.details || null;
  
  // Flag to determine if the error is "Trusted" (Safe to show client)
  let isTrustedError = false;

  // ---------------------------------------------------
  // PHASE 1: IDENTIFY TRUSTED ERRORS
  // ---------------------------------------------------

  // Case A: AppError (You threw this manually)
  if (err instanceof AppError) {
    isTrustedError = true;
  }

  // Case B: Joi Validation (Trusted)
  else if (err.isJoi) {
    isTrustedError = true;
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = err.details?.map((d) => ({
      field: Array.isArray(d.path) ? d.path.join('.') : d.path,
      message: d.message,
    }));
  }

  // Case C: Mongoose Bad ObjectId (Trusted)
  else if (err.name === 'CastError' && err.kind === 'ObjectId') {
    isTrustedError = true;
    statusCode = 400;
    code = 'INVALID_ID';
    message = 'Resource not found (Invalid ID)';
  }

  // Case D: Mongoose Duplicate Key (Trusted)
  else if (err.code === 11000) {
    isTrustedError = true;
    statusCode = 409;
    code = 'DUPLICATE_KEY';
    const field = err.keyValue ? Object.keys(err.keyValue)[0] : 'field';
    message = `Duplicate value for ${field}. Please use another value.`;
  }

  // Case E: Mongoose Validation Error (Trusted)
  else if (err.name === 'ValidationError') {
    isTrustedError = true;
    statusCode = 400;
    code = 'MODEL_VALIDATION_ERROR';
    message = 'Validation failed';
    if (err.errors) {
      details = Object.values(err.errors).map((val) => ({
        path: val.path,
        message: val.message,
      }));
    }
  }

  // Case F: JWT Errors (Trusted) - e.g. from passport/jsonwebtoken
  else if (err.name === 'JsonWebTokenError') {
    isTrustedError = true;
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid token. Please log in again.';
  }
  else if (err.name === 'TokenExpiredError') {
    isTrustedError = true;
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Your token has expired. Please log in again.';
  }

  // ---------------------------------------------------
  // PHASE 2: SANITIZE UNTRUSTED ERRORS (THE SAFETY NET)
  // ---------------------------------------------------
  
  // If the error was NOT matched above, it is a System Error (Untrusted).
  if (!isTrustedError) {
    // Force status to 500 if it's weird or undefined
    statusCode = 500; 
    code = 'INTERNAL_ERROR';

    // In PRODUCTION, we wipe the message.
    if (process.env.NODE_ENV === 'production') {
      message = 'Something went wrong. Please try again later.';
      details = null; // Ensure no stack trace or details leak
    } else {
      // In DEVELOPMENT, we show the message for debugging
      message = `[DEV ONLY] ${err.message}`; 
    }
  }

  return sendError(res, statusCode, code, message, details);
};