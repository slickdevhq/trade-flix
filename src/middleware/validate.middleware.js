/**
 * Validate request data (body, query, or params) against Joi schema
 * Supports both:
 * 1. Direct Joi schema (old style) ✅
 * 2. Object with body/query/params (new style) ✅
 */
export const validate = (schema, property = 'body') => (req, res, next) => {
  try {
    // If schema has validate method → old style
    if (typeof schema.validate === 'function') {
      const { error, value } = schema.validate(req[property], {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        error.isJoi = true;
        return next(error);
      }

      req[property] = value;
      return next();
    }

    // If schema is object with body/query/params → new style
    const props = ['body', 'query', 'params'];
    for (const prop of props) {
      if (schema[prop]) {
        const { error, value } = schema[prop].validate(req[prop], {
          abortEarly: false,
          stripUnknown: true,
        });

        if (error) {
          error.isJoi = true;
          return next(error);
        }

        req[prop] = value;
      }
    }

    next();
  } catch (err) {
    next(err);
  }
};
