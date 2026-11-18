const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { sha256, randomToken } = require('../utils/crypto');
const tokenModel = require('../models/token.model');

// A refresh token that was rotated a moment ago may still arrive from a parallel request.
// Inside this window we just reject it; outside it, reuse means the token may be stolen.
const REUSE_GRACE_MS = 10 * 1000;

const signAccessToken = (user) =>
  jwt.sign({ type: 'access', role: user.role }, env.JWT_ACCESS_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_ACCESS_EXPIRES,
    algorithm: 'HS256',
  });

// Short-lived token returned after a correct password when 2FA is enabled
const signTwoFactorToken = (userId) =>
  jwt.sign({ type: '2fa' }, env.JWT_ACCESS_SECRET, { subject: userId, expiresIn: '5m', algorithm: 'HS256' });

const verifyTwoFactorToken = (token) => {
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    throw ApiError.unauthorized('Two-factor session expired, please log in again');
  }
  if (payload.type !== '2fa') throw ApiError.unauthorized('Invalid two-factor session');
  return payload.sub;
};

const issueRefreshToken = async (userId, meta = {}) => {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
  await tokenModel.insertRefreshToken({
    userId,
    tokenHash: sha256(token),
    userAgent: (meta.userAgent || '').slice(0, 500),
    ip: meta.ip,
    expiresAt,
  });
  return { token, expiresAt };
};

// Validates the presented refresh token, revokes it and issues a new one (rotation)
const rotateRefreshToken = async (rawToken, meta) => {
  const row = await tokenModel.findRefreshTokenByHash(sha256(rawToken));
  if (!row) throw ApiError.unauthorized('Invalid refresh token');

  if (row.revoked_at) {
    const justRevoked = Date.now() - new Date(row.revoked_at).getTime() < REUSE_GRACE_MS;
    if (!justRevoked) await tokenModel.revokeAllRefreshTokens(row.user_id);
    throw ApiError.unauthorized('Session expired, please log in again');
  }
  if (new Date(row.expires_at) <= new Date()) {
    throw ApiError.unauthorized('Session expired, please log in again');
  }

  const revoked = await tokenModel.revokeRefreshToken(row.id);
  if (!revoked) throw ApiError.unauthorized('Session expired, please log in again');

  const next = await issueRefreshToken(row.user_id, meta);
  return { userId: row.user_id, ...next };
};

module.exports = {
  signAccessToken,
  signTwoFactorToken,
  verifyTwoFactorToken,
  issueRefreshToken,
  rotateRefreshToken,
};
