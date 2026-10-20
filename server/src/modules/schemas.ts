import { z } from 'zod';
import { statuses } from '../domain/request-status.js';
export const idSchema = z.string().uuid();
export const passwordSchema = z
  .string()
  .min(8)
  .max(72)
  .regex(/[A-Za-z]/, 'Include a letter')
  .regex(/\d/, 'Include a number');
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(1).max(72),
});
export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2).max(100),
  password: passwordSchema,
});
export const requestSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(10000),
  category: z.enum(['TECHNICAL', 'BILLING', 'ACCOUNT', 'OTHER']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
});
export const editSchema = requestSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field');
export const statusSchema = z.object({
  status: z.enum(statuses),
  note: z.string().trim().max(500).optional(),
});
export const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(100).optional(),
});
export const listSchema = pageSchema.extend({
  status: z.enum(statuses).optional(),
  category: requestSchema.shape.category.optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'priority', 'title']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export const usersQuerySchema = pageSchema.extend({
  role: z.enum(['USER', 'ADMIN']).optional(),
  isActive: z.enum(['true', 'false']).optional(),
});
export const userEditSchema = z
  .object({ role: z.enum(['USER', 'ADMIN']).optional(), isActive: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field');
export function pagination(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  };
}
