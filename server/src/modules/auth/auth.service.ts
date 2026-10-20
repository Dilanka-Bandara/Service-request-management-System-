import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { Prisma } from '@prisma/client';
import { prisma, publicUserSelect } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { hashToken } from '../../middleware/authenticate.js';
import { AppError } from '../../errors/app-error.js';
import type { z } from 'zod';
import type { registerSchema, loginSchema } from '../schemas.js';
async function createSession(userId: string) {
  const token = randomBytes(32).toString('hex');
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + env.SESSION_TTL_HOURS * 3600000),
    },
  });
  return token;
}
export async function register(input: z.infer<typeof registerSchema>) {
  try {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: await argon2.hash(input.password, { type: argon2.argon2id }),
      },
      select: publicUserSelect,
    });
    return { user, token: await createSession(user.id) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'This email is already registered');
    throw error;
  }
}
export async function login(input: z.infer<typeof loginSchema>) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !(await argon2.verify(user.passwordHash, input.password)))
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  if (!user.isActive) throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been disabled');
  const safeUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: publicUserSelect,
  });
  return { user: safeUser, token: await createSession(user.id) };
}
export async function logout(token: string) {
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}
