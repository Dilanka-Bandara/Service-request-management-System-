import { beforeEach, afterAll, expect, it, vi } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { env } from '../src/config/env.js';
import { deliverNotifications } from '../src/lib/notifications.js';
const sendMail = vi.hoisted(() => vi.fn());
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail }) } }));
beforeEach(async () => {
  if (!new URL(env.DATABASE_URL).pathname.endsWith('/srm_test')) throw new Error('Use srm_test');
  await prisma.notification.deleteMany();
  env.SMTP_HOST = 'smtp.test.example';
  env.MAIL_FROM = 'resolve@test.example';
  sendMail.mockReset();
});
afterAll(() => prisma.$disconnect());
it('delivers a queued message and records success without resending', async () => {
  const item = await prisma.notification.create({
    data: {
      recipient: 'owner@test.example',
      subject: 'Status update',
      body: 'Your request is resolved.',
    },
  });
  sendMail.mockResolvedValue({ messageId: 'test' });
  await deliverNotifications();
  expect(sendMail).toHaveBeenCalledWith(
    expect.objectContaining({ to: item.recipient, text: item.body }),
  );
  const sent = await prisma.notification.findUniqueOrThrow({ where: { id: item.id } });
  expect(sent.sentAt).not.toBeNull();
  expect(sent.attempts).toBe(1);
  await deliverNotifications();
  expect(sendMail).toHaveBeenCalledTimes(1);
});
it('persists a failed delivery for a later retry', async () => {
  const item = await prisma.notification.create({
    data: { recipient: 'owner@test.example', subject: 'Status update', body: 'Queued message' },
  });
  sendMail.mockRejectedValue(new Error('SMTP unavailable'));
  await deliverNotifications();
  const failed = await prisma.notification.findUniqueOrThrow({ where: { id: item.id } });
  expect(failed.sentAt).toBeNull();
  expect(failed.attempts).toBe(1);
  expect(failed.availableAt.getTime()).toBeGreaterThan(Date.now());
});
it('keeps messages queued when SMTP is not configured', async () => {
  env.SMTP_HOST = undefined;
  await prisma.notification.create({
    data: { recipient: 'owner@test.example', subject: 'Status update', body: 'Queued message' },
  });
  await deliverNotifications();
  expect(sendMail).not.toHaveBeenCalled();
  expect(await prisma.notification.count({ where: { attempts: 0, sentAt: null } })).toBe(1);
});
