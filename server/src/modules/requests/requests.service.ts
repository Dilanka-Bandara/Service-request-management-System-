import type { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';
import {
  canView,
  canEdit,
  canCancel,
  getAllowedActions,
  type Actor,
} from '../../domain/permissions.js';
import { assertTransition, type Status } from '../../domain/request-status.js';
import { pagination, type listSchema, type requestSchema, type editSchema } from '../schemas.js';
import * as repo from './requests.repository.js';
export async function detail(user: Actor, id: string) {
  const request = await repo.findRequest(id);
  if (!request || !canView(user, request))
    throw new AppError(404, 'NOT_FOUND', 'Request not found');
  return { ...request, allowedActions: getAllowedActions(user, request) };
}
export async function list(user: Actor, query: z.infer<typeof listSchema>) {
  const [rows, total] = await repo.listRequests(user, query);
  return {
    data: rows.map((row) => ({ ...row, allowedActions: getAllowedActions(user, row) })),
    meta: pagination(query.page, query.limit, total),
  };
}
export async function create(user: Actor, input: z.infer<typeof requestSchema>) {
  const row = await prisma.$transaction(async (tx) => {
    const request = await tx.serviceRequest.create({
      data: {
        ...input,
        createdById: user.id,
        history: { create: { actorId: user.id, action: 'CREATED', toStatus: 'PENDING' } },
      },
      include: repo.summaryInclude,
    });
    await tx.notification.create({
      data: {
        recipient: request.createdBy.email,
        subject: `Request received: ${request.title}`,
        body: `Your request ${request.id} is now PENDING.`,
      },
    });
    return request;
  });
  return detail(user, row.id);
}
export async function edit(user: Actor, id: string, input: z.infer<typeof editSchema>) {
  const request = await detail(user, id);
  if (request.createdById !== user.id)
    throw new AppError(403, 'FORBIDDEN', 'Only the owner may edit request content');
  if (!canEdit(user, request))
    throw new AppError(409, 'REQUEST_NOT_EDITABLE', 'Only pending requests can be edited');
  await prisma.$transaction(async (tx) => {
    const result = await tx.serviceRequest.updateMany({
      where: { id, status: 'PENDING', updatedAt: request.updatedAt },
      data: input,
    });
    if (!result.count)
      throw new AppError(409, 'STATUS_CONFLICT', 'Request changed; refresh and retry');
    await tx.requestHistory.create({
      data: { requestId: id, actorId: user.id, action: 'UPDATED' },
    });
  });
  return detail(user, id);
}
export async function transition(
  user: Actor,
  id: string,
  status: Status,
  note?: string,
  cancel = false,
) {
  const request = await detail(user, id);
  if (cancel) {
    if (!canCancel(user, request))
      throw new AppError(409, 'REQUEST_NOT_CANCELLABLE', 'This request cannot be cancelled');
  } else if (user.role !== 'ADMIN')
    throw new AppError(403, 'FORBIDDEN', 'Administrator access required');
  assertTransition(request.status, status);
  await prisma.$transaction(async (tx) => {
    const result = await tx.serviceRequest.updateMany({
      where: { id, status: request.status },
      data: { status },
    });
    if (!result.count)
      throw new AppError(409, 'STATUS_CONFLICT', 'Request changed; refresh and retry');
    await tx.requestHistory.create({
      data: {
        requestId: id,
        actorId: user.id,
        action: status === 'CANCELLED' ? 'CANCELLED' : 'STATUS_CHANGED',
        fromStatus: request.status,
        toStatus: status,
        note,
      },
    });
    await tx.notification.create({
      data: {
        recipient: request.createdBy.email,
        subject: `Request updated: ${request.title}`,
        body: `Your request ${id} changed from ${request.status} to ${status}.${note ? `\nNote: ${note}` : ''}`,
      },
    });
  });
  return detail(user, id);
}
export async function stats(user: Actor) {
  const where = repo.scope(user);
  const { byStatus, byCategory } = await prisma.$transaction(async (tx) => {
    const byStatus = await tx.serviceRequest.groupBy({
      by: ['status'],
      where,
      _count: true,
      orderBy: { status: 'asc' },
    });
    const byCategory = await tx.serviceRequest.groupBy({
      by: ['category'],
      where,
      _count: true,
      orderBy: { category: 'asc' },
    });
    return { byStatus, byCategory };
  });
  return { byStatus, byCategory, total: byStatus.reduce((sum, row) => sum + row._count, 0) };
}
