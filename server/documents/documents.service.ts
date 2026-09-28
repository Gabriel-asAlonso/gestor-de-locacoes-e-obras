import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { and, eq } from 'drizzle-orm';
import { documento_imovel_vinculos, documentos, imoveis } from '../../db/schema.ts';
import { loadConfig } from '../config/env.ts';
import { BusinessRuleError, NotFoundError, ValidationError } from '../common/errors.ts';
import { withRead, withTransaction, type Audit, type WriteContext, type WriteDb } from '../database/connection.ts';
import { logger } from '../common/logger.ts';
import { EVENTS } from '../observability/event-codes.ts';

export const PROPERTY_DOCUMENT_TOPICS = [
  'property-contract', 'property-documentation', 'property-photos',
  'handover-inspection', 'maintenance', 'lease-contract',
] as const;
export type PropertyDocumentTopic = (typeof PROPERTY_DOCUMENT_TOPICS)[number];

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
};

function storageRoot() { return resolve(loadConfig().UPLOADS_PATH); }
function pathFor(key: string) {
  if (!/^[0-9a-f-]{36}\.(pdf|doc|docx|xls|xlsx|jpg|jpeg|png)$/.test(key)) throw new BusinessRuleError('Chave de armazenamento inválida.');
  return resolve(storageRoot(), key);
}

async function assertProperty(id: string) {
  const [row] = await withRead((db) => db.select({ id: imoveis.id }).from(imoveis)
    .where(and(eq(imoveis.id, id), eq(imoveis.ativo, true))).limit(1));
  if (!row) throw new NotFoundError('Imóvel não encontrado.');
}

export async function listPropertyDocuments(propertyId: string) {
  await assertProperty(propertyId);
  const data = await withRead((db) => db.select({
    id: documentos.id, nome: documentos.nome_original, mimeType: documentos.mime_type,
    tamanho: documentos.tamanho_bytes, hashSha256: documentos.hash_sha256,
    topico: documento_imovel_vinculos.topico, createdAt: documentos.created_at,
  }).from(documento_imovel_vinculos).innerJoin(documentos, eq(documentos.id, documento_imovel_vinculos.documento_id))
    .where(and(eq(documento_imovel_vinculos.imovel_id, propertyId), eq(documentos.estado, 'disponivel'))));
  return { data };
}

export async function addPropertyDocument(propertyId: string, topic: PropertyDocumentTopic, file: File, context: WriteContext) {
  await assertProperty(propertyId);
  const id = await persistLinkedFile(file, context, async (db, audit, documentId) => {
    await db.insert(documento_imovel_vinculos).values({
      documento_id: documentId, imovel_id: propertyId, topico: topic, created_by: audit.created_by,
    });
  });
  const { data } = await listPropertyDocuments(propertyId);
  return data.find((item) => item.id === id)!;
}

/** Shared file ingest: metadata and a typed link commit atomically; failed writes remove the orphan blob. */
export async function persistLinkedFile(file: File, context: WriteContext, link: (db: WriteDb, audit: Audit, documentId: string) => Promise<void>) {
  const extension = extname(file.name).slice(1).toLowerCase();
  const mimeType = MIME_BY_EXTENSION[extension];
  if (!mimeType) throw new ValidationError('Formato de arquivo não permitido.');
  if (!file.size || file.size > MAX_FILE_SIZE) throw new ValidationError('O arquivo deve ter entre 1 byte e 10 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = createHash('sha256').update(bytes).digest('hex');
  const key = `${randomUUID()}.${extension}`;
  const target = pathFor(key);
  try {
    await mkdir(storageRoot(), { recursive: true });
    await writeFile(target, bytes, { flag: 'wx' });
  } catch (error) {
    logger.error(EVENTS.FILE_OPERATION_FAILED, { operation: 'write', fileExtension: extension, size: file.size, error }, 'Falha ao armazenar documento.');
    throw new BusinessRuleError('Não foi possível armazenar o documento. Tente novamente.');
  }
  try {
    return await withTransaction(context, async (db, audit) => {
      const [document] = await db.insert(documentos).values({
        nome_original: file.name.slice(0, 255), estado: 'disponivel', mime_type: mimeType,
        tamanho_bytes: file.size, chave_armazenamento: key, hash_sha256: hash, created_by: audit.created_by,
      }).returning({ id: documentos.id });
      await link(db, audit, document!.id);
      return document!.id;
    });
  } catch (error) {
    await unlink(target).catch((cleanupError) => logger.warn(EVENTS.FILE_OPERATION_FAILED, {
      operation: 'cleanup', fileExtension: extension, cleanupError,
    }, 'Não foi possível remover arquivo órfão após rollback.'));
    throw error;
  }
}

export async function retirePropertyDocument(propertyId: string, documentId: string, context: WriteContext) {
  await assertProperty(propertyId);
  const [found] = await withRead((db) => db.select({ id: documentos.id }).from(documento_imovel_vinculos)
    .innerJoin(documentos, eq(documentos.id, documento_imovel_vinculos.documento_id))
    .where(and(eq(documento_imovel_vinculos.imovel_id, propertyId), eq(documentos.id, documentId), eq(documentos.estado, 'disponivel'))).limit(1));
  if (!found) throw new NotFoundError('Documento não encontrado neste imóvel.');
  await withTransaction(context, async (db, audit) => {
    await db.update(documentos).set({ estado: 'retirado', retirado_em: audit.updated_at, retirado_por: audit.updated_by })
      .where(eq(documentos.id, documentId));
  });
}

export async function readDocumentContent(documentId: string) {
  const [row] = await withRead((db) => db.select({
    id: documentos.id, nome: documentos.nome_original, mimeType: documentos.mime_type,
    key: documentos.chave_armazenamento,
  }).from(documentos).where(and(eq(documentos.id, documentId), eq(documentos.estado, 'disponivel'))).limit(1));
  if (!row?.key || !row.mimeType) throw new NotFoundError('Documento não encontrado.');
  try { return { id: row.id, nome: row.nome, mimeType: row.mimeType, bytes: await readFile(pathFor(row.key)) }; }
  catch (error) {
    logger.error(EVENTS.FILE_OPERATION_FAILED, { operation: 'read', documentId, error }, 'Falha ao ler conteúdo de documento.');
    throw new NotFoundError('Conteúdo do documento não está disponível.');
  }
}
