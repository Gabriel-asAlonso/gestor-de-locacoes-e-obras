import { z } from 'zod';
import { domains } from '../../db/domains.ts';

const decimalString = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, 'Valor decimal inválido (use até duas casas).');
const dateString = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use AAAA-MM-DD).');
const optionalText = (maximum: number) => z.string().trim().max(maximum).nullish().transform((value) => value || null);

// saldoBase é fotografado pelo servidor sob bloqueio; total/financiado/parcelas são derivados (contrato §4.11).
const termsShape = {
  desconto: decimalString.default('0.00'),
  acrescimo: decimalString.default('0.00'),
  entradaPrevista: decimalString.default('0.00'),
  entradaVencimento: dateString.nullish().transform((value) => value || null),
  quantidadeParcelas: z.number().int().min(1).max(24),
  primeiroVencimento: dateString,
  dataAcordo: dateString,
  motivo: z.enum(domains.negociacaoMotivo),
  motivoOutro: optionalText(500),
  formaPagamentoPrevista: z.enum(domains.pagamento).nullish(),
  multa: decimalString.default('0.00'),
  juros: decimalString.default('0.00'),
  correcao: decimalString.default('0.00'),
  contatoNome: optionalText(200),
  contatoCanal: optionalText(40),
  documentoNome: optionalText(255),
  observacoes: optionalText(5000),
};
const requireEntradaVencimento = (value: { entradaPrevista: string; entradaVencimento: string | null }) =>
  Number(value.entradaPrevista) === 0 || value.entradaVencimento !== null;
const entradaVencimentoError = { message: 'Informe o vencimento da entrada quando houver entrada prevista.', path: ['entradaVencimento'] };

export const negotiationCreateSchema = z.object({ cobrancaId: z.string().uuid(), ...termsShape }).strict().refine(requireEntradaVencimento, entradaVencimentoError);
export const negotiationSubstituteSchema = z.object({ ...termsShape }).strict().refine(requireEntradaVencimento, entradaVencimentoError);

export const negotiationListQuerySchema = z.object({
  cobrancaId: z.string().uuid().optional(),
  vigente: z.enum(['true', 'false']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
}).strict().refine((value) => Boolean(value.page) === Boolean(value.limit), { message: 'page e limit devem ser informados juntos.' });

export const negotiationIdSchema = z.object({ id: z.string().uuid() }).strict();

export type NegotiationCreateDto = z.infer<typeof negotiationCreateSchema>;
export type NegotiationSubstituteDto = z.infer<typeof negotiationSubstituteSchema>;
export type NegotiationListQuery = z.infer<typeof negotiationListQuerySchema>;
