import { openSqlite, databasePath } from '../db/local.ts';
import { migrate, rollbackEmpty } from '../db/migrations.ts';
import { seed } from '../db/seed.ts';
const command=process.argv[2];
try {
  if(command==='seed') console.log(`Categorias estruturais inseridas: ${await seed()}`);
  else if(command==='migrate'||command==='check'||command==='rollback') {
    const sqlite=openSqlite();
    try {
      if(command==='migrate') console.log({database:databasePath(),applied:migrate(sqlite)});
      else if(command==='rollback') {
        if(!process.argv.includes('--empty-only')) throw new Error('Rollback exige --empty-only e recusa qualquer dado.');
        rollbackEmpty(sqlite); console.log('Estrutura vazia revertida.');
      } else {
        const integrity=sqlite.prepare('PRAGMA integrity_check').get();
        const foreignKeys=sqlite.prepare('PRAGMA foreign_key_check').all();
        const violations=sqlite.prepare("SELECT regra FROM __integrity_violations UNION ALL SELECT 'rateio_proporcional' FROM __rateio_violations").all();
        if(integrity.integrity_check!=='ok'||foreignKeys.length||violations.length) throw new Error(JSON.stringify({integrity,foreignKeys,violations}));
        console.log({integrity:'ok',domainTables:sqlite.prepare("SELECT count(*) AS n FROM sqlite_schema WHERE type='table' AND substr(name,1,2)!='__' AND substr(name,1,7)!='sqlite_'").get().n,foreignKeys:0,violations:0});
      }
    } finally { sqlite.close(); }
  } else throw new Error('Use migrate, seed, check ou rollback --empty-only.');
} catch(error) { console.error(error.message); process.exitCode=1; }
