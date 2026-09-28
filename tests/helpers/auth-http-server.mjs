// Disposable integration-test process. Parent supplies an isolated migrated DB.
import { serve } from '@hono/node-server';
import { buildApp } from '../../server/app.ts';
const server = serve({ fetch: buildApp().fetch, hostname: '127.0.0.1', port: 0 }, ({ port }) => process.send?.({ port }));
process.on('message', message => { if (message === 'stop') server.close(() => process.exit(0)); });
process.on('disconnect', () => server.close(() => process.exit(0)));
