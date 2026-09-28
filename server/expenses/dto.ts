import { z } from 'zod';
import { domains } from '../../db/domains.ts';

const decimalString = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, 'Valor decimal inválido (use até duas casas).');
const dateString = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use AAAA-MM-DD).');
const optionalText = (maximum: number) => z.string().trim().max(maximum).nullish().transform((value) => value || null);

export const expenseListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.enum(['Pendente', 'Pago', 'Vencido']).optional(),
  categoriaId: z.string().uuid().optional(),
  fornecedorId: z.string().uuid().optional(),
  dataInicio: dateString.optional(),
  dataFim: dateString.optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
}).strict().refine((value) => Boolean(value.page) === Boolean(value.limit), { message: 'page e limit devem ser informados juntos.' });

// Origem fixa 'operacao' neste endpoint (despesa de obra é criada por /api/obras/:id/contratacoes — D08).
export const expenseCreateSchema = z.object({
  fornecedorId: z.string().uuid(),
  categoriaId: z.string().uuid(),
  descricao: z.string().trim().min(1).max(500),
  valor: decimalString,
  competencia: z.string().trim().regex(/^\d{4}-\d{2}$/, 'Competência inválida (use AAAA-MM).').nullish().transform((value) => value || null),
  vencimento: dateString,
  previsaoPagamento: dateString.nullish().transform((value) => value || null),
  alocacaoTipo: optionalText(40),
  alocacaoReferencia: optionalText(100),
  tipoLancamento: optionalText(40),
  recorrencia: optionalText(100),
  tipoDocumento: optionalText(40),
  numeroDocumento: optionalText(100),
  dataEmissao: dateString.nullish().transform((value) => value || null),
  anexoNome: optionalText(255),
  formaPagamentoPrevista: z.enum(domains.pagamento).nullish(),
  contaFinanceiraPrevistaId: z.string().uuid().nullish().transform((value) => value || null),
  contaDescricaoPrevista: optionalText(200),
  observacoes: optionalText(5000),
}).strict();

export const paymentCreateSchema = z.object({
  dataPagamento: dateString,
  valor: decimalString,
  formaPagamento: z.enum(domains.pagamento).nullish(),
  contaFinanceiraId: z.string().uuid().nullish().transform((value) => value || null),
  observacoes: optionalText(5000),
}).strict();

export const paymentReversalSchema = z.object({ motivo: z.string().trim().min(1, 'Informe o motivo do estorno.').max(500) }).strict();
export const expenseIdSchema = z.object({ id: z.string().uuid() }).strict();
export const paymentParamsSchema = z.object({ id: z.string().uuid(), pagId: z.string().uuid() }).strict();

export type ExpenseListQuery = z.infer<typeof expenseListQuerySchema>;
export type ExpenseCreateDto = z.infer<typeof expenseCreateSchema>;
export type PaymentCreateDto = z.infer<typeof paymentCreateSchema>;
