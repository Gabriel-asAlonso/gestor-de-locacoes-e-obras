import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../common/types.ts';
import { readParams } from '../common/validation.ts';
import { requireAuth } from '../auth/auth.middleware.ts';
import { requirePermission } from '../permissions/authorize.middleware.ts';
import { PERMISSIONS } from '../permissions/permissions.ts';
import { readDocumentContent } from './documents.service.ts';

export const documentsRoutes = new Hono<AppEnv>();
documentsRoutes.use('*', requireAuth);
documentsRoutes.get('/:id/conteudo', requirePermission(PERMISSIONS.DOCUMENTOS_LER), async (c) => {
  const { id } = readParams(c, z.object({ id: z.string().uuid() }).strict());
  const document = await readDocumentContent(id);
  const safeName = document.nome.replace(/[\r\n"]/g, '_');
  return new Response(document.bytes, { headers: {
    'Content-Type': document.mimeType,
    'Content-Disposition': `inline; filename="${safeName}"`,
    'Cache-Control': 'private, no-store',
  } });
});
