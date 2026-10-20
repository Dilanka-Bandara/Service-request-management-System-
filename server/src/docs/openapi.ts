import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  registerSchema,
  loginSchema,
  requestSchema,
  editSchema,
  statusSchema,
  userEditSchema,
  listSchema,
  usersQuerySchema,
} from '../modules/schemas.js';
extendZodWithOpenApi(z);
const registry = new OpenAPIRegistry();
registry.registerComponent('securitySchemes', 'session', {
  type: 'apiKey',
  in: 'cookie',
  name: 'sid',
});
const error = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
  }),
});
const user = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  role: z.enum(['USER', 'ADMIN']),
  isActive: z.boolean().optional(),
});
const request = requestSchema.extend({
  id: z.string().uuid(),
  createdById: z.string().uuid(),
  status: statusSchema.shape.status,
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: user,
  allowedActions: z.object({
    canEdit: z.boolean(),
    canCancel: z.boolean(),
    nextStatuses: z.array(statusSchema.shape.status),
  }),
});
const meta = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
  hasNextPage: z.boolean(),
  hasPrevPage: z.boolean(),
});
const detail = request.extend({
  history: z.array(
    z.object({
      id: z.string(),
      action: z.string(),
      note: z.string().nullable(),
      createdAt: z.string(),
      actor: z.object({ id: z.string(), name: z.string() }),
    }),
  ),
  attachments: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      mimeType: z.string(),
      size: z.number(),
      createdAt: z.string(),
    }),
  ),
});
type Definition = {
  method: 'get' | 'post' | 'patch' | 'delete';
  path: string;
  summary: string;
  body?: z.ZodTypeAny;
  query?: z.AnyZodObject;
  response: z.ZodTypeAny;
  status?: number;
  public?: boolean;
};
const definitions: Definition[] = [
  {
    method: 'post',
    path: '/auth/register',
    summary: 'Register and sign in',
    body: registerSchema,
    response: user,
    status: 201,
    public: true,
  },
  {
    method: 'post',
    path: '/auth/login',
    summary: 'Sign in',
    body: loginSchema,
    response: user,
    public: true,
  },
  {
    method: 'post',
    path: '/auth/logout',
    summary: 'Invalidate session',
    response: z.null(),
    status: 204,
  },
  { method: 'get', path: '/auth/me', summary: 'Current user', response: user },
  {
    method: 'get',
    path: '/requests',
    summary: 'List visible requests',
    query: listSchema,
    response: z.object({ data: z.array(request), meta }),
  },
  {
    method: 'post',
    path: '/requests',
    summary: 'Create pending request',
    body: requestSchema,
    response: detail,
    status: 201,
  },
  {
    method: 'get',
    path: '/requests/stats',
    summary: 'Counts by status and category',
    response: z.object({
      total: z.number(),
      byStatus: z.array(z.object({ status: z.string(), _count: z.number() })),
      byCategory: z.array(z.object({ category: z.string(), _count: z.number() })),
    }),
  },
  {
    method: 'get',
    path: '/requests/{id}',
    summary: 'Request details and history',
    response: detail,
  },
  {
    method: 'patch',
    path: '/requests/{id}',
    summary: 'Edit own pending request',
    body: editSchema,
    response: detail,
  },
  { method: 'delete', path: '/requests/{id}', summary: 'Soft cancel request', response: detail },
  {
    method: 'patch',
    path: '/requests/{id}/status',
    summary: 'Admin status transition',
    body: statusSchema,
    response: detail,
  },
  {
    method: 'get',
    path: '/users',
    summary: 'Admin user directory',
    query: usersQuerySchema,
    response: z.object({ data: z.array(user), meta }),
  },
  {
    method: 'patch',
    path: '/users/{id}',
    summary: 'Admin role or activation change',
    body: userEditSchema,
    response: user,
  },
  {
    method: 'get',
    path: '/health',
    summary: 'Database readiness',
    response: z.object({ status: z.string() }),
    public: true,
  },
];
for (const d of definitions) {
  registry.registerPath({
    method: d.method,
    path: `/api${d.path}`,
    summary: d.summary,
    security: d.public ? [] : [{ session: [] }],
    request: {
      ...(d.path.includes('{id}') ? { params: z.object({ id: z.string().uuid() }) } : {}),
      ...(d.query ? { query: d.query } : {}),
      ...(d.body ? { body: { content: { 'application/json': { schema: d.body } } } } : {}),
    },
    responses: {
      [d.status ?? 200]: {
        description: 'Success',
        ...(d.status === 204
          ? {}
          : {
              content: {
                'application/json': {
                  schema:
                    (d.path === '/requests' && d.method === 'get') ||
                    (d.path === '/users' && d.method === 'get')
                      ? d.response
                      : z.object({ data: d.response }),
                },
              },
            }),
      },
      ...Object.fromEntries(
        [400, 401, 403, 404, 409, 429, 500].map((status) => [
          status,
          { description: 'Error', content: { 'application/json': { schema: error } } },
        ]),
      ),
    },
  });
}
registry.registerPath({
  method: 'post',
  path: '/api/requests/{id}/attachments',
  summary: 'Upload PDF, PNG or JPEG (5 MiB; five files per request)',
  security: [{ session: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({ file: z.string().openapi({ format: 'binary' }) }),
        },
      },
    },
  },
  responses: {
    201: { description: 'Attachment metadata' },
    400: { description: 'Invalid file' },
    413: { description: 'File too large' },
  },
});
registry.registerPath({
  method: 'get',
  path: '/api/requests/{id}/attachments/{attachmentId}',
  summary: 'Authorized attachment download',
  security: [{ session: [] }],
  request: { params: z.object({ id: z.string().uuid(), attachmentId: z.string().uuid() }) },
  responses: {
    200: { description: 'Binary attachment' },
    404: { description: 'Not found or not visible' },
  },
});
export const openapi = new OpenApiGeneratorV3(registry.definitions).generateDocument({
  openapi: '3.0.3',
  info: { title: 'Resolve Service Request API', version: '1.0.0' },
});
