/**
 * Wraps an async function to catch errors and pass them to the next middleware.
 * This eliminates the need for try/catch blocks in every controller.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};