export const statuses = ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'] as const;
export type Status = (typeof statuses)[number];
import { AppError } from '../errors/app-error.js';
export const ALLOWED_TRANSITIONS: Record<Status, Status[]> = {
  PENDING: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['RESOLVED', 'CANCELLED'],
  RESOLVED: [],
  CANCELLED: [],
};
export const canTransition = (from: Status, to: Status) => ALLOWED_TRANSITIONS[from].includes(to);
export function assertTransition(from: Status, to: Status) {
  if (!canTransition(from, to))
    throw new AppError(409, 'INVALID_STATUS_TRANSITION', `Cannot move ${from} to ${to}`);
}
