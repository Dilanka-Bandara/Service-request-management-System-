import { Prisma } from '@prisma/client';
import { prisma, publicUserSelect } from '../../lib/prisma.js';
import type { Actor } from '../../domain/permissions.js';
import type { z } from 'zod';
import type { listSchema } from '../schemas.js';
export const summaryInclude = { createdBy: { select: publicUserSelect } } as const;
export const attachmentSelect = {
  id: true,
  name: true,
  size: true,
  mimeType: true,
  createdAt: true,
} as const;
export function scope(user: Actor): Prisma.ServiceRequestWhereInput {
  return user.role === 'ADMIN' ? {} : { createdById: user.id };
}
export function filters(
  user: Actor,
  query: z.infer<typeof listSchema>,
): Prisma.ServiceRequestWhereInput {
  return {
    ...scope(user),
    status: query.status,
    category: query.category,
    priority: query.priority,
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}
export const findRequest = (id: string) =>
  prisma.serviceRequest.findUnique({
    where: { id },
    include: {
      ...summaryInclude,
      attachments: { select: attachmentSelect },
      history: {
        include: { actor: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
export async function listRequests(user: Actor, query: z.infer<typeof listSchema>) {
  const where = filters(user, query);
  return prisma.$transaction([
    prisma.serviceRequest.findMany({
      where,
      include: summaryInclude,
      orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.serviceRequest.count({ where }),
  ]);
}
