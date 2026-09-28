import { z } from 'zod';
import { domains } from '../../db/domains.ts';

const optionalText = (maximum: number) => z.string().trim().max(maximum).nullish().transform((value) => value || null);
const optionalEmail = z.string().trim().max(254).nullish().transform((value) => value?.trim() || null)
  .refine((value) => value === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value), { message: 'E-mail inválido.' });

export const tenantListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  imobiliariaId: z.string().uuid().optional(),
  semImobiliaria: z.enum(['true', 'false']).optional(),
  sortBy: z.enum(['nome', 'codigo', 'createdAt']).default('nome'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
}).strict().refine((value) => Boolean(value.page) === Boolean(value.limit), { message: 'page e limit devem ser informados juntos.' });

export const tenantCreateSchema = z.object({
  tipoPessoa: z.enum(domains.pessoa).default('PJ'),
  nome: z.string().trim().min(1).max(200),
  documento: z.string().trim().min(1).max(32),
  nomeFantasia: optionalText(200),
  contatoNome: optionalText(200),
  telefone: optionalText(32),
  email: optionalEmail,
  imobiliariaId: z.string().uuid().nullish().transform((value) => value || null),
  canalPreferido: optionalText(40),
  enderecoCobranca: optionalText(500),
  inscricaoMunicipal: optionalText(80),
  observacoes: optionalText(5000),
}).strict();

export const tenantPatchSchema = tenantCreateSchema.partial().refine((value) => Object.keys(value).length > 0, { message: 'Informe ao menos um campo.' });
export const tenantIdSchema = z.object({ id: z.string().uuid() }).strict();
export type TenantListQuery = z.infer<typeof tenantListQuerySchema>;
export type TenantCreateDto = z.infer<typeof tenantCreateSchema>;
export type TenantPatchDto = z.infer<typeof tenantPatchSchema>;
