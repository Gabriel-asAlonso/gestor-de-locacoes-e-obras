/** Request schemas for authentication. `.strict()` blocks unexpected fields. */
import { z } from 'zod';

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('E-mail inválido.').max(254),
    senha: z.string().min(1, 'Senha é obrigatória.').max(200),
  })
  .strict();

export const registrationSchema = z
  .object({
    nome: z.string().trim().min(2, 'Informe o nome completo.').max(200),
    email: z.string().trim().toLowerCase().email('E-mail inválido.').max(254),
    senha: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.').max(200),
  })
  .strict();

export const refreshSchema = z
  .object({ refreshToken: z.string().min(1, 'Refresh token é obrigatório.').max(4096) })
  .strict();

export const logoutSchema = z
  .object({ refreshToken: z.string().min(1).max(4096).optional() })
  .strict();

export type LoginDto = z.infer<typeof loginSchema>;
export type RegistrationDto = z.infer<typeof registrationSchema>;
