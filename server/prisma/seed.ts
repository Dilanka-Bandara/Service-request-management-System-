import { PrismaClient, RequestCategory, RequestPriority, RequestStatus } from '@prisma/client';
import argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { z } from 'zod';
const config = z
  .object({
    SEED_ADMIN_EMAIL: z.string().email(),
    SEED_ADMIN_PASSWORD: z.string().min(12),
    SEED_USER_PASSWORD: z.string().min(12),
  })
  .parse(process.env);
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
try {
  const admin = await db.user.upsert({
    where: { email: config.SEED_ADMIN_EMAIL.toLowerCase() },
    update: {},
    create: {
      name: 'Workspace Admin',
      email: config.SEED_ADMIN_EMAIL.toLowerCase(),
      role: 'ADMIN',
      passwordHash: await argon2.hash(config.SEED_ADMIN_PASSWORD),
    },
  });
  const users = [admin];
  for (const [name, email] of [
    ['Alex Morgan', 'alex@example.com'],
    ['Jamie Lee', 'jamie@example.com'],
  ]) {
    users.push(
      await db.user.upsert({
        where: { email },
        update: {},
        create: { name, email, passwordHash: await argon2.hash(config.SEED_USER_PASSWORD) },
      }),
    );
  }
  if ((await db.serviceRequest.count()) === 0) {
    const titles = [
      'Unable to connect to workspace VPN',
      'Invoice total needs a review',
      'Update account contact details',
      'New workstation setup',
      'Access to the reporting dashboard',
      'Subscription renewal question',
    ];
    for (let i = 0; i < 30; i++) {
      const status = Object.values(RequestStatus)[i % 4];
      await db.serviceRequest.create({
        data: {
          title: `${titles[i % titles.length]} #${i + 1}`,
          description:
            'Please help investigate this request. The issue has been reproduced and the relevant details are available from the requester.',
          category: Object.values(RequestCategory)[i % 4],
          priority: Object.values(RequestPriority)[i % 3],
          status,
          createdById: users[i % 3].id,
          history: {
            create: [
              { actorId: users[i % 3].id, action: 'CREATED', toStatus: 'PENDING' },
              ...(status === 'PENDING'
                ? []
                : [
                    {
                      actorId: admin.id,
                      action: 'STATUS_CHANGED',
                      fromStatus: RequestStatus.PENDING,
                      toStatus: status,
                      note: 'Imported demonstration state',
                    },
                  ]),
            ],
          },
        },
      });
    }
  }
} finally {
  await db.$disconnect();
}
