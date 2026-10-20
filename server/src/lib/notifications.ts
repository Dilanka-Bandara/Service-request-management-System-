import nodemailer from 'nodemailer';
import { prisma } from './prisma.js';
import { env } from '../config/env.js';
import { logger } from './logger.js';
export async function deliverNotifications() {
  if ((!env.SMTP_HOST && !env.RESEND_API_KEY) || !env.MAIL_FROM) return;
  const transport = env.RESEND_API_KEY
    ? undefined
    : nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        requireTLS: !env.SMTP_SECURE,
        connectionTimeout: 10000,
        socketTimeout: 20000,
        ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } } : {}),
      });
  const pending = await prisma.notification.findMany({
    where: { sentAt: null, availableAt: { lte: new Date() }, attempts: { lt: 10 } },
    take: 10,
    orderBy: { createdAt: 'asc' },
  });
  for (const item of pending) {
    // Conditional lease permits multiple workers without simultaneous delivery.
    const lease = await prisma.notification.updateMany({
      where: { id: item.id, sentAt: null, availableAt: item.availableAt },
      data: { availableAt: new Date(Date.now() + 120000), attempts: { increment: 1 } },
    });
    if (!lease.count) continue;
    try {
      const message = {
        from: env.MAIL_FROM,
        to: item.recipient,
        subject: item.subject,
        text: item.body,
      };
      if (env.RESEND_API_KEY) {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': item.id,
          },
          body: JSON.stringify({ ...message, to: [item.recipient] }),
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok) throw new Error('Email provider rejected delivery');
      } else {
        await transport!.sendMail({ ...message, messageId: `<${item.id}@resolve.notifications>` });
      }
      await prisma.notification.update({ where: { id: item.id }, data: { sentAt: new Date() } });
    } catch {
      logger.warn({ notificationId: item.id }, 'Email delivery failed; queued for retry');
      await prisma.notification.update({
        where: { id: item.id },
        data: { availableAt: new Date(Date.now() + Math.min(3600000, 30000 * 2 ** item.attempts)) },
      });
    }
  }
}
