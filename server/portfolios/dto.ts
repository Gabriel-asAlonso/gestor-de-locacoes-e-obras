import { z } from 'zod';

const optionalText = (maximum: number) => z.string().trim().max(maximum).nullish().transform((value) => value || null);

export const portfolioListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  sortBy: z.enum(['nome', 'codigo', 'createdAt']).default('nome'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
}).strict().refine((value) => Boolean(value.page) === Boolean(value.limit), { message: 'page e limit devem ser informados juntos.' });

export const portfolioCreateSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  titularNome: z.string().trim().min(1).max(200),
  titularDocumento: z.string().trim().min(1).max(32),
  gestorDescricao: optionalText(200),
  descricao: optionalText(5000),
  observacoes: optionalText(5000),
}).strict();

export const portfolioPatchSchema = portfolioCreateSchema.partial().refine((value) => Object.keys(value).length > 0, { message: 'Informe ao menos um campo.' });
export const portfolioIdSchema = z.object({ id: z.string().uuid() }).strict();
export type PortfolioCreateDto = z.infer<typeof portfolioCreateSchema>;
export type PortfolioPatchDto = z.infer<typeof portfolioPatchSchema>;
export type PortfolioListQuery = z.infer<typeof portfolioListQuerySchema>;
