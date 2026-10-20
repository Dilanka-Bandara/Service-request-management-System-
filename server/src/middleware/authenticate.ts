import type { RequestHandler } from 'express';
import { createHash } from 'node:crypto';
import type { Actor } from '../domain/permissions.js';
import { prisma, publicUserSelect } from '../lib/prisma.js';
import { AppError } from '../errors/app-error.js';
declare module 'express-serve-static-core' {
  interface Locals {
    user: Actor & { name: string; email: string };
  }
}
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const authenticate: RequestHandler = async (req, res, next) => {
  const token: unknown = req.cookies?.sid;
  if (typeof token !== 'string') throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in');
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: publicUserSelect } },
  });
  if (!session || session.expiresAt <= new Date() || !session.user.isActive) {
    if (session) await prisma.session.deleteMany({ where: { id: session.id } });
    throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in');
  }
  res.locals.user = session.user;
  next();
};
export const requireAdmin: RequestHandler = (_req, res, next) => {
  if (res.locals.user.role !== 'ADMIN')
    throw new AppError(403, 'FORBIDDEN', 'Administrator access required');
  next();
};
