// End-to-end check of the auth API. Run the server first (npm run dev), then: npm run smoke:auth
const { authenticator } = require('otplib');

const BASE = process.env.API_URL || 'http://localhost:5000/api/v1';
const stamp = Date.now().toString(36);
const user = {
  email: `smoke_${stamp}@example.com`,
  username: `smoke_${stamp}`,
  password: 'Smoke1234pass',
  fullName: 'Smoke Test',
};

let passed = 0;
let failed = 0;
const check = (name, condition, extra = '') => {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name} ${extra}`);
  }
};

// "X-Client-Type: mobile" makes the API return the refresh token in the body (easier to test)
const call = async (method, path, { body, token } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Type': 'mobile',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch (err) {
    json = null;
  }
  return { status: res.status, data: json && json.data, json };
};

const run = async () => {
  console.log(`Testing ${BASE}\n`);

  let r = await call('GET', '/health');
  check('health route', r.status === 200, JSON.stringify(r.json));

  r = await call('POST', '/auth/register', { body: { ...user, password: 'short' } });
  check('register rejects weak password', r.status === 400);

  r = await call('POST', '/auth/register', { body: user });
  check('register works', r.status === 201 && r.data && r.data.accessToken && r.data.refreshToken, JSON.stringify(r.json));
  let access = r.data && r.data.accessToken;
  let refreshToken = r.data && r.data.refreshToken;

  r = await call('POST', '/auth/register', { body: user });
  check('register rejects duplicate', r.status === 409);

  r = await call('GET', '/auth/me', { token: access });
  check('me with token', r.status === 200 && r.data.user.email === user.email);

  r = await call('GET', '/auth/me');
  check('me without token is 401', r.status === 401);

  r = await call('GET', `/auth/username-available?username=${user.username}`);
  check('taken username is unavailable', r.status === 200 && r.data.available === false);

  r = await call('GET', `/auth/username-available?username=free_${stamp}`);
  check('free username is available', r.status === 200 && r.data.available === true);

  r = await call('POST', '/auth/login', { body: { identifier: user.email, password: 'Wrong1234pass' } });
  check('login with wrong password is 401', r.status === 401);

  r = await call('POST', '/auth/login', { body: { identifier: user.username.toUpperCase(), password: user.password } });
  check('login with username (any case) works', r.status === 200 && r.data.accessToken, JSON.stringify(r.json));
  access = r.data.accessToken;
  refreshToken = r.data.refreshToken;

  const oldRefresh = refreshToken;
  r = await call('POST', '/auth/refresh', { body: { refreshToken } });
  check('refresh rotates tokens', r.status === 200 && r.data.refreshToken && r.data.refreshToken !== oldRefresh);
  refreshToken = r.data.refreshToken;
  access = r.data.accessToken;

  r = await call('POST', '/auth/refresh', { body: { refreshToken: oldRefresh } });
  check('old refresh token is rejected', r.status === 401);

  r = await call('POST', '/auth/refresh', { body: { refreshToken } });
  check('new refresh token still works', r.status === 200);
  refreshToken = r.data.refreshToken;
  access = r.data.accessToken;

  r = await call('POST', '/auth/forgot-password', { body: { email: user.email } });
  check('forgot password responds ok', r.status === 200);
  r = await call('POST', '/auth/forgot-password', { body: { email: `nobody_${stamp}@example.com` } });
  check('forgot password same response for unknown email', r.status === 200);
  r = await call('POST', '/auth/reset-password', { body: { token: 'x'.repeat(30), newPassword: 'Newpass1234' } });
  check('reset with bad token is 400', r.status === 400);

  // two-factor
  r = await call('POST', '/auth/2fa/setup', { token: access });
  check('2fa setup returns secret', r.status === 200 && r.data.secret && r.data.otpauthUrl, JSON.stringify(r.json));
  const secret = r.data && r.data.secret;

  r = await call('POST', '/auth/2fa/enable', { token: access, body: { code: '000000' } });
  check('2fa enable rejects wrong code', r.status === 400);

  r = await call('POST', '/auth/2fa/enable', { token: access, body: { code: authenticator.generate(secret) } });
  check('2fa enable gives 10 backup codes', r.status === 200 && r.data.backupCodes.length === 10, JSON.stringify(r.json));
  const backupCodes = r.data.backupCodes;

  r = await call('POST', '/auth/login', { body: { identifier: user.email, password: user.password } });
  check('login now asks for 2fa', r.status === 200 && r.data.twoFactorRequired === true && r.data.twoFactorToken);
  const twoFactorToken = r.data.twoFactorToken;

  r = await call('POST', '/auth/2fa/verify', { body: { twoFactorToken, code: '000000' } });
  check('2fa verify rejects wrong code', r.status === 401);

  r = await call('POST', '/auth/2fa/verify', { body: { twoFactorToken, code: backupCodes[0] } });
  check('2fa verify works with a backup code', r.status === 200 && r.data.accessToken, JSON.stringify(r.json));
  access = r.data.accessToken;

  r = await call('POST', '/auth/2fa/verify', { body: { twoFactorToken, code: backupCodes[0] } });
  check('backup code cannot be reused', r.status === 401);

  r = await call('POST', '/auth/2fa/disable', { token: access, body: { password: user.password, code: authenticator.generate(secret) } });
  check('2fa disable works', r.status === 200, JSON.stringify(r.json));

  // change password
  r = await call('POST', '/auth/change-password', { token: access, body: { currentPassword: user.password, newPassword: 'Changed1234pass' } });
  check('change password works and returns a new session', r.status === 200 && r.data.accessToken, JSON.stringify(r.json));
  access = r.data.accessToken;
  refreshToken = r.data.refreshToken;

  r = await call('POST', '/auth/login', { body: { identifier: user.email, password: user.password } });
  check('old password no longer works', r.status === 401);

  r = await call('POST', '/auth/login', { body: { identifier: user.email, password: 'Changed1234pass' } });
  check('new password works', r.status === 200 && r.data.accessToken);
  refreshToken = r.data.refreshToken;

  // logout
  r = await call('POST', '/auth/logout', { body: { refreshToken } });
  check('logout works', r.status === 200);
  r = await call('POST', '/auth/refresh', { body: { refreshToken } });
  check('refresh after logout is rejected', r.status === 401);

  r = await call('POST', '/auth/login', { body: { identifier: user.email, password: 'Changed1234pass' } });
  access = r.data.accessToken;
  r = await call('POST', '/auth/logout-all', { token: access });
  check('logout-all works', r.status === 200);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exitCode = failed > 0 ? 1 : 0;
};

run().catch((err) => {
  console.error('Smoke test crashed. Is the server running?', err.message);
  process.exitCode = 1;
});
