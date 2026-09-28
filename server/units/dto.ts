import { z } from 'zod';
import { domains } from '../../db/domains.ts';

const optionalText = (maximum: number) => z.string().trim().max(maximum).nullish().transform((value) => value || null);
const decimalString = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, 'Valor decimal inválido (use até duas casas).');
const optionalDecimal = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, 'Valor decimal inválido (use até duas casas).').nullish().transform((value) => value || null);

export const unitListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  imovelId: z.string().uuid().optional(),
  carteiraId: z.string().uuid().optional(),
  ocupada: z.enum(['true', 'false']).optional(),
  sortBy: z.enum(['nome', 'codigo', 'createdAt']).default('nome'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
}).strict().refine((value) => Boolean(value.page) === Boolean(value.limit), { message: 'page e limit devem ser informados juntos.' });

export const unitCreateSchema = z.object({
  imovelId: z.string().uuid(),
  nome: z.string().trim().min(1).max(200),
  tipo: z.enum(domains.unidade).default('sala_comercial'),
  areaPrivativa: decimalString,
  codigoComercial: optionalText(40),
  bloco: optionalText(120),
  andar: optionalText(60),
  areaTotal: optionalDecimal,
  inscricaoMunicipal: optionalText(80),
  observacoes: optionalText(5000),
}).strict();

export const unitPatchSchema = unitCreateSchema.partial().refine((value) => Object.keys(value).length > 0, { message: 'Informe ao menos um campo.' });
export const unitIdSchema = z.object({ id: z.string().uuid() }).strict();
export type UnitListQuery = z.infer<typeof unitListQuerySchema>;
export type UnitCreateDto = z.infer<typeof unitCreateSchema>;
export type UnitPatchDto = z.infer<typeof unitPatchSchema>;
