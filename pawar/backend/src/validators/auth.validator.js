const { z } = require('zod');

const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'support', 'help', 'pawar', 'root', 'system', 'moderator', 'mod',
  'api', 'login', 'logout', 'register', 'signup', 'settings', 'explore', 'reels', 'stories',
  'messages', 'notifications', 'search', 'null', 'undefined',
]);

const email = z.string().trim().toLowerCase().email('Invalid email').max(254);

const username = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9._]{3,30}$/, 'Username must be 3 to 30 characters: letters, numbers, dots, underscores')
  .refine((v) => !/^\.|\.$|\.\./.test(v), 'Username cannot start or end with a dot or contain two dots in a row')
  .refine((v) => !RESERVED_USERNAMES.has(v.toLowerCase()), 'This username is not available');

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Password must contain at least one letter and one number');

const totpCode = z.string().trim().regex(/^\d{6}$/, 'Code must be 6 digits');
// 6-digit authenticator code or a backup code like "a1b2c-3d4e5"
const anyCode = z.string().trim().min(6).max(20);

const register = z.object({
  email,
  username,
  password,
  fullName: z.string().trim().min(1, 'Full name is required').max(80),
});

const login = z.object({
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(128),
});

const verifyTwoFactor = z.object({
  twoFactorToken: z.string().min(10).max(1000),
  code: anyCode,
});

const refresh = z.object({ refreshToken: z.string().min(10).max(500).optional() });

const usernameAvailable = z.object({ username: z.string().trim().min(1).max(60) });

const forgotPassword = z.object({ email });

const resetPassword = z.object({
  token: z.string().min(20).max(200),
  newPassword: password,
});

const changePassword = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: password,
});

const enableTwoFactor = z.object({ code: totpCode });

const disableTwoFactor = z.object({
  password: z.string().min(1).max(128),
  code: anyCode,
});

module.exports = {
  usernameSchema: username,
  register,
  login,
  verifyTwoFactor,
  refresh,
  usernameAvailable,
  forgotPassword,
  resetPassword,
  changePassword,
  enableTwoFactor,
  disableTwoFactor,
};
