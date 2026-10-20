import { z } from 'zod';
const optional = z.preprocess((v) => (v === '' ? undefined : v), z.string().optional());
export const env = z
  .object({
    DATABASE_URL: z.string().url(),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).default(4000),
    CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
    SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(24),
    TRUST_PROXY: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    SMTP_HOST: optional,
    SMTP_USER: optional,
    SMTP_PASSWORD: optional,
    MAIL_FROM: optional,
    SMTP_PORT: z.coerce.number().int().min(1).default(587),
    SMTP_SECURE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
  })
  .parse(process.env);
