import { z } from 'zod';
import { domains } from '../../db/domains.ts';

const decimalString = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, 'Valor decimal inválido (use até duas casas).');
const dateString = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use AAAA-MM-DD).');
const optionalText = (maximum: number) => z.string().trim().max(maximum).nullish().transform((value) => value || null);

export const receiptListQuerySchema = z.object({
  cobrancaId: z.string().uuid().optional(),
  contaFinanceiraId: z.string().uuid().optional(),
  dataInicio: dateString.optional(),
  dataFim: dateString.optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
}).strict().refine((value) => Boolean(value.page) === Boolean(value.limit), { message: 'page e limit devem ser informados juntos.' });

export const receiptCreateSchema = z.object({
  cobrancaId: z.string().uuid(),
  dataRecebimento: dateString,
  dataCredito: dateString.nullish().transform((value) => value || null),
  valor: decimalString,
  valorRecebido: decimalString.nullish().transform((value) => value || null),
  desconto: decimalString.default('0.00'),
  acrescimo: decimalString.default('0.00'),
  formaPagamento: z.enum(domains.pagamento).nullish(),
  contaFinanceiraId: z.string().uuid().nullish().transform((value) => value || null),
  contaDescricao: optionalText(200),
  referencia: optionalText(250),
  pagadorDescricao: optionalText(200),
  comprovanteNome: optionalText(255),
  observacoes: optionalText(5000),
  // Cada linha aponta para UM alvo (item da cobrança XOR parcela do acordo). Soma == valor (regra do banco).
  alocacoes: z.array(z.object({
    cobrancaItemId: z.string().uuid().nullish().transform((value) => value || null),
    negociacaoParcelaId: z.string().uuid().nullish().transform((value) => value || null),
    valor: decimalString,
  }).refine((value) => Boolean(value.cobrancaItemId) !== Boolean(value.negociacaoParcelaId), { message: 'Cada alocação aponta para um item da cobrança OU uma parcela do acordo.' })).min(1, 'Informe ao menos uma alocação.'),
}).strict();

export const receiptReversalSchema = z.object({ motivo: z.string().trim().min(1, 'Informe o motivo do estorno.').max(500) }).strict();
export const receiptIdSchema = z.object({ id: z.string().uuid() }).strict();

export type ReceiptListQuery = z.infer<typeof receiptListQuerySchema>;
export type ReceiptCreateDto = z.infer<typeof receiptCreateSchema>;
export type ReceiptReversalDto = z.infer<typeof receiptReversalSchema>;
