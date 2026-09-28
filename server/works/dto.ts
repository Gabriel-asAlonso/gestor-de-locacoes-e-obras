import { z } from 'zod';
import { domains } from '../../db/domains.ts';

const decimalString = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, 'Valor decimal inválido (use até duas casas).');
const percent = decimalString.refine((value) => Number(value) >= 0 && Number(value) <= 100, { message: 'Percentual deve estar entre 0 e 100.' });
const dateString = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use AAAA-MM-DD).');
const optionalText = (maximum: number) => z.string().trim().max(maximum).nullish().transform((value) => value || null);

export const workListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  estado: z.enum(domains.obra).optional(),
  riscoInformado: z.enum(domains.risco).optional(),
  imovelId: z.string().uuid().optional(),
  responsavelProfissionalId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
}).strict().refine((value) => Boolean(value.page) === Boolean(value.limit), { message: 'page e limit devem ser informados juntos.' });

export const workCreateSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  imovelId: z.string().uuid(),
  responsavelProfissionalId: z.string().uuid(),
  descricao: z.string().trim().min(1, 'Informe a descrição da obra.').max(5000),
  inicioPrevisto: dateString,
  terminoPrevisto: dateString,
  orcamento: decimalString,
  unidadeId: z.string().uuid().nullish().transform((value) => value || null),
  tipoIntervencao: z.enum(domains.intervencao).optional(),
  prioridade: z.enum(domains.prioridade).optional(),
  // Só planejada ou em_andamento na criação; concluir/pausar/cancelar são transições por ação.
  estado: z.enum(['planejada', 'em_andamento']).optional(),
  riscoInformado: z.enum(domains.risco).optional(),
  reserva: decimalString.optional(),
  realizadoInformado: decimalString.optional(),
  proximaAtividadeDescricao: optionalText(500),
  observacoes: optionalText(5000),
}).strict().refine((value) => value.terminoPrevisto >= value.inicioPrevisto, { message: 'O término deve ser posterior ao início.', path: ['terminoPrevisto'] });

export const workUpdateSchema = z.object({
  titulo: z.string().trim().min(1).max(200).optional(),
  imovelId: z.string().uuid().optional(),
  responsavelProfissionalId: z.string().uuid().optional(),
  descricao: z.string().trim().min(1).max(5000).optional(),
  inicioPrevisto: dateString.optional(),
  terminoPrevisto: dateString.optional(),
  orcamento: decimalString.optional(),
  unidadeId: z.string().uuid().nullish().transform((value) => value || null),
  tipoIntervencao: z.enum(domains.intervencao).optional(),
  prioridade: z.enum(domains.prioridade).optional(),
  riscoInformado: z.enum(domains.risco).optional(),
  reserva: decimalString.optional(),
  realizadoInformado: decimalString.optional(),
  proximaAtividadeDescricao: optionalText(500),
  observacoes: optionalText(5000),
}).strict();

export const workProgressSchema = z.object({
  progressoPercentual: percent,
  proximaAtividadeDescricao: optionalText(500),
}).strict();

export const workStateSchema = z.object({
  estado: z.enum(domains.obra),
  motivo: optionalText(500),
}).strict();

export const workIdSchema = z.object({ id: z.string().uuid() }).strict();

export type WorkListQuery = z.infer<typeof workListQuerySchema>;
export type WorkCreateDto = z.infer<typeof workCreateSchema>;
export type WorkUpdateDto = z.infer<typeof workUpdateSchema>;
export type WorkProgressDto = z.infer<typeof workProgressSchema>;
export type WorkStateDto = z.infer<typeof workStateSchema>;
