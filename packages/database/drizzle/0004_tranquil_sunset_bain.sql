CREATE TABLE "document_source_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"billing_period" varchar(7) NOT NULL,
	"status" varchar(16) NOT NULL,
	"storage_key" text NOT NULL,
	"parsed_text_storage_key" text,
	"parsed_text_size_bytes" integer,
	"mime_type" varchar(128) NOT NULL,
	"original_file_name" varchar(512) NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"checksum" varchar(128) NOT NULL,
	"page_count" integer,
	"bullmq_job_id" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"error_code" varchar(64),
	"processing_started_at" timestamp,
	"ready_at" timestamp,
	"idempotency_key" varchar(255),
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "document_source_links_document_source_idx" ON "document_source_links" USING btree ("document_id","source_id");--> statement-breakpoint
CREATE INDEX "document_source_links_document_id_idx" ON "document_source_links" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_user_id_idempotency_key_idx" ON "sources" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "sources_workspace_checksum_idx" ON "sources" USING btree ("workspace_id","checksum");