import { describe, expect, it } from 'vitest';
import { statuses, canTransition, assertTransition } from '../src/domain/request-status.js';
import { canView, canEdit, canCancel, getAllowedActions } from '../src/domain/permissions.js';
import { pagination, passwordSchema } from '../src/modules/schemas.js';
describe('request state machine', () => {
  const valid = new Set([
    'PENDING:IN_PROGRESS',
    'PENDING:CANCELLED',
    'IN_PROGRESS:RESOLVED',
    'IN_PROGRESS:CANCELLED',
  ]);
  for (const from of statuses)
    for (const to of statuses)
      it(`${from} → ${to} follows the workflow`, () => {
        expect(canTransition(from, to)).toBe(valid.has(`${from}:${to}`));
        if (!valid.has(`${from}:${to}`)) expect(() => assertTransition(from, to)).toThrow();
      });
});
describe('request permissions', () => {
  for (const role of ['USER', 'ADMIN'] as const)
    for (const owner of [true, false])
      for (const status of statuses) {
        it(`${role}, owner=${owner}, ${status}`, () => {
          const actor = { id: 'actor', role };
          const request = { createdById: owner ? 'actor' : 'other', status };
          expect(canView(actor, request)).toBe(owner || role === 'ADMIN');
          expect(canEdit(actor, request)).toBe(owner && status === 'PENDING');
          expect(canCancel(actor, request)).toBe(
            (owner || role === 'ADMIN') &&
              (status === 'PENDING' || (role === 'ADMIN' && status === 'IN_PROGRESS')),
          );
          expect(getAllowedActions(actor, request).nextStatuses).toEqual(
            role === 'ADMIN' ? statuses.filter((to) => canTransition(status, to)) : [],
          );
        });
      }
});
it('calculates pagination including an empty list', () => {
  expect(pagination(2, 10, 25)).toEqual({
    page: 2,
    limit: 10,
    total: 25,
    totalPages: 3,
    hasNextPage: true,
    hasPrevPage: true,
  });
  expect(pagination(1, 10, 0).totalPages).toBe(0);
});
it('requires a bounded password with letters and numbers', () => {
  for (const value of ['short1', 'abcdefgh', '123456789', 'a1'.repeat(40)])
    expect(passwordSchema.safeParse(value).success).toBe(false);
  expect(passwordSchema.safeParse('Avalidpassword1').success).toBe(true);
});
