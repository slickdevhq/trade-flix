import logger from '../config/logger.js';
// import { Joi } from 'joi';

/**
 * 404 Not Found Handler
 */
export const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

/**
 * Global Error Handler
 */
export const globalErrorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Something went wrong';

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
    message = err.details.map((d) => d.message).join(', ');
  }

  // Handle Mongoose Bad ObjectId
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 400;
    message = `Invalid ID: ${err.value}`;
  }

  // Handle Mongoose Duplicate Key
  if (err.code === 11000) {
    statusCode = 409; // Conflict
    const field = Object.keys(err.keyValue)[0];
    message = `Duplicate field value: ${field} must be unique.`;
  }

// --- START OF THE FIX ---

// Handle Mongoose Validation Error
 if (err.name === 'ValidationError') {
 statusCode = 400;
    
    // Check if err.errors exists before mapping over it
if (err.errors) {
message = Object.values(err.errors)
.map((val) => val.message)
 .join(', ');
} else {
      // If .errors doesn't exist, just use the main error message
      // This is the fallback that prevents the crash.
message = err.message;
}
 }

  // Send production vs development error response
  if (process.env.NODE_ENV === 'production') {
    res.status(statusCode).json({
      message,
    });
  } else {
    // Development: send full error
    res.status(statusCode).json({
      message,
      error: err,
      stack: err.stack,
    });
  }
};