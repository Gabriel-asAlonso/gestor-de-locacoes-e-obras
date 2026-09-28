# Observabilidade e auditoria

## O que fica registrado

- **Auditoria persistente:** alterações no SQLite, com ator, operação, entidade, data, motivo, campos relevantes e `requestId`.
- **Logs técnicos:** requisições, falhas, autenticação, segurança e eventos do processo em JSON estruturado.
- **Erros do navegador:** falhas globais e promessas rejeitadas são enviadas, de forma autenticada e sanitizada, para o backend.

Senhas, tokens, cookies, cabeçalhos de autorização, chaves de armazenamento, hashes e textos que aparentem conter credenciais são removidos pelo sanitizador. Os snapshots novos de auditoria usam uma lista reduzida de campos relevantes. Registros históricos anteriores à migração `0010` são identificados como `AUDIT_LEGACY` e foram preservados para não destruir evidências existentes.

## Correlação e acesso

Toda requisição recebe `X-Request-Id`. O mesmo identificador acompanha o log técnico, a transação e o evento de auditoria, permitindo reconstruir o fluxo de ponta a ponta. Um identificador enviado pelo cliente só é aceito quando respeita o formato seguro; caso contrário, a API gera um UUID.

A tela **Logs e auditoria** requer `logs:auditoria:ler`. A aba técnica e seus indicadores requerem separadamente `logs:tecnicos:ler`. O perfil master recebe ambas pelo catálogo central de permissões.

Endpoints administrativos:

- `GET /api/logs/summary`
- `GET /api/logs/audit` e `GET /api/logs/audit/:id`
- `GET /api/logs/technical` e `GET /api/logs/technical/:id`
- `POST /api/logs/client-errors`

## Operação e retenção

Os eventos técnicos são escritos em `stdout`/`stderr` em JSON e a interface mantém os 1.000 eventos mais recentes do processo atual. Em produção, o runtime deve coletar a saída para um serviço centralizado; a memória do processo não é a fonte definitiva e é reiniciada com a aplicação. A auditoria do banco é persistente.

Política recomendada para o coletor externo:

- `debug`: desabilitado em produção ou retenção de até 7 dias;
- `info`: 30 dias;
- `warn` e `error`: 90 dias;
- `critical` e eventos de segurança: 180 dias ou conforme a política jurídica da organização;
- auditoria de negócio: prazo definido com jurídico/compliance, com acesso restrito e cópia protegida.

Alertas recomendados:

- qualquer evento `critical`;
- aumento de `AUTH_LOGIN_FAILED` ou bloqueios por rate limit;
- sequência de respostas 5xx;
- falha de conexão, schema ou migração do banco;
- volume anormal de negativas de permissão.

`LOG_LEVEL` define o menor nível emitido (`debug`, `info`, `warn`, `error` ou `critical`). Nunca ative `debug` permanentemente em produção sem revisar custo e retenção.

## Validação

```powershell
npm run db:migrate
npm run db:check
npm run api:typecheck
npm run typecheck:frontend
npm run api:test
npm run test:client
npm run test:db
```

No Windows sem Bash/WSL, execute o lint com `npx.cmd eslint . --ignore-pattern dist --ignore-pattern .next` e o build com `node node_modules/vinext/dist/cli.js build`.
