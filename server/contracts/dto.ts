import { z } from 'zod';
import { domains } from '../../db/domains.ts';

const optionalText = (maximum: number) => z.string().trim().max(maximum).nullish().transform((value) => value || null);
const dateString = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use AAAA-MM-DD).');
const optionalDate = z.string().trim().nullish().transform((value) => value?.trim() || null)
  .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), { message: 'Data inválida (use AAAA-MM-DD).' });
const optionalDecimal = z.string().trim().nullish().transform((value) => value?.trim() || null)
  .refine((value) => value === null || /^\d+(\.\d{1,2})?$/.test(value), { message: 'Valor decimal inválido (use até duas casas).' });

export const contractListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  carteiraId: z.string().uuid().optional(),
  imovelId: z.string().uuid().optional(),
  locatarioId: z.string().uuid().optional(),
  estado: z.enum(domains.contrato).optional(),
  sortBy: z.enum(['codigo', 'inicio', 'createdAt']).default('inicio'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
}).strict().refine((value) => Boolean(value.page) === Boolean(value.limit), { message: 'page e limit devem ser informados juntos.' });

export const contractCreateSchema = z.object({
  imovelId: z.string().uuid(),
  locatarioId: z.string().uuid(),
  unidadeIds: z.array(z.string().uuid()).min(1, 'Selecione ao menos uma unidade.'),
  inicio: dateString,
  terminoPrevisto: dateString,
  aluguelMensal: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, 'Aluguel inválido.'),
  diaVencimento: z.number().int().min(1).max(31),
  indiceReajuste: optionalText(40),
  mesReajuste: z.number().int().min(1).max(12).nullish(),
  formaPagamentoPrevista: z.enum(domains.pagamento).nullish(),
  formaPagamentoTexto: optionalText(40),
  observacoes: optionalText(5000),
  finalidade: optionalText(40),
  dataOcupacao: optionalDate,
  dataAssinatura: optionalDate,
  referenciaPagamento: optionalText(40),
  periodicidadeReajusteMeses: z.number().int().min(1).max(120).nullish(),
  multaAtrasoPercentual: optionalDecimal,
  jurosMensalPercentual: optionalDecimal,
  canalEnvio: optionalText(40),
  garantiaTipo: optionalText(60),
  garantiaDetalhe: optionalText(5000),
  regraPrimeiraCobranca: optionalText(60),
  nomeDocumento: optionalText(255),
  encargos: z.array(z.object({
    nome: z.string().trim().min(1).max(100),
    natureza: z.enum(domains.natureza),
    valorBase: optionalDecimal,
  })).min(1, 'Informe ao menos um item de composição.'),
}).strict().refine((value) => value.terminoPrevisto >= value.inicio, { message: 'O término deve ser posterior ao início.', path: ['terminoPrevisto'] })
  .refine((value) => value.encargos.filter((item) => item.natureza === 'aluguel').length <= 1, { message: 'Apenas um item de aluguel é permitido.', path: ['encargos'] });

export const contractIdSchema = z.object({ id: z.string().uuid() }).strict();
export type ContractListQuery = z.infer<typeof contractListQuerySchema>;
export type ContractCreateDto = z.infer<typeof contractCreateSchema>;
