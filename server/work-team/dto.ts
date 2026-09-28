import { z } from 'zod';
import { domains } from '../../db/domains.ts';

const decimalString = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, 'Valor decimal inválido (use até duas casas).');
const dateString = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use AAAA-MM-DD).');

// Custo é derivado (quantidade × valorUnitario), nunca enviado (§4.20).
export const allocationCreateSchema = z.object({
  profissionalId: z.string().uuid(),
  funcao: z.string().trim().min(1).max(150),
  modalidade: z.enum(domains.modalidade).optional(),
  quantidade: decimalString.refine((value) => Number(value) > 0, { message: 'A quantidade deve ser maior que zero.' }),
  valorUnitario: decimalString.optional(),
  inicio: dateString.nullish().transform((value) => value || null),
  termino: dateString.nullish().transform((value) => value || null),
  atividadeIds: z.array(z.string().uuid()).optional(),
}).strict();

export const worksNestParamsSchema = z.object({ obraId: z.string().uuid() }).strict();
export const allocationParamsSchema = z.object({ obraId: z.string().uuid(), id: z.string().uuid() }).strict();

export type AllocationCreateDto = z.infer<typeof allocationCreateSchema>;
