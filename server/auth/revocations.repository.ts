import { openSqlite } from '../../db/local.ts';

/** Unique insertion is the atomic claim, including across backend processes. */
export function consumeToken(jti: string, expiresAt: number): boolean {
  const sqlite = openSqlite();
  try {
    const result = sqlite.prepare('INSERT INTO __auth_revocations(jti, expires_at) VALUES (?, ?) ON CONFLICT(jti) DO NOTHING').run(jti, expiresAt);
    // Expired tokens already fail JWT validation; bounded cleanup keeps logouts cheap.
    sqlite.prepare('DELETE FROM __auth_revocations WHERE jti IN (SELECT jti FROM __auth_revocations WHERE expires_at < ? LIMIT 200)').run(Math.floor(Date.now() / 1000));
    return result.changes === 1;
  } finally { sqlite.close(); }
}

export function isTokenRevoked(jti: string): boolean {
  const sqlite = openSqlite();
  try {
    return Boolean(sqlite.prepare('SELECT 1 FROM __auth_revocations WHERE jti = ?').get(jti));
  } finally { sqlite.close(); }
}
