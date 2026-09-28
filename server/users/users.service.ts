/**
 * Users data access. Reads/writes go through the audited db/ layer. Only fields that
 * exist in the modelled `usuarios` table are used. `perfil_codigo` is retained only as
 * a compatibility column; `papel_codigo` is the authoritative role for authorization.
 */
import { eq, sql } from 'drizzle-orm';
import { usuarios } from '../../db/schema.ts';
import { withRead, withTransaction, type WriteContext } from '../database/connection.ts';
import { hashPassword } from '../auth/password.ts';
import { ConflictError } from '../common/errors.ts';
import type { DomainCode } from '../../db/domains.ts';

export type UsuarioRow = typeof usuarios.$inferSelect;

export interface CreateUserInput {
  nome: string;
  email: string;
  senha: string;
  papelCodigo?: 'master' | 'usuario';
  /** Legacy bootstrap input; `administrador` is mapped to the Master role. */
  perfilCodigo?: string | null;
  status?: DomainCode<'usuarioStatus'>;
  /** Compatibility input while older administrative callers still send `ativo`. */
  ativo?: boolean;
}

const normalizedEmail = (email: string) => email.trim().toLowerCase();

export async function findUserByEmail(email: string): Promise<UsuarioRow | null> {
  const rows = await withRead((db) =>
    db.select().from(usuarios).where(sql`lower(trim(${usuarios.email})) = ${normalizedEmail(email)}`).limit(1),
  );
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UsuarioRow | null> {
  const rows = await withRead((db) => db.select().from(usuarios).where(eq(usuarios.id, id)).limit(1));
  return rows[0] ?? null;
}

export async function listUsers(status?: DomainCode<'usuarioStatus'>): Promise<UsuarioRow[]> {
  return withRead((db) => {
    const query = db.select().from(usuarios);
    return (status ? query.where(eq(usuarios.status, status)) : query).orderBy(usuarios.created_at);
  });
}

/**
 * Creates a user through an audited transaction. `context` carries the acting user
 * (actorId) or a system process name for bootstrap. Duplicate e-mail → 409.
 */
export async function createUser(input: CreateUserInput, context: WriteContext): Promise<UsuarioRow> {
  const status = input.status ?? (input.ativo === true ? 'ativo' : input.ativo === false ? 'inativo' : 'pendente');
  const ativo = status === 'ativo';
  const papelCodigo = input.papelCodigo ?? (input.perfilCodigo === 'administrador' ? 'master' : 'usuario');
  if (input.ativo !== undefined && input.ativo !== ativo) {
    throw new Error('Status e indicador de atividade do usuário são incompatíveis.');
  }
  const senha_hash = await hashPassword(input.senha);
  try {
    const rows = await withTransaction(context, async (db, audit) =>
      db
        .insert(usuarios)
        .values({
          nome: input.nome.trim(),
          email: input.email.trim(),
          senha_hash,
          perfil_codigo: ativo ? 'administrador' : null,
          papel_codigo: papelCodigo,
          status,
          ativo,
          created_by: audit.created_by,
          updated_by: audit.updated_by,
        })
        .returning(),
    );
    return rows[0]!;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ConflictError('Já existe um usuário com este e-mail.', [
        { field: 'email', rule: 'unico', message: 'E-mail já cadastrado.' },
      ]);
    }
    throw err;
  }
}

/**
 * The only user-controlled unique key on `usuarios` is the normalised e-mail.
 * Drizzle wraps the driver error, so walk the `cause` chain to find the SQLite message.
 */
function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < 6 && current; depth += 1) {
    const message = current instanceof Error ? current.message : String(current);
    if (/unique constraint failed/i.test(message)) return true;
    current = current instanceof Error ? (current as { cause?: unknown }).cause : undefined;
  }
  return false;
}
