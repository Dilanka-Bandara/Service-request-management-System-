import { writeFile } from 'node:fs/promises';
import { openapi } from '../server/src/docs/openapi.js';
const examples: Record<string, object> = {
  '/api/auth/register': {
    name: 'Demo Member',
    email: 'demo@example.com',
    password: '{{password}}',
  },
  '/api/auth/login': { email: '{{email}}', password: '{{password}}' },
  '/api/auth/logout': {},
  '/api/requests': {
    title: 'VPN connection issue',
    description: 'The company VPN cannot establish a connection.',
    category: 'TECHNICAL',
    priority: 'HIGH',
  },
  '/api/requests/{id}': { title: 'Updated request summary' },
  '/api/requests/{id}/status': { status: 'IN_PROGRESS', note: 'Investigation started.' },
  '/api/users/{id}': { isActive: false },
};
const items = Object.entries(openapi.paths).flatMap(([path, methods]) =>
  Object.entries(methods ?? {})
    .filter(([method]) => ['get', 'post', 'patch', 'delete'].includes(method))
    .map(([method, operation]) => {
      const route = path
        .replace('{id}', path.includes('/users/') ? '{{userId}}' : '{{requestId}}')
        .replace('{attachmentId}', '{{attachmentId}}');
      const upload = path.endsWith('/attachments') && method === 'post';
      return {
        name:
          operation && typeof operation === 'object' && 'summary' in operation
            ? operation.summary
            : `${method} ${path}`,
        request: {
          method: method.toUpperCase(),
          url: `{{baseUrl}}${route}`,
          header: upload ? [] : [{ key: 'Content-Type', value: 'application/json' }],
          ...(upload
            ? { body: { mode: 'formdata', formdata: [{ key: 'file', type: 'file', src: [] }] } }
            : method !== 'get'
              ? {
                  body: {
                    mode: 'raw',
                    raw: JSON.stringify(method === 'delete' ? {} : (examples[path] ?? {}), null, 2),
                    options: { raw: { language: 'json' } },
                  },
                }
              : {}),
        },
      };
    }),
);
await writeFile('docs/openapi.json', JSON.stringify(openapi, null, 2) + '\n');
await writeFile(
  'docs/postman_collection.json',
  JSON.stringify(
    {
      info: {
        name: 'Resolve Service Request API',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        description:
          'Sign in first; Postman stores the session cookie. Set local variables; never export passwords.',
      },
      variable: [
        { key: 'baseUrl', value: 'http://localhost:4000' },
        { key: 'email', value: '' },
        { key: 'password', value: '' },
        { key: 'requestId', value: '' },
        { key: 'userId', value: '' },
        { key: 'attachmentId', value: '' },
      ],
      item: items,
    },
    null,
    2,
  ) + '\n',
);
