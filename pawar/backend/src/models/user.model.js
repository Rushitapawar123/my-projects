const { pool } = require('../config/db');

// "client" is optional: pass a transaction client to run inside a transaction.
const exec = (client, text, params) => (client || pool).query(text, params);

const findById = async (id) => {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
};

// email and username columns are CITEXT, so matching is case-insensitive
const findByIdentifier = async (identifier) => {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1 OR username = $1 LIMIT 1', [identifier]);
  return rows[0] || null;
};

const findByEmail = async (email) => {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] || null;
};

const existsByEmail = async (email) => {
  const { rowCount } = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
  return rowCount > 0;
};

const existsByUsername = async (username) => {
  const { rowCount } = await pool.query('SELECT 1 FROM users WHERE username = $1', [username]);
  return rowCount > 0;
};

const create = async (client, { email, username, passwordHash, fullName }) => {
  const { rows } = await exec(
    client,
    `INSERT INTO users (email, username, password_hash, full_name)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [email, username, passwordHash, fullName]
  );
  return rows[0];
};

const createSettings = (client, userId) =>
  exec(client, 'INSERT INTO user_settings (user_id) VALUES ($1)', [userId]);

const touchLogin = (id) => pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [id]);

const setStatus = (id, status) => pool.query('UPDATE users SET status = $2 WHERE id = $1', [id, status]);

const updatePassword = (client, id, passwordHash) =>
  exec(client, 'UPDATE users SET password_hash = $2 WHERE id = $1', [id, passwordHash]);

const setTwoFactorSecret = (id, encryptedSecret) =>
  pool.query('UPDATE users SET two_factor_secret = $2 WHERE id = $1', [id, encryptedSecret]);

const enableTwoFactor = (client, id) =>
  exec(client, 'UPDATE users SET two_factor_enabled = TRUE WHERE id = $1', [id]);

const disableTwoFactor = (client, id) =>
  exec(client, 'UPDATE users SET two_factor_enabled = FALSE, two_factor_secret = NULL WHERE id = $1', [id]);

module.exports = {
  findById,
  findByIdentifier,
  findByEmail,
  existsByEmail,
  existsByUsername,
  create,
  createSettings,
  touchLogin,
  setStatus,
  updatePassword,
  setTwoFactorSecret,
  enableTwoFactor,
  disableTwoFactor,
};
