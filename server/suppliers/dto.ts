import { z } from 'zod';

export const supplierListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
}).strict().refine((value) => Boolean(value.page) === Boolean(value.limit), { message: 'page e limit devem ser informados juntos.' });

// Fornecedor: o único dado de credor confirmado é o nome (contrato §4.13; não exigir CNPJ/banco/endereço).
export const supplierCreateSchema = z.object({ nome: z.string().trim().min(1).max(200) }).strict();
export const supplierIdSchema = z.object({ id: z.string().uuid() }).strict();

export type SupplierListQuery = z.infer<typeof supplierListQuerySchema>;
export type SupplierCreateDto = z.infer<typeof supplierCreateSchema>;
