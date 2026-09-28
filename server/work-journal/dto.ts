import { z } from 'zod';
import { domains } from '../../db/domains.ts';

export const journalParams = z.object({ obraId: z.string().uuid() }).strict();
export const journalEntryParams = z.object({ obraId: z.string().uuid(), id: z.string().uuid() }).strict();
export const journalQuerySchema = z.object({
  tipo: z.enum(domains.diario).optional(), dataInicio: z.iso.date().optional(), dataFim: z.iso.date().optional(),
}).strict();
export const journalCreateSchema = z.object({
  tipo: z.enum(domains.diario).default('atualizacao'), titulo: z.string().trim().min(1).max(200),
  descricao: z.string().trim().min(1).max(5000),
  progressoRegistrado: z.string().regex(/^\d+(?:\.\d{1,2})?$/).refine((value) => Number(value) <= 100).nullish(),
  proximaAtividadeDescricao: z.string().trim().min(1).max(500).nullish(),
}).strict();
export const pendingCreateSchema = z.object({
  titulo: z.string().trim().min(1).max(200), descricao: z.string().trim().min(1).max(5000),
  severidade: z.enum(domains.severidade).default('atencao'),
}).strict();
export type JournalCreateDto = z.infer<typeof journalCreateSchema>;
export type PendingCreateDto = z.infer<typeof pendingCreateSchema>;
