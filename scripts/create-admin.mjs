/**
 * Creates the initial administrador from environment variables — never a hard-coded
 * password. Idempotent: if the e-mail already exists, nothing changes.
 *
 * Usage (see .env.example):
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='strong-secret' ADMIN_NAME='Nome' npm run db:create-admin
 *
 * Reuses the centralised password hashing and the audited db/ write path (system
 * bootstrap context, so created_by is NULL as the model allows).
 */
import { createUser, findUserByEmail } from '../server/users/users.service.ts';

const email = process.env.ADMIN_EMAIL?.trim();
const senha = process.env.ADMIN_PASSWORD;
const nome = process.env.ADMIN_NAME?.trim() || 'Administrador';

if (!email || !senha) {
  console.error('Defina ADMIN_EMAIL e ADMIN_PASSWORD para criar o administrador inicial.');
  console.error("Exemplo: ADMIN_EMAIL=admin@exemplo.com ADMIN_PASSWORD='sua-senha-forte' npm run db:create-admin");
  process.exitCode = 1;
} else if (senha.length < 8) {
  console.error('ADMIN_PASSWORD deve ter ao menos 8 caracteres.');
  process.exitCode = 1;
} else {
  try {
    const existing = await findUserByEmail(email);
    if (existing) {
      console.log(`Usuário já existe: ${email} (nenhuma alteração).`);
    } else {
      const row = await createUser(
        { nome, email, senha, papelCodigo: 'master', status: 'ativo' },
        { system: 'bootstrap:admin:v1' },
      );
      console.log(`Administrador criado: ${row.email} (id ${row.id}).`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
