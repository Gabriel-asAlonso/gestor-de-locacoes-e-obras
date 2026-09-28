// Local UI-test fixture only: never reads .env and never writes the application DB.
import { prepare } from '../server/setup.mjs';
import { serve } from '@hono/node-server';
const { app } = await prepare();
const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 3171 }, () => {
  process.stdout.write('Auth UI fixture ready on 127.0.0.1:3171 (isolated test database).\n');
});
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
