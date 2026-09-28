import { z } from 'zod';
import { domains } from '../../db/domains.ts';

const dateString = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use AAAA-MM-DD).');

export const activityCreateSchema = z.object({
  etapa: z.enum(domains.etapa).optional(),
  titulo: z.string().trim().min(1).max(200),
  responsavelProfissionalId: z.string().uuid(),
  inicio: dateString,
  termino: dateString,
}).strict().refine((value) => value.termino >= value.inicio, { message: 'O término deve ser posterior ao início.', path: ['termino'] });

export const activityBlockSchema = z.object({ motivo: z.string().trim().min(1, 'Informe o motivo do bloqueio.').max(500) }).strict();
export const activityReprogramSchema = z.object({
  novoInicio: dateString.nullish().transform((value) => value || null),
  novoTermino: dateString,
  justificativa: z.string().trim().min(1, 'Informe a justificativa.').max(500),
}).strict();

export const worksNestParamsSchema = z.object({ obraId: z.string().uuid() }).strict();
export const activityParamsSchema = z.object({ obraId: z.string().uuid(), id: z.string().uuid() }).strict();

export type ActivityCreateDto = z.infer<typeof activityCreateSchema>;
export type ActivityReprogramDto = z.infer<typeof activityReprogramSchema>;
