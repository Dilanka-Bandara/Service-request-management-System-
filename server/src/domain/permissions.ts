import { ALLOWED_TRANSITIONS, type Status } from './request-status.js';
export type Actor = { id: string; role: 'USER' | 'ADMIN' };
type Request = { createdById: string; status: Status };
export const canView = (user: Actor, request: Request) =>
  user.role === 'ADMIN' || request.createdById === user.id;
export const canEdit = (user: Actor, request: Request) =>
  request.createdById === user.id && request.status === 'PENDING';
export const canCancel = (user: Actor, request: Request) =>
  canView(user, request) &&
  (request.status === 'PENDING' || (user.role === 'ADMIN' && request.status === 'IN_PROGRESS'));
export const getAllowedActions = (user: Actor, request: Request) => ({
  canEdit: canEdit(user, request),
  canCancel: canCancel(user, request),
  nextStatuses: user.role === 'ADMIN' ? ALLOWED_TRANSITIONS[request.status] : [],
});
