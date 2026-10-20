import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/authenticate.js';
import { idSchema, usersQuerySchema, userEditSchema } from '../schemas.js';
import * as service from './users.service.js';
export const usersRouter = Router();
usersRouter.use(authenticate, requireAdmin);
usersRouter.get('/', async (req, res) => {
  res.json(await service.list(usersQuerySchema.parse(req.query)));
});
usersRouter.patch('/:id', async (req, res) => {
  res.json({
    data: await service.update(
      res.locals.user,
      idSchema.parse(req.params.id),
      userEditSchema.parse(req.body),
    ),
  });
});
