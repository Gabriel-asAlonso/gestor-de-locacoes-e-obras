import { z } from 'zod';

const decimalString = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, 'Valor decimal inválido (use até duas casas).');
const dateString = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use AAAA-MM-DD).');
const percent = decimalString.refine((value) => Number(value) > 0 && Number(value) <= 100, { message: 'Percentual deve estar entre 0 (exclusivo) e 100.' });
const positive = decimalString.refine((value) => Number(value) > 0, { message: 'O valor deve ser maior que zero.' });

/** Vincular um sócio à obra (participação corrente). Nome resolve buscar-ou-criar. */
export const partnerCreateSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  percentual: percent,
}).strict();

/** Alterar a participação corrente (nova versão preservando o histórico). */
export const participationPatchSchema = z.object({ percentual: percent }).strict();

/** Solicitar um aporte — o rateio pelas participações correntes é calculado no servidor. */
export const contributionCreateSchema = z.object({
  descricao: z.string().trim().min(1).max(500),
  valorSolicitado: positive,
  dataSolicitacao: dateString,
}).strict();

/** Registrar pagamento de uma cota (parcial ou total). */
export const contributionPaymentSchema = z.object({
  valor: positive,
  dataPagamento: dateString,
  observacoes: z.string().trim().max(500).nullish().transform((value) => value || null),
}).strict();

export const worksNestParamsSchema = z.object({ obraId: z.string().uuid() }).strict();
export const socioParamsSchema = z.object({ obraId: z.string().uuid(), socioId: z.string().uuid() }).strict();
export const aporteParamsSchema = z.object({ obraId: z.string().uuid(), aporteId: z.string().uuid() }).strict();
export const cotaParamsSchema = z.object({ obraId: z.string().uuid(), aporteId: z.string().uuid(), cotaId: z.string().uuid() }).strict();

export type PartnerCreateDto = z.infer<typeof partnerCreateSchema>;
export type ParticipationPatchDto = z.infer<typeof participationPatchSchema>;
export type ContributionCreateDto = z.infer<typeof contributionCreateSchema>;
export type ContributionPaymentDto = z.infer<typeof contributionPaymentSchema>;
