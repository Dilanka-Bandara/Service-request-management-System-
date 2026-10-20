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
  env.RESEND_API_KEY = undefined;
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
it('sends through HTTPS with a stable idempotency key when Resend is configured', async () => {
  env.RESEND_API_KEY = 'test-only-provider-key';
  const request = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response('{}', { status: 200 }));
  try {
    const item = await prisma.notification.create({
      data: { recipient: 'owner@test.example', subject: 'Status update', body: 'Resolved' },
    });
    await deliverNotifications();
    expect(request).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Idempotency-Key': item.id }),
        body: JSON.stringify({
          from: env.MAIL_FROM,
          to: [item.recipient],
          subject: item.subject,
          text: item.body,
        }),
      }),
    );
    expect(sendMail).not.toHaveBeenCalled();
    expect(
      (await prisma.notification.findUniqueOrThrow({ where: { id: item.id } })).sentAt,
    ).not.toBeNull();
  } finally {
    request.mockRestore();
  }
});
it('retries a rejected HTTPS delivery without marking it sent', async () => {
  env.RESEND_API_KEY = 'test-only-provider-key';
  const request = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response('{}', { status: 429 }));
  try {
    const item = await prisma.notification.create({
      data: { recipient: 'owner@test.example', subject: 'Status update', body: 'Resolved' },
    });
    await deliverNotifications();
    const saved = await prisma.notification.findUniqueOrThrow({ where: { id: item.id } });
    expect(saved.sentAt).toBeNull();
    expect(saved.attempts).toBe(1);
  } finally {
    request.mockRestore();
  }
});
