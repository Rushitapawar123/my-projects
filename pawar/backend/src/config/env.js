require('dotenv').config();
const { z } = require('zod');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  CLIENT_URLS: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().default(30),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  TWO_FACTOR_ENCRYPTION_KEY: z
    .union([z.string().regex(/^[0-9a-fA-F]{64}$/, 'Must be 64 hex characters'), z.literal('')])
    .optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('Pawar <no-reply@pawar.app>'),
  FIREBASE_SERVICE_ACCOUNT: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

if (env.NODE_ENV === 'production' && !env.TWO_FACTOR_ENCRYPTION_KEY) {
  console.error('TWO_FACTOR_ENCRYPTION_KEY is required in production');
  process.exit(1);
}

module.exports = {
  ...env,
  isProd: env.NODE_ENV === 'production',
  cookieSecure: env.COOKIE_SECURE === 'true',
  clientUrls: env.CLIENT_URLS.split(',').map((s) => s.trim()).filter(Boolean),
};
