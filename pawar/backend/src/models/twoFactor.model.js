const { pool } = require('../config/db');

const exec = (client, text, params) => (client || pool).query(text, params);

const replaceBackupCodes = async (client, userId, codeHashes) => {
  await exec(client, 'DELETE FROM two_factor_backup_codes WHERE user_id = $1', [userId]);
  await exec(
    client,
    'INSERT INTO two_factor_backup_codes (user_id, code_hash) SELECT $1, UNNEST($2::text[])',
    [userId, codeHashes]
  );
};

const deleteBackupCodes = (client, userId) =>
  exec(client, 'DELETE FROM two_factor_backup_codes WHERE user_id = $1', [userId]);

// Each backup code works once
const consumeBackupCode = async (userId, codeHash) => {
  const { rowCount } = await pool.query(
    'UPDATE two_factor_backup_codes SET used_at = NOW() WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL',
    [userId, codeHash]
  );
  return rowCount === 1;
};

module.exports = { replaceBackupCodes, deleteBackupCodes, consumeBackupCode };
