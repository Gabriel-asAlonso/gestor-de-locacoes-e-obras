/** Request schemas for the users module. `.strict()` blocks unknown/system-controlled fields. */
import { z } from 'zod';
import { ALL_PERMISSIONS } from '../permissions/permissions.ts';
import { domains } from '../../db/domains.ts';
const perfilCodigo = z.literal('usuario');

export const createUserSchema = z
  .object({
    nome: z.string().trim().min(1, 'Nome é obrigatório.').max(200),
    email: z.string().trim().toLowerCase().email('E-mail inválido.').max(254),
    senha: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.').max(200),
    perfilCodigo: perfilCodigo.optional(),
    ativo: z.boolean().optional(),
  })
  .strict()
  .refine((data) => data.perfilCodigo !== 'usuario' || data.ativo === true, {
    message: 'O perfil de usuário só pode ser atribuído a uma conta ativa.', path: ['ativo'],
  });

export const userIdParamSchema = z.object({ id: z.string().uuid('Identificador inválido.') }).strict();
export const userListQuerySchema = z.object({ status: z.enum(domains.usuarioStatus).optional() }).strict();
const permissionCode = z.enum([ALL_PERMISSIONS[0]!, ...ALL_PERMISSIONS.slice(1)]);
export const permissionSetSchema = z.object({
  permissoes: z.array(permissionCode).max(ALL_PERMISSIONS.length).refine(values => new Set(values).size === values.length, 'Permissões repetidas não são permitidas.'),
}).strict();

export type CreateUserDto = z.infer<typeof createUserSchema>;
