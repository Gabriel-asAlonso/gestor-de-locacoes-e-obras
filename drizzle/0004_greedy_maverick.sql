CREATE TABLE `documento_imovel_vinculos` (
  `id` text(36) PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random() % 4)+1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))) NOT NULL,
  `created_at` text(24) DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  `created_by` text(36), `documento_id` text(36) NOT NULL, `imovel_id` text(36) NOT NULL, `topico` text(64) NOT NULL,
  FOREIGN KEY (`created_by`) REFERENCES `usuarios`(`id`) ON UPDATE restrict ON DELETE restrict,
  FOREIGN KEY (`documento_id`) REFERENCES `documentos`(`id`) ON UPDATE restrict ON DELETE restrict,
  FOREIGN KEY (`imovel_id`) REFERENCES `imoveis`(`id`) ON UPDATE restrict ON DELETE restrict,
  CONSTRAINT "documento_imovel_vinculos_id_text" CHECK(`id` IS NULL OR (typeof(`id`)='text' AND length(trim(`id`))>0)),
  CONSTRAINT "documento_imovel_vinculos_id_length" CHECK(`id` IS NULL OR length(`id`)<=36),
  CONSTRAINT "documento_imovel_vinculos_id_uuid" CHECK(`id` IS NULL OR (length(`id`)=36 AND substr(`id`,9,1)='-' AND substr(`id`,14,1)='-' AND substr(`id`,19,1)='-' AND substr(`id`,24,1)='-' AND length(replace(`id`,'-',''))=32 AND replace(`id`,'-','') NOT GLOB '*[^0-9a-f]*')),
  CONSTRAINT "documento_imovel_vinculos_created_at_text" CHECK(`created_at` IS NULL OR (typeof(`created_at`)='text' AND length(trim(`created_at`))>0)),
  CONSTRAINT "documento_imovel_vinculos_created_at_length" CHECK(`created_at` IS NULL OR length(`created_at`)<=24),
  CONSTRAINT "documento_imovel_vinculos_created_at_utc" CHECK(`created_at` IS NULL OR (length(`created_at`)=24 AND strftime('%Y-%m-%dT%H:%M:%fZ',`created_at`,'+0 days') IS NOT NULL AND strftime('%Y-%m-%dT%H:%M:%fZ',`created_at`,'+0 days')=`created_at`)),
  CONSTRAINT "documento_imovel_vinculos_created_by_text" CHECK(`created_by` IS NULL OR (typeof(`created_by`)='text' AND length(trim(`created_by`))>0)),
  CONSTRAINT "documento_imovel_vinculos_created_by_length" CHECK(`created_by` IS NULL OR length(`created_by`)<=36),
  CONSTRAINT "documento_imovel_vinculos_created_by_uuid" CHECK(`created_by` IS NULL OR (length(`created_by`)=36 AND substr(`created_by`,9,1)='-' AND substr(`created_by`,14,1)='-' AND substr(`created_by`,19,1)='-' AND substr(`created_by`,24,1)='-' AND length(replace(`created_by`,'-',''))=32 AND replace(`created_by`,'-','') NOT GLOB '*[^0-9a-f]*')),
  CONSTRAINT "documento_imovel_vinculos_documento_id_text" CHECK(`documento_id` IS NULL OR (typeof(`documento_id`)='text' AND length(trim(`documento_id`))>0)),
  CONSTRAINT "documento_imovel_vinculos_documento_id_length" CHECK(`documento_id` IS NULL OR length(`documento_id`)<=36),
  CONSTRAINT "documento_imovel_vinculos_documento_id_uuid" CHECK(`documento_id` IS NULL OR (length(`documento_id`)=36 AND substr(`documento_id`,9,1)='-' AND substr(`documento_id`,14,1)='-' AND substr(`documento_id`,19,1)='-' AND substr(`documento_id`,24,1)='-' AND length(replace(`documento_id`,'-',''))=32 AND replace(`documento_id`,'-','') NOT GLOB '*[^0-9a-f]*')),
  CONSTRAINT "documento_imovel_vinculos_imovel_id_text" CHECK(`imovel_id` IS NULL OR (typeof(`imovel_id`)='text' AND length(trim(`imovel_id`))>0)),
  CONSTRAINT "documento_imovel_vinculos_imovel_id_length" CHECK(`imovel_id` IS NULL OR length(`imovel_id`)<=36),
  CONSTRAINT "documento_imovel_vinculos_imovel_id_uuid" CHECK(`imovel_id` IS NULL OR (length(`imovel_id`)=36 AND substr(`imovel_id`,9,1)='-' AND substr(`imovel_id`,14,1)='-' AND substr(`imovel_id`,19,1)='-' AND substr(`imovel_id`,24,1)='-' AND length(replace(`imovel_id`,'-',''))=32 AND replace(`imovel_id`,'-','') NOT GLOB '*[^0-9a-f]*')),
  CONSTRAINT "documento_imovel_vinculos_topico_text" CHECK(`topico` IS NULL OR (typeof(`topico`)='text' AND length(trim(`topico`))>0)),
  CONSTRAINT "documento_imovel_vinculos_topico_length" CHECK(`topico` IS NULL OR length(`topico`)<=64)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documento_imovel_uq` ON `documento_imovel_vinculos` (`documento_id`,`imovel_id`);
--> statement-breakpoint
CREATE INDEX `documentos_por_imovel_idx` ON `documento_imovel_vinculos` (`imovel_id`,`topico`,`documento_id`);
--> statement-breakpoint
CREATE TRIGGER `documento_imovel_vinculos_context_insert` BEFORE INSERT ON `documento_imovel_vinculos` WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT,'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER `documento_imovel_vinculos_author_insert` BEFORE INSERT ON `documento_imovel_vinculos` WHEN NEW.created_by IS NOT (SELECT ator_usuario_id FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT,'Autoria deve corresponder ao contexto da transacao'); END;
--> statement-breakpoint
CREATE TRIGGER `documento_imovel_vinculos_audit_insert` AFTER INSERT ON `documento_imovel_vinculos` BEGIN INSERT INTO auditoria_eventos(ator_usuario_id,contexto_ator,entidade,registro_id,operacao,motivo,antes,depois) SELECT ator_usuario_id,contexto_ator,'documento_imovel_vinculos',NEW.id,'insert',motivo,NULL,json_object('id',NEW.id,'created_at',NEW.created_at,'created_by',NEW.created_by,'documento_id',NEW.documento_id,'imovel_id',NEW.imovel_id,'topico',NEW.topico) FROM __write_context WHERE id=1; UPDATE __write_context SET novos_registros=json_insert(novos_registros,'$[#]',json_object('tabela','documento_imovel_vinculos','id',NEW.id)) WHERE id=1; END;
--> statement-breakpoint
CREATE TRIGGER `documento_imovel_vinculos_context_update` BEFORE UPDATE ON `documento_imovel_vinculos` WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT,'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER `documento_imovel_vinculos_immutable` BEFORE UPDATE ON `documento_imovel_vinculos` BEGIN SELECT RAISE(ABORT,'Registro imutavel; use novo vinculo'); END;
--> statement-breakpoint
CREATE TRIGGER `documento_imovel_vinculos_context_delete` BEFORE DELETE ON `documento_imovel_vinculos` WHEN NOT EXISTS(SELECT 1 FROM __write_context WHERE id=1) BEGIN SELECT RAISE(ABORT,'Escrita exige transacao com contexto de auditoria'); END;
--> statement-breakpoint
CREATE TRIGGER `documento_imovel_vinculos_preserve` BEFORE DELETE ON `documento_imovel_vinculos` BEGIN SELECT RAISE(ABORT,'Exclusao fisica vedada; preserve historico'); END;
--> statement-breakpoint
ALTER TABLE `imoveis` ADD COLUMN `logradouro` text(200) CONSTRAINT "imoveis_logradouro_text" CHECK(`logradouro` IS NULL OR (typeof(`logradouro`)='text' AND length(trim(`logradouro`))>0)) CONSTRAINT "imoveis_logradouro_length" CHECK(`logradouro` IS NULL OR length(`logradouro`)<=200);
--> statement-breakpoint
ALTER TABLE `imoveis` ADD COLUMN `numero` text(40) CONSTRAINT "imoveis_numero_text" CHECK(`numero` IS NULL OR (typeof(`numero`)='text' AND length(trim(`numero`))>0)) CONSTRAINT "imoveis_numero_length" CHECK(`numero` IS NULL OR length(`numero`)<=40);
--> statement-breakpoint
ALTER TABLE `imoveis` ADD COLUMN `complemento` text(120) CONSTRAINT "imoveis_complemento_text" CHECK(`complemento` IS NULL OR (typeof(`complemento`)='text' AND length(trim(`complemento`))>0)) CONSTRAINT "imoveis_complemento_length" CHECK(`complemento` IS NULL OR length(`complemento`)<=120);
--> statement-breakpoint
ALTER TABLE `imoveis` ADD COLUMN `bairro` text(120) CONSTRAINT "imoveis_bairro_text" CHECK(`bairro` IS NULL OR (typeof(`bairro`)='text' AND length(trim(`bairro`))>0)) CONSTRAINT "imoveis_bairro_length" CHECK(`bairro` IS NULL OR length(`bairro`)<=120);
--> statement-breakpoint
ALTER TABLE `imoveis` ADD COLUMN `inscricao_municipal` text(80) CONSTRAINT "imoveis_inscricao_municipal_text" CHECK(`inscricao_municipal` IS NULL OR (typeof(`inscricao_municipal`)='text' AND length(trim(`inscricao_municipal`))>0)) CONSTRAINT "imoveis_inscricao_municipal_length" CHECK(`inscricao_municipal` IS NULL OR length(`inscricao_municipal`)<=80);
--> statement-breakpoint
ALTER TABLE `imoveis` ADD COLUMN `matricula` text(80) CONSTRAINT "imoveis_matricula_text" CHECK(`matricula` IS NULL OR (typeof(`matricula`)='text' AND length(trim(`matricula`))>0)) CONSTRAINT "imoveis_matricula_length" CHECK(`matricula` IS NULL OR length(`matricula`)<=80);
--> statement-breakpoint
ALTER TABLE `imoveis` ADD COLUMN `cartorio_registro` text(200) CONSTRAINT "imoveis_cartorio_registro_text" CHECK(`cartorio_registro` IS NULL OR (typeof(`cartorio_registro`)='text' AND length(trim(`cartorio_registro`))>0)) CONSTRAINT "imoveis_cartorio_registro_length" CHECK(`cartorio_registro` IS NULL OR length(`cartorio_registro`)<=200);
--> statement-breakpoint
ALTER TABLE `imoveis` ADD COLUMN `gestor_descricao` text(200) CONSTRAINT "imoveis_gestor_descricao_text" CHECK(`gestor_descricao` IS NULL OR (typeof(`gestor_descricao`)='text' AND length(trim(`gestor_descricao`))>0)) CONSTRAINT "imoveis_gestor_descricao_length" CHECK(`gestor_descricao` IS NULL OR length(`gestor_descricao`)<=200);
