import type { z } from 'zod';
import { prisma, publicUserSelect } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';
import type { Actor } from '../../domain/permissions.js';
import { pagination, type usersQuerySchema, type userEditSchema } from '../schemas.js';
export async function list(query: z.infer<typeof usersQuerySchema>) {
  const where = {
    role: query.role,
    isActive: query.isActive === undefined ? undefined : query.isActive === 'true',
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { email: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
  const [data, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: publicUserSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.user.count({ where }),
  ]);
  return { data, meta: pagination(query.page, query.limit, total) };
}
export async function update(actor: Actor, id: string, input: z.infer<typeof userEditSchema>) {
  if (actor.id === id && (input.role === 'USER' || input.isActive === false))
    throw new AppError(409, 'ADMIN_PROTECTION', 'You cannot deactivate or demote yourself');
  return prisma.$transaction(async (tx) => {
    // Serialize admin changes, including concurrent demotions by different admins.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(731902)`;
    const user = await tx.user.findUnique({ where: { id } });
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
    const currentActor = await tx.user.findUnique({ where: { id: actor.id } });
    if (!currentActor?.isActive || currentActor.role !== 'ADMIN')
      throw new AppError(403, 'FORBIDDEN', 'Administrator access required');
    if (
      user.role === 'ADMIN' &&
      user.isActive &&
      (input.role === 'USER' || input.isActive === false) &&
      (await tx.user.count({ where: { role: 'ADMIN', isActive: true } })) <= 1
    )
      throw new AppError(409, 'ADMIN_PROTECTION', 'At least one active administrator is required');
    const updated = await tx.user.update({ where: { id }, data: input, select: publicUserSelect });
    if (input.isActive === false) await tx.session.deleteMany({ where: { userId: id } });
    return updated;
  });
}
