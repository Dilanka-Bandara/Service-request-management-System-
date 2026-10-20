import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { MulterError } from 'multer';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { AppError } from './errors/app-error.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { requestsRouter } from './modules/requests/requests.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { openapi } from './docs/openapi.js';
export const app = express();
if (env.TRUST_PROXY) app.set('trust proxy', 1);
app.use(pinoHttp({ logger, genReqId: () => randomUUID() }));
app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use((req, _res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    // Origin checks also cover multipart uploads; CORS alone does not prevent CSRF.
    if (req.headers.origin && req.headers.origin !== new URL(env.CLIENT_ORIGIN).origin)
      throw new AppError(403, 'FORBIDDEN', 'Untrusted origin');
    if (req.headers['sec-fetch-site'] === 'cross-site')
      throw new AppError(403, 'FORBIDDEN', 'Cross-site requests are not permitted');
    const attachment =
      req.method === 'POST' && /^\/api\/requests\/[^/]+\/attachments$/.test(req.path);
    if (!req.is('application/json') && !(attachment && req.is('multipart/form-data')))
      throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Use application/json');
  }
  next();
});
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.get('/api/health', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ data: { status: 'ok' } });
});
app.get('/api/docs/openapi.json', (_req, res) => {
  res.json(openapi);
});
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi));
app.use('/api/auth', authRouter);
app.use('/api/requests', requestsRouter);
app.use('/api/users', usersRouter);
app.use('/api', (_req, _res) => {
  throw new AppError(404, 'ROUTE_NOT_FOUND', 'Route not found');
});
// Resolve relative to source/build, independent of the process working directory.
const clientBuild = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  import.meta.url.includes('/dist/') ? '../../../client/dist' : '../../client/dist',
);
if (existsSync(clientBuild)) {
  app.use(express.static(clientBuild));
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(clientBuild, 'index.html'));
  });
}
app.use((_req, _res) => {
  throw new AppError(404, 'ROUTE_NOT_FOUND', 'Route not found');
});
const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large') {
    res
      .status(413)
      .json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'JSON payload exceeds 100 KiB' } });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }
  if (error instanceof AppError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Malformed JSON' } });
    return;
  }
  if (error instanceof MulterError) {
    res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
      error: { code: 'INVALID_FILE', message: 'Upload one PDF, PNG or JPEG up to 5 MiB' },
    });
    return;
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ['P2002', 'P2025'].includes(error.code)
  ) {
    res.status(error.code === 'P2002' ? 409 : 404).json({
      error: {
        code: error.code === 'P2002' ? 'CONFLICT' : 'NOT_FOUND',
        message: 'The operation could not be completed',
      },
    });
    return;
  }
  logger.error({ err: error }, 'Unhandled request failure');
  res
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
};
app.use(errorHandler);
