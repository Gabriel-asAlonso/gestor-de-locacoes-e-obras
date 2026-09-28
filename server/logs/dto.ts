import { z } from 'zod';

const optionalTrimmed = (max: number) => z.string().trim().min(1).max(max).optional();

export const logListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  userId: z.string().uuid().optional(),
  level: z.enum(['debug', 'info', 'warn', 'error', 'critical']).optional(),
  type: z.enum(['technical', 'authentication', 'security', 'business', 'audit']).optional(),
  eventCode: optionalTrimmed(100), entity: optionalTrimmed(64), operation: optionalTrimmed(40), requestId: optionalTrimmed(64),
}).strict();

export const logIdParamSchema = z.object({ id: z.string().uuid() }).strict();
export const clientErrorSchema = z.object({
  eventCode: z.string().trim().min(1).max(100),
  message: z.string().trim().min(1).max(2_000),
  stack: z.string().max(8_000).optional(),
  componentStack: z.string().max(8_000).optional(),
  route: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();
export type LogListQuery = z.infer<typeof logListQuerySchema>;
