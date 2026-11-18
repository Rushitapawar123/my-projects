const tokenModel = require('../models/token.model');

const HOUR_MS = 60 * 60 * 1000;

// Deletes expired refresh and password reset tokens once an hour
const startJobs = () => {
  const run = async () => {
    try {
      const removed = await tokenModel.deleteExpiredTokens();
      if (removed > 0) console.log(`Cleanup: removed ${removed} expired tokens`);
    } catch (err) {
      console.error('Token cleanup failed:', err.message);
    }
  };
  run();
  setInterval(run, HOUR_MS).unref();
};

module.exports = { startJobs };
