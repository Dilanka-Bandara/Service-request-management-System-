import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../../config/env.js';
import { authenticate } from '../../middleware/authenticate.js';
import { loginSchema, registerSchema } from '../schemas.js';
import * as service from './auth.service.js';
export const authRouter = Router();
const limit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Please try again later' } },
});
const cookie = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.NODE_ENV === 'production',
  path: '/',
};
authRouter.post('/register', limit, async (req, res) => {
  const result = await service.register(registerSchema.parse(req.body));
  res
    .cookie('sid', result.token, { ...cookie, maxAge: env.SESSION_TTL_HOURS * 3600000 })
    .status(201)
    .json({ data: result.user });
});
authRouter.post('/login', limit, async (req, res) => {
  const result = await service.login(loginSchema.parse(req.body));
  res
    .cookie('sid', result.token, { ...cookie, maxAge: env.SESSION_TTL_HOURS * 3600000 })
    .json({ data: result.user });
});
authRouter.use(authenticate);
authRouter.get('/me', (_req, res) => {
  res.json({ data: res.locals.user });
});
authRouter.post('/logout', async (req, res) => {
  await service.logout(req.cookies.sid);
  res.clearCookie('sid', cookie).status(204).end();
});
