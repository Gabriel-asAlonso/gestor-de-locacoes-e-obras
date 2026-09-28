import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
const folder = new URL('../drizzle/', import.meta.url);
interface MigrationEntry { idx: number; tag: string; when: number }
// 0009 was executed once locally before its SQL file was normalised. Keeping the
// exact historical checksum as an explicit alias lets that database advance
// without rewriting migration history. No other checksum mismatch is accepted.
const compatibleHistoricalHashes: Readonly<Record<string, readonly string[]>> = {
  '0009_observabilidade_e_correlacao': ['55c76233722a9da9028aa635c9b8ae514c7fac9b71cf131b08e0af02009ec915'],
};
function migrationHashMatches(tag: string, expected: string, stored: unknown): boolean {
  const storedHash = String(stored);
  return storedHash === expected || !!compatibleHistoricalHashes[tag]?.includes(storedHash);
}
export function migrationFiles() {
  const journal = JSON.parse(readFileSync(new URL('meta/_journal.json',folder),'utf8')) as { entries: MigrationEntry[] };
  return journal.entries.map(entry => {
    // Git may check out CRLF on Windows; line endings must not cause a false checksum mismatch.
    const content = readFileSync(new URL(`${entry.tag}.sql`,folder),'utf8').replaceAll('\r\n','\n');
    return { ...entry, content, hash: createHash('sha256').update(content).digest('hex'), path: fileURLToPath(new URL(`${entry.tag}.sql`,folder)) };
  });
}
export function migrate(sqlite: DatabaseSync) {
  const files = migrationFiles();
  sqlite.exec('BEGIN IMMEDIATE');
  try {
    sqlite.exec('CREATE TABLE IF NOT EXISTS __drizzle_migrations (id INTEGER PRIMARY KEY, tag TEXT NOT NULL UNIQUE, hash TEXT NOT NULL, created_at INTEGER NOT NULL)');
    const applied = sqlite.prepare('SELECT * FROM __drizzle_migrations ORDER BY id').all();
    for (const [index,row] of applied.entries()) {
      const file = files[index];
      const hashIsCompatible = !!file && migrationHashMatches(file.tag, file.hash, row['hash']);
      if (!file || row['id']!==file.idx || row['tag']!==file.tag || !hashIsCompatible) throw new Error('Historico de migrations divergiu; nao altere migrations ja aplicadas.');
    }
    for (const file of files.slice(applied.length)) {
      for (const statement of file.content.split('--> statement-breakpoint').filter(s=>s.trim())) sqlite.exec(statement);
      sqlite.prepare('INSERT INTO __drizzle_migrations(id,tag,hash,created_at) VALUES(?,?,?,?)').run(file.idx,file.tag,file.hash,file.when);
    }
    if(sqlite.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Migration deixou FKs invalidas.');
    sqlite.exec('COMMIT');
    return files.slice(applied.length).map(f=>f.tag);
  } catch(error) { if(sqlite.isTransaction) sqlite.exec('ROLLBACK'); throw error; }
}

/** Explicit development-only rollback; refuses to destroy a database with any domain/audit rows. */
export function rollbackEmpty(sqlite: DatabaseSync) {
  const domainNames = sqlite.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND substr(name,1,2)!='__' AND substr(name,1,7)!='sqlite_'").all();
  sqlite.exec('BEGIN IMMEDIATE');
  try {
    for(const row of domainNames) {
      const name=String(row['name']).replaceAll('"','""');
      if(sqlite.prepare(`SELECT 1 FROM "${name}" LIMIT 1`).get()) throw new Error('Rollback recusado: banco contem dados. Use somente banco descartavel vazio.');
    }
    const applied=sqlite.prepare('SELECT * FROM __drizzle_migrations ORDER BY id DESC').all();
    const files=migrationFiles();
    for(const row of applied) {
      const file=files.find(f=>f.idx===row['id']);
      if(!file || !migrationHashMatches(file.tag, file.hash, row['hash'])) throw new Error('Checksum da migration divergiu.');
      sqlite.exec(readFileSync(new URL(`rollback/${file.tag}.sql`,folder),'utf8'));
      sqlite.prepare('DELETE FROM __drizzle_migrations WHERE id=?').run(row['id'] as number);
    }
    sqlite.exec('DROP TABLE __drizzle_migrations; COMMIT;');
  } catch(error) { if(sqlite.isTransaction) sqlite.exec('ROLLBACK'); throw error; }
}
