const rateLimit = require('express-rate-limit');
const env = require('../config/env');

// In development limits are 10x higher so testing does not lock you out.
const build = (windowMs, limit, message, extra = {}) =>
  rateLimit({
    windowMs,
    limit: env.isProd ? limit : limit * 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message },
    ...extra,
  });

const minutes = (n) => n * 60 * 1000;

module.exports = {
  globalLimiter: build(minutes(15), 600, 'Too many requests, please try again later'),
  // Only failed attempts count towards the login limit
  loginLimiter: build(minutes(15), 10, 'Too many login attempts, please try again later', {
    skipSuccessfulRequests: true,
  }),
  signupLimiter: build(minutes(60), 10, 'Too many signups from this IP, please try again later'),
  passwordResetLimiter: build(minutes(60), 5, 'Too many password reset requests, please try again later'),
  uploadLimiter: build(minutes(10), 30, 'Too many uploads, please slow down'),
  messageLimiter: build(minutes(1), 60, 'You are sending messages too fast'),
};
