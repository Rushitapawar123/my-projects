const crypto = require('crypto');
const { authenticator } = require('otplib');
const { encrypt, decrypt, sha256 } = require('../utils/crypto');
const twoFactorModel = require('../models/twoFactor.model');

authenticator.options = { window: 1 }; // accept the previous and next 30s code (clock drift)

const ISSUER = 'Pawar';

const generateSecret = () => authenticator.generateSecret();
const encryptSecret = (secret) => encrypt(secret);
const buildOtpAuthUrl = (account, secret) => authenticator.keyuri(account, ISSUER, secret);

const verifyTotp = (code, encryptedSecret) => {
  try {
    return authenticator.check(code, decrypt(encryptedSecret));
  } catch (err) {
    return false;
  }
};

// 10 codes like "a1b2c-3d4e5"
const generateBackupCodes = (count = 10) =>
  Array.from({ length: count }, () => {
    const raw = crypto.randomBytes(5).toString('hex');
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });

const hashBackupCode = (code) => sha256(code.trim().toLowerCase());
const looksLikeBackupCode = (code) => /^[0-9a-f]{5}-[0-9a-f]{5}$/i.test(code.trim());

// Accepts either an authenticator code or an unused backup code
const verifyCode = async (user, code) => {
  const value = code.trim();
  if (/^\d{6}$/.test(value)) return verifyTotp(value, user.two_factor_secret);
  if (looksLikeBackupCode(value)) return twoFactorModel.consumeBackupCode(user.id, hashBackupCode(value));
  return false;
};

module.exports = {
  generateSecret,
  encryptSecret,
  buildOtpAuthUrl,
  verifyTotp,
  generateBackupCodes,
  hashBackupCode,
  verifyCode,
};
