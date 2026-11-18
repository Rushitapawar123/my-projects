// Validates and sanitizes req.body / req.query / req.params with zod schemas.
// Usage: validate({ body: schema, query: schema })
const validate = (schemas) => (req, res, next) => {
  try {
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.query) req.query = schemas.query.parse(req.query);
    if (schemas.params) req.params = schemas.params.parse(req.params);
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = validate;
