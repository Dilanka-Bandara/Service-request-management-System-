import { Router } from 'express';
import multer from 'multer';
import { authenticate, requireAdmin } from '../../middleware/authenticate.js';
import { idSchema, requestSchema, editSchema, listSchema, statusSchema } from '../schemas.js';
import * as service from './requests.service.js';
import * as files from './attachments.service.js';
export const requestsRouter = Router();
requestsRouter.use(authenticate);
requestsRouter.get('/', async (req, res) => {
  res.json(await service.list(res.locals.user, listSchema.parse(req.query)));
});
requestsRouter.post('/', async (req, res) => {
  res
    .status(201)
    .json({ data: await service.create(res.locals.user, requestSchema.parse(req.body)) });
});
requestsRouter.get('/stats', async (_req, res) => {
  res.json({ data: await service.stats(res.locals.user) });
});
requestsRouter.get('/:id', async (req, res) => {
  res.json({ data: await service.detail(res.locals.user, idSchema.parse(req.params.id)) });
});
requestsRouter.patch('/:id', async (req, res) => {
  res.json({
    data: await service.edit(
      res.locals.user,
      idSchema.parse(req.params.id),
      editSchema.parse(req.body),
    ),
  });
});
requestsRouter.delete('/:id', async (req, res) => {
  res.json({
    data: await service.transition(
      res.locals.user,
      idSchema.parse(req.params.id),
      'CANCELLED',
      undefined,
      true,
    ),
  });
});
requestsRouter.patch('/:id/status', requireAdmin, async (req, res) => {
  const input = statusSchema.parse(req.body);
  res.json({
    data: await service.transition(
      res.locals.user,
      idSchema.parse(req.params.id),
      input.status,
      input.note,
    ),
  });
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
});
requestsRouter.post('/:id/attachments', upload.single('file'), async (req, res) => {
  res
    .status(201)
    .json({ data: await files.attach(res.locals.user, idSchema.parse(req.params.id), req.file) });
});
requestsRouter.get('/:id/attachments/:attachmentId', async (req, res) => {
  const file = await files.download(
    res.locals.user,
    idSchema.parse(req.params.id),
    idSchema.parse(req.params.attachmentId),
  );
  res
    .set({
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${file.name}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    })
    .send(Buffer.from(file.content));
});
