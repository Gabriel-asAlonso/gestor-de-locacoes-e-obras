import { z } from 'zod';
import { domains } from '../../db/domains.ts';

const decimalString = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, 'Valor decimal inválido (use até duas casas).');
const dateString = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use AAAA-MM-DD).');
const optionalText = (maximum: number) => z.string().trim().max(maximum).nullish().transform((value) => value || null);

// Uma contratação cria, atomicamente, despesa (origem=contratacao_obra) + especialização + vínculo ao fornecedor (D08).
export const contractCreateSchema = z.object({
  fornecedorId: z.string().uuid().nullish().transform((value) => value || null),
  fornecedorNome: z.string().trim().min(1).max(200).nullish().transform((value) => value || null),
  tipoFornecimento: z.enum(domains.fornecimento).optional(),
  descricao: z.string().trim().min(1).max(500),
  valorContratado: decimalString.refine((value) => Number(value) > 0, { message: 'O valor contratado deve ser maior que zero.' }),
  dataContratacao: dateString,
  vencimento: dateString,
  observacoes: optionalText(5000),
}).strict().refine((value) => Boolean(value.fornecedorId) || Boolean(value.fornecedorNome), { message: 'Informe o fornecedor (id ou nome).', path: ['fornecedorId'] });

export const contractPaymentSchema = z.object({
  dataPagamento: dateString,
  valor: decimalString,
  observacoes: optionalText(5000),
}).strict();

export const contractReversalSchema = z.object({ motivo: z.string().trim().min(1, 'Informe o motivo do estorno.').max(500) }).strict();

export const worksNestParamsSchema = z.object({ obraId: z.string().uuid() }).strict();
export const contractParamsSchema = z.object({ obraId: z.string().uuid(), id: z.string().uuid() }).strict();
export const contractPaymentParamsSchema = z.object({ obraId: z.string().uuid(), id: z.string().uuid(), pagId: z.string().uuid() }).strict();

export type ContractCreateDto = z.infer<typeof contractCreateSchema>;
export type ContractPaymentDto = z.infer<typeof contractPaymentSchema>;
