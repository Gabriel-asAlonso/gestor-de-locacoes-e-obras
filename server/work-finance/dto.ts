import { z } from 'zod';

export const workFinanceParams = z.object({ obraId: z.string().uuid() }).strict();
export const adjustmentParams = z.object({ obraId: z.string().uuid(), id: z.string().uuid() }).strict();
export const adjustmentCreateSchema = z.object({
  dataMovimento: z.iso.date(), descricao: z.string().trim().min(1).max(500),
  valorAssinado: z.string().regex(/^-?\d+(?:\.\d{1,2})?$/).refine((value) => Number(value) !== 0, 'O ajuste não pode ser zero.'),
}).strict();
export const adjustmentReverseSchema = z.object({ motivo: z.string().trim().min(1).max(500) }).strict();
export type AdjustmentCreateDto = z.infer<typeof adjustmentCreateSchema>;
