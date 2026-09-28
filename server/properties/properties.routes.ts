import { Hono } from 'hono';
import type { AppEnv } from '../common/types.ts';
import { created, ok } from '../common/http.ts';
import { NotFoundError } from '../common/errors.ts';
import { readJson, readParams, readQuery } from '../common/validation.ts';
import { requireAuth } from '../auth/auth.middleware.ts';
import { requirePermission } from '../permissions/authorize.middleware.ts';
import { PERMISSIONS } from '../permissions/permissions.ts';
import { propertyCreateSchema, propertyIdSchema, propertyListQuerySchema, propertyPatchSchema } from './dto.ts';
import { createProperty, findProperty, listProperties, updateProperty } from './properties.service.ts';
import { addPropertyDocument, listPropertyDocuments, PROPERTY_DOCUMENT_TOPICS, retirePropertyDocument } from '../documents/documents.service.ts';
import { ValidationError } from '../common/errors.ts';
import { noContent } from '../common/http.ts';
import { z } from 'zod';

export const propertiesRoutes = new Hono<AppEnv>();
propertiesRoutes.use('*', requireAuth);
propertiesRoutes.get('/', requirePermission(PERMISSIONS.IMOVEIS_LER), async (c) => c.json(await listProperties(readQuery(c, propertyListQuerySchema))));
propertiesRoutes.get('/:id', requirePermission(PERMISSIONS.IMOVEIS_LER), async (c) => { const row = await findProperty(readParams(c, propertyIdSchema).id); if (!row) throw new NotFoundError('Imóvel não encontrado.'); return ok(c, row); });
propertiesRoutes.post('/', requirePermission(PERMISSIONS.IMOVEIS_CRIAR), async (c) => created(c, await createProperty(await readJson(c, propertyCreateSchema), { actorId: c.get('user').id })));
propertiesRoutes.patch('/:id', requirePermission(PERMISSIONS.IMOVEIS_EDITAR), async (c) => ok(c, await updateProperty(readParams(c, propertyIdSchema).id, await readJson(c, propertyPatchSchema), { actorId: c.get('user').id })));
propertiesRoutes.get('/:id/documentos', requirePermission(PERMISSIONS.DOCUMENTOS_LER), async (c) => {
  const { id } = readParams(c, propertyIdSchema);
  return c.json(await listPropertyDocuments(id));
});
propertiesRoutes.post('/:id/documentos', requirePermission(PERMISSIONS.DOCUMENTOS_GERIR), async (c) => {
  const { id } = readParams(c, propertyIdSchema);
  const body = await c.req.parseBody();
  const topic = z.enum(PROPERTY_DOCUMENT_TOPICS).safeParse(body.topico);
  if (!topic.success || !(body.arquivo instanceof File)) throw new ValidationError('Informe o tópico e um arquivo válido.');
  return created(c, await addPropertyDocument(id, topic.data, body.arquivo, { actorId: c.get('user').id }));
});
propertiesRoutes.delete('/:id/documentos/:documentId', requirePermission(PERMISSIONS.DOCUMENTOS_GERIR), async (c) => {
  const params = readParams(c, z.object({ id: z.string().uuid(), documentId: z.string().uuid() }).strict());
  await retirePropertyDocument(params.id, params.documentId, { actorId: c.get('user').id });
  return noContent(c);
});
