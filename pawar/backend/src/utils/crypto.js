const crypto = require('crypto');
const env = require('../config/env');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

// URL-safe random token (used for refresh and password reset tokens)
const randomToken = (bytes = 48) => crypto.randomBytes(bytes).toString('base64url');

let cachedKey;
const getKey = () => {
  if (cachedKey) return cachedKey;
  cachedKey = env.TWO_FACTOR_ENCRYPTION_KEY
    ? Buffer.from(env.TWO_FACTOR_ENCRYPTION_KEY, 'hex')
    : crypto.scryptSync(env.JWT_REFRESH_SECRET, 'pawar-2fa-key', 32); // development fallback
  return cachedKey;
};

// AES-256-GCM for secrets stored at rest. Format: iv:tag:ciphertext (hex)
const encrypt = (plain) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString('hex')).join(':');
};

const decrypt = (payload) => {
  const [ivHex, tagHex, encHex] = payload.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8');
};

module.exports = { sha256, randomToken, encrypt, decrypt };
