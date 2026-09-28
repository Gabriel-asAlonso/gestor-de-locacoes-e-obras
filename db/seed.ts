import { openDatabase } from './local.ts';
import { categorias_despesa } from './schema.ts';
const categories = [
  ['condominio','Condomínio'], ['manutencao','Manutenção'], ['seguros','Seguros'],
  ['telecom','Telecom'], ['tributos','Tributos'], ['utilidades','Utilidades'], ['outros','Outros'],
] as const;
/** Structural catalogue only. No users, credentials, accounts, properties or financial fixtures. */
export async function seed(path?: string) {
  const database=openDatabase(path);
  try {
    return await database.transaction({system:'seed:categorias-despesa:v1'},async db=> {
      let inserted=0;
      for(const [codigo,nome] of categories) {
        inserted += (await db.insert(categorias_despesa).values({codigo,nome}).onConflictDoNothing({target:categorias_despesa.codigo}).returning({id:categorias_despesa.id})).length;
      }
      return inserted;
    });
  } finally { database.close(); }
}
