import { eq, isNull } from 'drizzle-orm';
import { imoveis, obra_atividades, obra_pendencias, obras, profissionais } from '../../db/schema.ts';
import { withRead } from '../database/connection.ts';
import { allWorkFinances } from '../work-finance/finance.service.ts';

/** The modeled `obra_compromissos` table is intentionally absent (D15); dates come from open activities. */
export async function workPanel() {
  const [workRows, activityRows, pendingRows, finances] = await Promise.all([
    withRead((db) => db.select({ id: obras.id, codigo: obras.codigo, titulo: obras.titulo,
      propriedade: imoveis.nome, estado: obras.estado, termino: obras.termino_previsto,
    }).from(obras).innerJoin(imoveis, eq(imoveis.id, obras.imovel_id))),
    withRead((db) => db.select({ id: obra_atividades.id, obraId: obra_atividades.obra_id,
      titulo: obra_atividades.titulo, termino: obra_atividades.termino, estado: obra_atividades.estado,
      responsavel: profissionais.nome,
    }).from(obra_atividades).innerJoin(profissionais, eq(profissionais.id, obra_atividades.responsavel_profissional_id))),
    withRead((db) => db.select({ id: obra_pendencias.id, obraId: obra_pendencias.obra_id,
      titulo: obra_pendencias.titulo, descricao: obra_pendencias.descricao,
      severidade: obra_pendencias.severidade,
    }).from(obra_pendencias).where(isNull(obra_pendencias.resolvida_em))),
    allWorkFinances(),
  ]);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const workById = new Map(workRows.map((row) => [row.id, row]));
  const financeByWork = new Map(finances.data.map((row) => [row.obraId, row]));
  const active = (obraId: string) => {
    const work = workById.get(obraId);
    return work && work.estado !== 'concluida' && work.estado !== 'cancelada' ? work : null;
  };
  const attentions = [
    ...pendingRows.flatMap((row) => {
      const work = active(row.obraId); if (!work) return [];
      return [{ id: `PEN-${row.id}`, workId: work.codigo, property: work.propriedade, dateIso: today,
        kind: 'update' as const, title: row.titulo, description: row.descricao, meta: work.titulo,
        tone: row.severidade === 'critica' ? 'danger' as const : 'warning' as const }];
    }),
    ...activityRows.flatMap((row) => {
      const work = active(row.obraId); if (!work || row.estado === 'concluida' || (row.termino >= today && row.estado !== 'bloqueada')) return [];
      return [{ id: `ATV-${row.id}`, workId: work.codigo, property: work.propriedade, dateIso: row.termino,
        kind: 'schedule' as const, title: row.estado === 'bloqueada' ? 'Atividade bloqueada' : 'Atividade atrasada',
        description: row.titulo, meta: row.responsavel, tone: 'danger' as const }];
    }),
    ...workRows.flatMap((work) => {
      if (!active(work.id)) return [];
      const finance = financeByWork.get(work.id);
      if (!finance || Number(finance.caixaDisponivel) >= 0) return [];
      return [{ id: `CAIXA-${work.id}`, workId: work.codigo, property: work.propriedade, dateIso: today,
        kind: 'payment' as const, title: 'Caixa da obra negativo', description: work.titulo,
        meta: `Saldo ${finance.caixaDisponivel}`, tone: 'warning' as const }];
    }),
    ...workRows.flatMap((work) => {
      if (!active(work.id) || work.termino >= today) return [];
      return [{ id: `PRAZO-${work.id}`, workId: work.codigo, property: work.propriedade, dateIso: work.termino,
        kind: 'schedule' as const, title: 'Prazo final da obra vencido', description: work.titulo,
        meta: `Vencimento ${work.termino}`, tone: 'danger' as const }];
    }),
  ].sort((left, right) => ({ danger: 0, warning: 1, info: 2 })[left.tone] - ({ danger: 0, warning: 1, info: 2 })[right.tone]
    || left.dateIso.localeCompare(right.dateIso));
  const commitments = activityRows.flatMap((row) => {
    const work = active(row.obraId); if (!work || row.estado === 'concluida') return [];
    const [year, month, day] = row.termino.split('-');
    const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' })
      .format(new Date(`${year}-${month}-01T12:00:00Z`)).replace('.', '').toUpperCase();
    return [{ id: row.id, workId: work.codigo, property: work.propriedade, dateIso: row.termino,
      day, month: monthLabel, title: row.titulo, description: row.responsavel,
      status: row.termino < today ? 'Atrasado' as const : row.termino === today ? 'Hoje' as const : 'Próximo' as const }];
  }).sort((left, right) => left.dateIso.localeCompare(right.dateIso));
  return { attentions, commitments, positionDateIso: today };
}
