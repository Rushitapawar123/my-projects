const { pool } = require('../config/db');

const exec = (client, text, params) => (client || pool).query(text, params);

// ------------------------------------------------ refresh tokens (only hashes are stored)
const insertRefreshToken = ({ userId, tokenHash, userAgent, ip, expiresAt }) =>
  pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, tokenHash, userAgent || null, ip || null, expiresAt]
  );

const findRefreshTokenByHash = async (tokenHash) => {
  const { rows } = await pool.query('SELECT * FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
  return rows[0] || null;
};

// Returns true only for the one caller that actually revoked it (makes rotation atomic)
const revokeRefreshToken = async (id) => {
  const { rowCount } = await pool.query(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL',
    [id]
  );
  return rowCount === 1;
};

const revokeRefreshTokenByHash = (tokenHash) =>
  pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL', [tokenHash]);

const revokeAllRefreshTokens = (userId, client) =>
  exec(client, 'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);

// ------------------------------------------------ password reset tokens
const invalidateResetTokens = (client, userId) =>
  exec(client, 'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [userId]);

const insertResetToken = (client, { userId, tokenHash, expiresAt }) =>
  exec(
    client,
    'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, tokenHash, expiresAt]
  );

// Single atomic statement: a reset token can be used exactly once
const consumeResetToken = async (client, tokenHash) => {
  const { rows } = await exec(
    client,
    `UPDATE password_reset_tokens SET used_at = NOW()
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
     RETURNING user_id`,
    [tokenHash]
  );
  return rows[0] || null;
};

// Revoked refresh tokens are kept until they would have expired (needed for reuse detection)
const deleteExpiredTokens = async () => {
  const a = await pool.query('DELETE FROM refresh_tokens WHERE expires_at < NOW()');
  const b = await pool.query("DELETE FROM password_reset_tokens WHERE expires_at < NOW() - INTERVAL '1 day'");
  return a.rowCount + b.rowCount;
};

module.exports = {
  insertRefreshToken,
  findRefreshTokenByHash,
  revokeRefreshToken,
  revokeRefreshTokenByHash,
  revokeAllRefreshTokens,
  invalidateResetTokens,
  insertResetToken,
  consumeResetToken,
  deleteExpiredTokens,
};
