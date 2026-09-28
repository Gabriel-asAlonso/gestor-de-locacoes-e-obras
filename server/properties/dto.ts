import { z } from 'zod';
import { domains } from '../../db/domains.ts';

const optionalText = (maximum: number) => z.string().trim().max(maximum).nullish().transform((value) => value || null);
export const propertyListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(), carteiraId: z.string().uuid().optional(),
  sortBy: z.enum(['nome', 'codigo', 'createdAt']).default('nome'), sortOrder: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).optional(), limit: z.coerce.number().int().min(1).max(200).optional(),
}).strict().refine((value) => Boolean(value.page) === Boolean(value.limit), { message: 'page e limit devem ser informados juntos.' });

export const propertyCreateSchema = z.object({
  carteiraId: z.string().uuid(), nome: z.string().trim().min(1).max(200), endereco: z.string().trim().min(1).max(500),
  tipo: z.enum(domains.imovel).default('edificio_comercial'), cep: optionalText(16), logradouro: optionalText(200),
  numero: optionalText(40), complemento: optionalText(120), bairro: optionalText(120), cidade: optionalText(120),
  uf: z.string().trim().toUpperCase().length(2).nullish().transform((value) => value || null),
  inscricaoMunicipal: optionalText(80), matricula: optionalText(80), cartorioRegistro: optionalText(200),
  gestorDescricao: optionalText(200), observacoes: optionalText(5000),
}).strict();
export const propertyPatchSchema = propertyCreateSchema.partial().refine((value) => Object.keys(value).length > 0, { message: 'Informe ao menos um campo.' });
export const propertyIdSchema = z.object({ id: z.string().uuid() }).strict();
export type PropertyListQuery = z.infer<typeof propertyListQuerySchema>;
export type PropertyCreateDto = z.infer<typeof propertyCreateSchema>;
export type PropertyPatchDto = z.infer<typeof propertyPatchSchema>;
