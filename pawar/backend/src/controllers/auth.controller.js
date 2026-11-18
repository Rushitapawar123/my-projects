const env = require('../config/env');
const { withTransaction } = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { sha256, randomToken } = require('../utils/crypto');
const { toSelfUser } = require('../utils/serializers');
const { usernameSchema } = require('../validators/auth.validator');
const userModel = require('../models/user.model');
const tokenModel = require('../models/token.model');
const twoFactorModel = require('../models/twoFactor.model');
const passwordService = require('../services/password.service');
const tokenService = require('../services/token.service');
const twoFactorService = require('../services/twoFactor.service');
const mailService = require('../services/mail.service');
const { encrypt } = require('../utils/crypto');

const REFRESH_COOKIE = 'pawar_rt';
const COOKIE_PATH = '/api/v1/auth';

// Mobile apps send the header "X-Client-Type: mobile" and handle the refresh token in the body.
// Web uses an HttpOnly cookie that JavaScript can never read.
const isMobileClient = (req) => req.headers['x-client-type'] === 'mobile';
const requestMeta = (req) => ({ userAgent: req.headers['user-agent'], ip: req.ip });

const cookieOptions = () => ({
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: 'lax',
  path: COOKIE_PATH,
  maxAge: env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
});

const clearRefreshCookie = (res) => res.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });

const readRefreshToken = (req) => (isMobileClient(req) ? req.body && req.body.refreshToken : req.cookies && req.cookies[REFRESH_COOKIE]);

const sendTokens = (req, res, userRow, refreshToken, statusCode = 200) => {
  const data = { user: toSelfUser(userRow), accessToken: tokenService.signAccessToken(userRow) };
  if (isMobileClient(req)) data.refreshToken = refreshToken;
  else res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions());
  res.status(statusCode).json({ success: true, data });
};

const startSession = async (req, res, userRow, statusCode = 200) => {
  const refresh = await tokenService.issueRefreshToken(userRow.id, requestMeta(req));
  sendTokens(req, res, userRow, refresh.token, statusCode);
};

const completeLogin = async (req, res, user) => {
  let row = user;
  if (user.status === 'deactivated') {
    await userModel.setStatus(user.id, 'active'); // logging in reactivates the account
    row = { ...user, status: 'active' };
  }
  await userModel.touchLogin(user.id);
  await startSession(req, res, row);
};

// ------------------------------------------------------------------ register / login
const register = asyncHandler(async (req, res) => {
  const { email, username, password, fullName } = req.body;

  const [emailTaken, usernameTaken] = await Promise.all([
    userModel.existsByEmail(email),
    userModel.existsByUsername(username),
  ]);
  if (emailTaken || usernameTaken) {
    const details = {};
    if (emailTaken) details.email = ['This email is already registered'];
    if (usernameTaken) details.username = ['This username is taken'];
    throw new ApiError(409, 'Account already exists', details);
  }

  const passwordHash = await passwordService.hashPassword(password);
  const user = await withTransaction(async (client) => {
    const created = await userModel.create(client, { email, username, passwordHash, fullName });
    await userModel.createSettings(client, created.id);
    return created;
  });

  await startSession(req, res, user, 201);
});

const login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;

  const user = await userModel.findByIdentifier(identifier);
  if (!user) {
    await passwordService.dummyVerify(password);
    throw ApiError.unauthorized('Invalid credentials');
  }
  if (!(await passwordService.verifyPassword(user.password_hash, password))) {
    throw ApiError.unauthorized('Invalid credentials');
  }
  if (user.status === 'suspended') throw ApiError.forbidden('This account has been suspended');

  if (user.two_factor_enabled) {
    return res.json({
      success: true,
      data: { twoFactorRequired: true, twoFactorToken: tokenService.signTwoFactorToken(user.id) },
    });
  }
  return completeLogin(req, res, user);
});

const verifyTwoFactorLogin = asyncHandler(async (req, res) => {
  const { twoFactorToken, code } = req.body;
  const userId = tokenService.verifyTwoFactorToken(twoFactorToken);

  const user = await userModel.findById(userId);
  if (!user || !user.two_factor_enabled) throw ApiError.unauthorized('Invalid two-factor session');
  if (user.status === 'suspended') throw ApiError.forbidden('This account has been suspended');

  if (!(await twoFactorService.verifyCode(user, code))) {
    throw ApiError.unauthorized('Invalid verification code');
  }
  return completeLogin(req, res, user);
});

// ------------------------------------------------------------------ sessions
const refresh = asyncHandler(async (req, res) => {
  const raw = readRefreshToken(req);
  if (!raw || typeof raw !== 'string') throw ApiError.unauthorized('Refresh token missing');

  let rotated;
  try {
    rotated = await tokenService.rotateRefreshToken(raw, requestMeta(req));
  } catch (err) {
    if (!isMobileClient(req)) clearRefreshCookie(res);
    throw err;
  }

  const user = await userModel.findById(rotated.userId);
  if (!user || user.status !== 'active') {
    await tokenModel.revokeAllRefreshTokens(rotated.userId);
    if (!isMobileClient(req)) clearRefreshCookie(res);
    throw ApiError.unauthorized('Account is not active');
  }
  sendTokens(req, res, user, rotated.token);
});

const logout = asyncHandler(async (req, res) => {
  const raw = readRefreshToken(req);
  if (raw && typeof raw === 'string') await tokenModel.revokeRefreshTokenByHash(sha256(raw));
  clearRefreshCookie(res);
  res.json({ success: true, data: { message: 'Logged out' } });
});

const logoutAll = asyncHandler(async (req, res) => {
  await tokenModel.revokeAllRefreshTokens(req.user.id);
  clearRefreshCookie(res);
  res.json({ success: true, data: { message: 'Logged out from all devices' } });
});

const me = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.user.id);
  if (!user) throw ApiError.unauthorized('Invalid access token');
  res.json({ success: true, data: { user: toSelfUser(user) } });
});

const usernameAvailable = asyncHandler(async (req, res) => {
  const parsed = usernameSchema.safeParse(req.query.username);
  if (!parsed.success) {
    return res.json({ success: true, data: { available: false, reason: parsed.error.issues[0].message } });
  }
  const taken = await userModel.existsByUsername(parsed.data);
  return res.json({ success: true, data: { available: !taken } });
});

// ------------------------------------------------------------------ passwords
const forgotPassword = asyncHandler(async (req, res) => {
  const user = await userModel.findByEmail(req.body.email);

  if (user) {
    const raw = randomToken(32);
    await withTransaction(async (client) => {
      await tokenModel.invalidateResetTokens(client, user.id);
      await tokenModel.insertResetToken(client, {
        userId: user.id,
        tokenHash: sha256(raw),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
    });
    const link = `${env.clientUrls[0]}/reset-password?token=${raw}`;
    // Not awaited on purpose: response time must not reveal whether the email exists
    mailService.sendPasswordResetEmail(user.email, link).catch((err) => {
      console.error('Failed to send password reset email:', err.message);
    });
  }

  res.json({
    success: true,
    data: { message: 'If an account exists for this email, a reset link has been sent.' },
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  const passwordHash = await passwordService.hashPassword(newPassword);

  await withTransaction(async (client) => {
    const row = await tokenModel.consumeResetToken(client, sha256(token));
    if (!row) throw ApiError.badRequest('Reset link is invalid or has expired');
    await userModel.updatePassword(client, row.user_id, passwordHash);
    await tokenModel.revokeAllRefreshTokens(row.user_id, client);
  });

  res.json({ success: true, data: { message: 'Password updated. Please log in.' } });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await userModel.findById(req.user.id);

  if (!(await passwordService.verifyPassword(user.password_hash, currentPassword))) {
    throw ApiError.badRequest('Current password is incorrect', { currentPassword: ['Incorrect password'] });
  }
  if (currentPassword === newPassword) {
    throw ApiError.badRequest('New password must be different', { newPassword: ['Choose a different password'] });
  }

  const passwordHash = await passwordService.hashPassword(newPassword);
  await withTransaction(async (client) => {
    await userModel.updatePassword(client, user.id, passwordHash);
    await tokenModel.revokeAllRefreshTokens(user.id, client);
  });

  // All other devices are logged out; this device gets a fresh session
  await startSession(req, res, user);
});

// ------------------------------------------------------------------ two-factor authentication
const twoFactorSetup = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.user.id);
  if (user.two_factor_enabled) throw ApiError.conflict('Two-factor authentication is already enabled');

  const secret = twoFactorService.generateSecret();
  await userModel.setTwoFactorSecret(user.id, encrypt(secret));

  res.json({
    success: true,
    data: { secret, otpauthUrl: twoFactorService.buildOtpAuthUrl(user.email, secret) },
  });
});

const twoFactorEnable = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.user.id);
  if (user.two_factor_enabled) throw ApiError.conflict('Two-factor authentication is already enabled');
  if (!user.two_factor_secret) throw ApiError.badRequest('Start two-factor setup first');

  if (!twoFactorService.verifyTotp(req.body.code, user.two_factor_secret)) {
    throw ApiError.badRequest('Invalid verification code', { code: ['Invalid code'] });
  }

  const backupCodes = twoFactorService.generateBackupCodes();
  await withTransaction(async (client) => {
    await userModel.enableTwoFactor(client, user.id);
    await twoFactorModel.replaceBackupCodes(client, user.id, backupCodes.map(twoFactorService.hashBackupCode));
  });

  // Shown only once. Only hashes are stored.
  res.json({ success: true, data: { backupCodes } });
});

const twoFactorDisable = asyncHandler(async (req, res) => {
  const { password, code } = req.body;
  const user = await userModel.findById(req.user.id);
  if (!user.two_factor_enabled) throw ApiError.badRequest('Two-factor authentication is not enabled');

  if (!(await passwordService.verifyPassword(user.password_hash, password))) {
    throw ApiError.badRequest('Password is incorrect', { password: ['Incorrect password'] });
  }
  if (!(await twoFactorService.verifyCode(user, code))) {
    throw ApiError.badRequest('Invalid verification code', { code: ['Invalid code'] });
  }

  await withTransaction(async (client) => {
    await userModel.disableTwoFactor(client, user.id);
    await twoFactorModel.deleteBackupCodes(client, user.id);
  });

  res.json({ success: true, data: { message: 'Two-factor authentication disabled' } });
});

module.exports = {
  register,
  login,
  verifyTwoFactorLogin,
  refresh,
  logout,
  logoutAll,
  me,
  usernameAvailable,
  forgotPassword,
  resetPassword,
  changePassword,
  twoFactorSetup,
  twoFactorEnable,
  twoFactorDisable,
};
