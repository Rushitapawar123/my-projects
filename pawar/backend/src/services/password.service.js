const argon2 = require('argon2');

const hashPassword = (password) => argon2.hash(password, { type: argon2.argon2id });

const verifyPassword = async (hash, password) => {
  try {
    return await argon2.verify(hash, password);
  } catch (err) {
    return false;
  }
};

// Used when the account does not exist, so response time does not reveal which accounts exist
let dummyHash;
const dummyVerify = async (password) => {
  if (!dummyHash) dummyHash = await hashPassword('dummy-password-for-timing-only');
  await verifyPassword(dummyHash, password);
};

module.exports = { hashPassword, verifyPassword, dummyVerify };
