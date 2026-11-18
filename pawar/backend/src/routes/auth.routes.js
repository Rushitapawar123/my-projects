const express = require('express');
const ctrl = require('../controllers/auth.controller');
const v = require('../validators/auth.validator');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { loginLimiter, signupLimiter, passwordResetLimiter } = require('../middlewares/rateLimiters');

const router = express.Router();

// Auth responses contain tokens: never cache them
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.post('/register', signupLimiter, validate({ body: v.register }), ctrl.register);
router.post('/login', loginLimiter, validate({ body: v.login }), ctrl.login);
router.post('/2fa/verify', loginLimiter, validate({ body: v.verifyTwoFactor }), ctrl.verifyTwoFactorLogin);

router.post('/refresh', validate({ body: v.refresh }), ctrl.refresh);
router.post('/logout', ctrl.logout); // works even when the access token has expired
router.post('/logout-all', authenticate, ctrl.logoutAll);

router.get('/me', authenticate, ctrl.me);
router.get('/username-available', validate({ query: v.usernameAvailable }), ctrl.usernameAvailable);

router.post('/forgot-password', passwordResetLimiter, validate({ body: v.forgotPassword }), ctrl.forgotPassword);
router.post('/reset-password', passwordResetLimiter, validate({ body: v.resetPassword }), ctrl.resetPassword);
router.post('/change-password', authenticate, validate({ body: v.changePassword }), ctrl.changePassword);

router.post('/2fa/setup', authenticate, ctrl.twoFactorSetup);
router.post('/2fa/enable', authenticate, validate({ body: v.enableTwoFactor }), ctrl.twoFactorEnable);
router.post('/2fa/disable', authenticate, validate({ body: v.disableTwoFactor }), ctrl.twoFactorDisable);

module.exports = router;
