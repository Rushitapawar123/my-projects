const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { query } = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// Requires "Authorization: Bearer <accessToken>". Sets req.user = { id, role }.
const authenticate = asyncHandler(async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw ApiError.unauthorized('Authentication required');

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    throw ApiError.unauthorized(err.name === 'TokenExpiredError' ? 'Access token expired' : 'Invalid access token');
  }
  if (payload.type !== 'access') throw ApiError.unauthorized('Invalid access token');

  // Checked on every request so suspended users are locked out immediately
  const { rows } = await query('SELECT id, role, status FROM users WHERE id = $1', [payload.sub]);
  const user = rows[0];
  if (!user) throw ApiError.unauthorized('Invalid access token');
  if (user.status !== 'active') throw ApiError.forbidden('Account is not active');

  req.user = { id: user.id, role: user.role };
  next();
});

const requireAdmin = (req, res, next) =>
  req.user && req.user.role === 'admin' ? next() : next(ApiError.forbidden('Admin access required'));

module.exports = { authenticate, requireAdmin };
