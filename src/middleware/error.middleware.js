import logger from '../config/logger.js';
import { sendError } from '../utils/response.js';
import AppError from '../utils/appError.js';
// import { Joi } from 'joi';

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
  const isProd = process.env.NODE_ENV === 'production';

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Something went wrong';
  let code = err.code || 'INTERNAL_ERROR';
  let details;

  // Log the error
  logger.error(err.message, {
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    body: req.body,
  });

  // Handle Joi validation errors
  if (err.isJoi) {
    statusCode = 400; // Bad Request
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = err.details?.map((d) => ({
      field: Array.isArray(d.path) ? d.path.join('.') : d.path,
      message: d.message,
    }));
  }

  // Handle Mongoose Bad ObjectId
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = `Invalid ID: ${err.value}`;
  }

  // Handle Mongoose Duplicate Key
  if (err.code === 11000) {
    statusCode = 409; // Conflict
    code = 'DUPLICATE_KEY';
    const field = Object.keys(err.keyValue)[0];
    message = `Duplicate field value: ${field} must be unique.`;
  }

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'MODEL_VALIDATION_ERROR';
    if (err.errors) {
      details = Object.values(err.errors).map((val) => ({
        path: val.path,
        message: val.message,
      }));
      message = 'Validation failed';
    }
  }

  // Send production vs development error response
  if (isProd) {
    return sendError(res, statusCode, code, message, details);
  }

  // Development: send full error
  return res.status(statusCode).json({
    success: false,
    error: { code, message, details },
    stack: err.stack,
  });
};