import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { env } from '../src/config/env.js';
const api = supertest(app);
const owner = supertest.agent(app);
const other = supertest.agent(app);
const admin = supertest.agent(app);
const password = 'IntegrationPassword123';
let ownerId: string;
let adminId: string;
let requestId: string;
const body = {
  title: 'Investigate VPN access',
  description: 'VPN connection fails with an authentication error.',
  category: 'TECHNICAL',
  priority: 'HIGH',
};
beforeAll(async () => {
  // Never clear an arbitrary development/production database.
  if (!new URL(env.DATABASE_URL).pathname.endsWith('/srm_test'))
    throw new Error('Integration tests require the dedicated srm_test database');
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Notification", "Attachment", "RequestHistory", "ServiceRequest", "Session", "User" CASCADE',
  );
  const account = await prisma.user.create({
    data: {
      name: 'Admin',
      email: 'admin@test.example',
      role: 'ADMIN',
      passwordHash: await argon2.hash(password),
    },
  });
  adminId = account.id;
  await admin.post('/api/auth/login').send({ email: account.email, password }).expect(200);
});
afterAll(async () => {
  await prisma.$disconnect();
});
describe('authentication and input boundaries', () => {
  it('registers, normalizes email, ignores a supplied role and sets an httpOnly cookie', async () => {
    const res = await owner
      .post('/api/auth/register')
      .send({ name: 'Request Owner', email: ' Owner@Test.Example ', password, role: 'ADMIN' })
      .expect(201);
    ownerId = res.body.data.id;
    expect(res.body.data.role).toBe('USER');
    expect(res.body.data.email).toBe('owner@test.example');
    expect(res.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    await other
      .post('/api/auth/register')
      .send({ name: 'Other User', email: 'other@test.example', password })
      .expect(201);
  });
  it('rejects duplicate and invalid registrations', async () => {
    await api
      .post('/api/auth/register')
      .send({ name: 'Duplicate', email: 'owner@test.example', password })
      .expect(409);
    await api
      .post('/api/auth/register')
      .send({ name: 'x', email: 'invalid', password: 'x' })
      .expect(400);
  });
  it('rejects incorrect credentials and missing authentication', async () => {
    const response = await api
      .post('/api/auth/login')
      .send({ email: 'owner@test.example', password: 'WrongPassword1' })
      .expect(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    await api.get('/api/auth/me').expect(401);
    await owner.get('/api/auth/me').expect(200);
  });
  it('rejects untrusted origins for JSON and multipart mutations', async () => {
    await owner.post('/api/requests').set('Origin', 'https://evil.example').send(body).expect(403);
    await owner
      .post(`/api/requests/${randomUUID()}/attachments`)
      .set('Origin', 'https://evil.example')
      .attach('file', Buffer.from('%PDF-test'), 'test.pdf')
      .expect(403);
  });
});
describe('request lifecycle, permissions and listings', () => {
  it('creates a pending request with atomic history and queued notification', async () => {
    const res = await owner
      .post('/api/requests')
      .send({ ...body, status: 'RESOLVED' })
      .expect(201);
    requestId = res.body.data.id;
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.history).toHaveLength(1);
    expect(res.body.data.allowedActions.canEdit).toBe(true);
    expect(await prisma.notification.count()).toBe(1);
  });
  it('hides other users requests and rejects privileged routes', async () => {
    await other.get(`/api/requests/${requestId}`).expect(404);
    await other.patch(`/api/requests/${requestId}`).send({ title: 'Forbidden edit' }).expect(404);
    await owner.get('/api/users').expect(403);
    await owner
      .patch(`/api/requests/${requestId}/status`)
      .send({ status: 'IN_PROGRESS' })
      .expect(403);
    const result = await other.get('/api/requests').expect(200);
    expect(result.body.meta.total).toBe(0);
  });
  it('validates body, UUID and pagination inputs', async () => {
    await owner.post('/api/requests').send({ title: 'x' }).expect(400);
    await owner.get('/api/requests/not-a-uuid').expect(400);
    await owner.get(`/api/requests/${randomUUID()}`).expect(404);
    await owner.get('/api/requests?limit=101').expect(400);
    await owner.get('/api/requests?status=UNKNOWN').expect(400);
  });
  it('supports combined filters, description search and priority sort', async () => {
    await owner
      .post('/api/requests')
      .send({ ...body, title: 'Billing question', category: 'BILLING', priority: 'LOW' })
      .expect(201);
    const result = await owner
      .get(
        '/api/requests?search=authentication&category=TECHNICAL&priority=HIGH&status=PENDING&limit=1',
      )
      .expect(200);
    expect(result.body.data[0].id).toBe(requestId);
    expect(result.body.meta.total).toBe(1);
    const sorted = await admin
      .get('/api/requests?sortBy=priority&sortOrder=desc&limit=1')
      .expect(200);
    expect(sorted.body.data[0].priority).toBe('HIGH');
    expect(sorted.body.meta.hasNextPage).toBe(true);
  });
  it('allows pending edits, rejects admin edits of another owners content', async () => {
    await owner
      .patch(`/api/requests/${requestId}`)
      .send({ title: 'VPN access needs review' })
      .expect(200);
    await admin.patch(`/api/requests/${requestId}`).send({ title: 'Admin edit' }).expect(403);
  });
  it('uploads and downloads authorized attachments, rejects spoofed types and foreign access', async () => {
    const bytes = Buffer.from('%PDF-1.4\nsample attachment');
    const upload = await owner
      .post(`/api/requests/${requestId}/attachments`)
      .attach('file', bytes, 'evidence.pdf')
      .expect(201);
    const download = await owner
      .get(`/api/requests/${requestId}/attachments/${upload.body.data.id}`)
      .expect(200);
    expect(download.headers['content-disposition']).toContain('attachment;');
    await other.get(`/api/requests/${requestId}/attachments/${upload.body.data.id}`).expect(404);
    await owner
      .post(`/api/requests/${requestId}/attachments`)
      .attach('file', Buffer.from('<script>alert(1)</script>'), 'image.png')
      .expect(400);
    await owner
      .post(`/api/requests/${requestId}/attachments`)
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), 'large.pdf')
      .expect(413);
  });
  it('enforces transitions, terminal states and edit/cancel locks', async () => {
    await admin
      .patch(`/api/requests/${requestId}/status`)
      .send({ status: 'IN_PROGRESS', note: 'Investigating now' })
      .expect(200);
    await owner.patch(`/api/requests/${requestId}`).send({ title: 'Too late' }).expect(409);
    await owner.delete(`/api/requests/${requestId}`).send({}).expect(409);
    await owner
      .post(`/api/requests/${requestId}/attachments`)
      .attach('file', Buffer.from('%PDF-1.4'), 'late.pdf')
      .expect(409);
    await admin.patch(`/api/requests/${requestId}/status`).send({ status: 'RESOLVED' }).expect(200);
    await admin.patch(`/api/requests/${requestId}/status`).send({ status: 'PENDING' }).expect(409);
    const row = await prisma.serviceRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { history: true },
    });
    expect(row.history.some((h) => h.note === 'Investigating now')).toBe(true);
  });
  it('soft cancels pending requests, and allows admin cancellation in progress', async () => {
    const created = await owner.post('/api/requests').send(body).expect(201);
    await owner.delete(`/api/requests/${created.body.data.id}`).send({}).expect(200);
    await admin
      .patch(`/api/requests/${created.body.data.id}/status`)
      .send({ status: 'IN_PROGRESS' })
      .expect(409);
    const created2 = await owner.post('/api/requests').send(body).expect(201);
    await admin
      .patch(`/api/requests/${created2.body.data.id}/status`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);
    await admin.delete(`/api/requests/${created2.body.data.id}`).send({}).expect(200);
    expect(await prisma.serviceRequest.count()).toBe(4);
  });
  it('returns scoped statistics', async () => {
    const result = await owner.get('/api/requests/stats').expect(200);
    expect(result.body.data.total).toBe(4);
    const empty = await other.get('/api/requests/stats').expect(200);
    expect(empty.body.data.total).toBe(0);
  });
});
describe('user administration and session revocation', () => {
  it('protects the current admin and revokes disabled users sessions', async () => {
    await admin.patch(`/api/users/${adminId}`).send({ isActive: false }).expect(409);
    await admin.patch(`/api/users/${adminId}`).send({ role: 'USER' }).expect(409);
    await admin.patch(`/api/users/${ownerId}`).send({ isActive: false }).expect(200);
    await owner.get('/api/auth/me').expect(401);
    await api.post('/api/auth/login').send({ email: 'owner@test.example', password }).expect(403);
  });
  it('invalidates the old token on logout', async () => {
    const result = await api
      .post('/api/auth/login')
      .send({ email: 'other@test.example', password })
      .expect(200);
    const cookie = result.headers['set-cookie'][0].split(';')[0];
    await api.post('/api/auth/logout').set('Cookie', cookie).send({}).expect(204);
    await api.get('/api/auth/me').set('Cookie', cookie).expect(401);
  });
});
it('returns consistent JSON errors and a working health endpoint', async () => {
  await api.get('/api/health').expect(200);
  const unknown = await api.get('/api/missing').expect(404);
  expect(unknown.body.error.code).toBe('ROUTE_NOT_FOUND');
  const invalid = await api
    .post('/api/auth/login')
    .set('Content-Type', 'application/json')
    .send('{broken')
    .expect(400);
  expect(invalid.body.error.code).toBe('INVALID_JSON');
});
