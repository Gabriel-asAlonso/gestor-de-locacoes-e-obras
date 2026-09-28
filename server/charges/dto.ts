import { z } from 'zod';
import { domains } from '../../db/domains.ts';

const decimalString = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, 'Valor decimal inválido (use até duas casas).');
const dateString = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use AAAA-MM-DD).');
const optionalText = (maximum: number) => z.string().trim().max(maximum).nullish().transform((value) => value || null);

export const chargeListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  contratoId: z.string().uuid().optional(),
  carteiraId: z.string().uuid().optional(),
  imovelId: z.string().uuid().optional(),
  locatarioId: z.string().uuid().optional(),
  competencia: dateString.optional(),
  status: z.string().trim().max(40).optional(),
  sortBy: z.enum(['codigo', 'competencia', 'createdAt']).default('competencia'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
}).strict().refine((value) => Boolean(value.page) === Boolean(value.limit), { message: 'page e limit devem ser informados juntos.' });

export const chargeCreateSchema = z.object({
  contratoId: z.string().uuid(),
  // Emitida por competência: dia sempre 01 (CHECK no banco); única por contrato/competência (D06).
  competencia: dateString.refine((value) => value.endsWith('-01'), { message: 'A competência deve ser o primeiro dia do mês (AAAA-MM-01).' }),
  formaPagamentoPrevista: z.enum(domains.pagamento).nullish(),
  observacoes: optionalText(5000),
  // Snapshots emitidos: nome/natureza/valor/vencimento fotografados (revisados pelo cliente, não inventados — D05).
  itens: z.array(z.object({
    ordem: z.number().int().min(1),
    nome: z.string().trim().min(1).max(100),
    natureza: z.enum(domains.natureza),
    vencimento: dateString,
    valor: decimalString,
    contratoEncargoId: z.string().uuid().nullish().transform((value) => value || null),
    referencia: optionalText(250),
  })).min(1, 'Emita ao menos um item na cobrança.'),
}).strict();

export const chargeIdSchema = z.object({ id: z.string().uuid() }).strict();

export type ChargeListQuery = z.infer<typeof chargeListQuerySchema>;
export type ChargeCreateDto = z.infer<typeof chargeCreateSchema>;
