/**
 * Creates a middleware function to validate request body against a Joi schema.
 * @param {import('joi').Schema} schema - The Joi schema to validate against
 */
export const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, {
    abortEarly: false, // Return all errors
    stripUnknown: true, // Remove unknown properties
  });

  if (error) {
    // Pass the Joi error to the global error handler
    error.isJoi = true;
    return next(error);
  }

  next();
};