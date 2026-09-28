-- Follow-up constraints, without modifying already-applied migrations or domain columns.
CREATE VIEW __rateio_violations AS
SELECT c.id FROM aporte_cotas c
JOIN aportes a ON a.id=c.aporte_id
JOIN obra_socios s ON s.id=c.obra_socio_id
WHERE c.valor_devido NOT BETWEEN
  (a.valor_solicitado / 10000) * s.percentual + ((a.valor_solicitado % 10000) * s.percentual) / 10000
  AND (a.valor_solicitado / 10000) * s.percentual + (((a.valor_solicitado % 10000) * s.percentual) + 9999) / 10000;
--> statement-breakpoint
CREATE TRIGGER __validate_rateio BEFORE DELETE ON __write_context
WHEN EXISTS(SELECT 1 FROM __rateio_violations)
BEGIN SELECT RAISE(ABORT,'Cota diverge do percentual pactuado; arredondamento maximo de um centavo'); END;
--> statement-breakpoint
CREATE TRIGGER contratacao_obra_historica BEFORE UPDATE ON obra_contratacoes
WHEN NEW.obra_id != OLD.obra_id
BEGIN SELECT RAISE(ABORT,'Contratacao emitida nao pode mudar de obra'); END;
--> statement-breakpoint
CREATE TRIGGER contrato_transicao BEFORE UPDATE OF estado ON contratos
WHEN NEW.estado != OLD.estado AND (
 (OLD.estado='rascunho' AND NEW.estado NOT IN ('ativo','cancelado')) OR
 (OLD.estado='ativo' AND NEW.estado NOT IN ('encerrado','cancelado')) OR
 OLD.estado IN ('encerrado','cancelado'))
BEGIN SELECT RAISE(ABORT,'Transicao contratual nao prevista; reabertura depende de D04'); END;
--> statement-breakpoint
CREATE TRIGGER obra_transicao BEFORE UPDATE OF estado ON obras
WHEN NEW.estado != OLD.estado AND (
 (OLD.estado='planejada' AND NEW.estado NOT IN ('em_andamento','pausada','cancelada')) OR
 (OLD.estado='em_andamento' AND NEW.estado NOT IN ('pausada','concluida','cancelada')) OR
 (OLD.estado='pausada' AND NEW.estado NOT IN ('em_andamento','concluida','cancelada')) OR
 OLD.estado IN ('concluida','cancelada'))
BEGIN SELECT RAISE(ABORT,'Transicao de obra nao prevista; reabertura depende de D04'); END;
--> statement-breakpoint
CREATE TRIGGER auditoria_sem_segredos BEFORE INSERT ON auditoria_eventos
WHEN EXISTS(SELECT 1 FROM json_tree(NEW.antes) WHERE lower(key) IN ('senha','senha_hash','password','password_hash','token','access_token','refresh_token'))
 OR EXISTS(SELECT 1 FROM json_tree(NEW.depois) WHERE lower(key) IN ('senha','senha_hash','password','password_hash','token','access_token','refresh_token'))
BEGIN SELECT RAISE(ABORT,'Credenciais nao podem ser copiadas para auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER auditoria_ator_contexto BEFORE INSERT ON auditoria_eventos
WHEN NEW.ator_usuario_id IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1)
 OR NEW.contexto_ator IS NOT (SELECT contexto_ator FROM __write_context WHERE id=1)
BEGIN SELECT RAISE(ABORT,'Evento deve usar a autoria da transacao'); END;
