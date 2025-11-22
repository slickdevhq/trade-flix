export default class AppError extends Error {
  constructor(statusCode, message, code = 'ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message = 'Bad request', code = 'BAD_REQUEST', details) {
    return new AppError(400, message, code, details);
  }

  static unauthorized(message = 'Not authorized', code = 'UNAUTHORIZED', details) {
    return new AppError(401, message, code, details);
  }

  static forbidden(message = 'Forbidden', code = 'FORBIDDEN', details) {
    return new AppError(403, message, code, details);
  }

  static notFound(message = 'Not found', code = 'NOT_FOUND', details) {
    return new AppError(404, message, code, details);
  }

  static conflict(message = 'Conflict', code = 'CONFLICT', details) {
    return new AppError(409, message, code, details);
  }

  static internal(message = 'Internal server error', code = 'INTERNAL_ERROR', details) {
    return new AppError(500, message, code, details);
  }
}