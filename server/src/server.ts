import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { deliverNotifications } from './lib/notifications.js';
const server = app.listen(env.PORT, () => logger.info({ port: env.PORT }, 'Resolve is ready'));
let working = false;
const timer = setInterval(async () => {
  if (working) return;
  working = true;
  try {
    await deliverNotifications();
  } catch {
    logger.error('Notification worker failed');
  } finally {
    working = false;
  }
}, 15000);
async function shutdown() {
  clearInterval(timer);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
