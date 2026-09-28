import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { obra_alocacoes_equipe, obra_atividades, obra_equipe_atividades, obras, profissionais } from '../../db/schema.ts';
import { nextCode } from '../common/codes.ts';
import { rethrowConflict } from '../common/database-errors.ts';
import { BusinessRuleError, NotFoundError } from '../common/errors.ts';
import { withRead, withTransaction, type ReadDb, type WriteContext } from '../database/connection.ts';
import type { AllocationCreateDto } from './dto.ts';

const selection = {
  id: obra_alocacoes_equipe.id, codigo: obra_alocacoes_equipe.codigo, obraId: obra_alocacoes_equipe.obra_id,
  profissionalId: obra_alocacoes_equipe.profissional_id, profissionalNome: profissionais.nome, funcao: obra_alocacoes_equipe.funcao,
  inicio: obra_alocacoes_equipe.inicio, termino: obra_alocacoes_equipe.termino, modalidade: obra_alocacoes_equipe.modalidade,
  quantidade: obra_alocacoes_equipe.quantidade, valorUnitario: obra_alocacoes_equipe.valor_unitario,
};

async function loadWork(obraId: string) {
  const [row] = await withRead((db) => db.select({ id: obras.id, inicio: obras.inicio_previsto, termino: obras.termino_previsto }).from(obras).where(eq(obras.id, obraId)).limit(1));
  if (!row) throw new NotFoundError('Obra não encontrada.');
  return row;
}

async function activeAllocations(db: ReadDb, obraId: string) {
  return db.select(selection).from(obra_alocacoes_equipe)
    .innerJoin(profissionais, eq(profissionais.id, obra_alocacoes_equipe.profissional_id))
    .where(and(eq(obra_alocacoes_equipe.obra_id, obraId), isNull(obra_alocacoes_equipe.removida_em)))
    .orderBy(asc(obra_alocacoes_equipe.codigo));
}

export async function listTeam(obraId: string) {
  await loadWork(obraId);
  return { data: await withRead((db) => activeAllocations(db, obraId)) };
}

export async function createAllocation(obraId: string, input: AllocationCreateDto, context: WriteContext) {
  const work = await loadWork(obraId);
  const [prof] = await withRead((db) => db.select({ id: profissionais.id }).from(profissionais).where(and(eq(profissionais.id, input.profissionalId), eq(profissionais.ativo, true))).limit(1));
  if (!prof) throw new NotFoundError('Profissional não encontrado ou inativo.');
  const inicio = input.inicio ?? work.inicio;
  const termino = input.termino ?? work.termino;
  if (termino < inicio) throw new BusinessRuleError('O término da alocação não pode ser anterior ao início.');
  // Atividades vinculadas (E25) devem pertencer à obra.
  if (input.atividadeIds?.length) {
    const owned = await withRead((db) => db.select({ id: obra_atividades.id }).from(obra_atividades).where(and(eq(obra_atividades.obra_id, obraId), inArray(obra_atividades.id, input.atividadeIds!))));
    if (owned.length !== new Set(input.atividadeIds).size) throw new BusinessRuleError('Uma ou mais atividades não pertencem a esta obra.');
  }

  try {
    await withTransaction(context, async (db, audit) => {
      const codes = await db.select({ codigo: obra_alocacoes_equipe.codigo }).from(obra_alocacoes_equipe).where(eq(obra_alocacoes_equipe.obra_id, obraId));
      const [row] = await db.insert(obra_alocacoes_equipe).values({
        obra_id: obraId, profissional_id: input.profissionalId, codigo: nextCode('EQP', codes.map((item) => item.codigo)), funcao: input.funcao,
        inicio, termino, modalidade: input.modalidade ?? 'horas', quantidade: input.quantidade, valor_unitario: input.valorUnitario ?? '0.00',
        created_by: audit.created_by, updated_by: audit.updated_by,
      }).returning({ id: obra_alocacoes_equipe.id });
      for (const atividadeId of input.atividadeIds ?? []) {
        await db.insert(obra_equipe_atividades).values({ alocacao_id: row!.id, atividade_id: atividadeId, created_by: audit.created_by });
      }
    });
    return { data: await withRead((db) => activeAllocations(db, obraId)) };
  } catch (error) { rethrowConflict(error, 'Conflito ao alocar o profissional.'); }
}

export async function removeAllocation(obraId: string, id: string, context: WriteContext) {
  const [row] = await withRead((db) => db.select({ id: obra_alocacoes_equipe.id, removidaEm: obra_alocacoes_equipe.removida_em }).from(obra_alocacoes_equipe)
    .where(and(eq(obra_alocacoes_equipe.id, id), eq(obra_alocacoes_equipe.obra_id, obraId))).limit(1));
  if (!row) throw new NotFoundError('Alocação não encontrada nesta obra.');
  if (row.removidaEm) throw new BusinessRuleError('Esta alocação já foi removida.');
  // Remoção lógica (auditada): preserva histórico/custo, não gera pagamento/despesa.
  await withTransaction(context, async (db, audit) => {
    await db.update(obra_alocacoes_equipe).set({ removida_em: audit.updated_at, updated_at: audit.updated_at, updated_by: audit.updated_by }).where(eq(obra_alocacoes_equipe.id, id));
  });
  return { data: await withRead((db) => activeAllocations(db, obraId)) };
}
