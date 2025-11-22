export const sendSuccess = (res, statusCode = 200, data = null, message = null) => {
  const payload = { success: true };
  if (message) payload.message = message;
  if (data !== null) payload.data = data;
  return res.status(statusCode).json(payload);
};

export const sendError = (res, statusCode = 500, code = 'INTERNAL_ERROR', message = 'Something went wrong', details = null) => {
  const payload = { success: false, error: { code, message } };
  if (details) payload.error.details = details;
  return res.status(statusCode).json(payload);
};