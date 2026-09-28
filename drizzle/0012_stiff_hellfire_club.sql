ALTER TABLE negociacoes ADD COLUMN motivo_outro TEXT;
--> statement-breakpoint
ALTER TABLE negociacoes ADD COLUMN multa INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE negociacoes ADD COLUMN juros INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE negociacoes ADD COLUMN correcao INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE negociacoes ADD COLUMN contato_nome TEXT;
--> statement-breakpoint
ALTER TABLE negociacoes ADD COLUMN contato_canal TEXT;
--> statement-breakpoint
ALTER TABLE negociacoes ADD COLUMN documento_nome TEXT;
--> statement-breakpoint
ALTER TABLE negociacoes ADD COLUMN observacoes TEXT;
--> statement-breakpoint
ALTER TABLE recebimentos ADD COLUMN data_credito TEXT;
--> statement-breakpoint
ALTER TABLE recebimentos ADD COLUMN valor_recebido INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE recebimentos ADD COLUMN desconto INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE recebimentos ADD COLUMN acrescimo INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE recebimentos ADD COLUMN conta_descricao TEXT;
--> statement-breakpoint
ALTER TABLE recebimentos ADD COLUMN pagador_descricao TEXT;
--> statement-breakpoint
ALTER TABLE recebimentos ADD COLUMN comprovante_nome TEXT;
--> statement-breakpoint
ALTER TABLE recebimentos ADD COLUMN observacoes TEXT;
