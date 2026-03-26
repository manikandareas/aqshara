ALTER TABLE "exports" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "exports" ADD COLUMN "billing_period" varchar(7);--> statement-breakpoint
ALTER TABLE "exports" ADD COLUMN "idempotency_key" varchar(255);--> statement-breakpoint
ALTER TABLE "exports" ADD COLUMN "bullmq_job_id" text;--> statement-breakpoint
ALTER TABLE "exports" ADD COLUMN "preflight_warnings" jsonb;--> statement-breakpoint
ALTER TABLE "exports" ADD COLUMN "retry_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "exports" ADD COLUMN "content_type" varchar(128);--> statement-breakpoint
ALTER TABLE "exports" ADD COLUMN "file_size_bytes" integer;--> statement-breakpoint
ALTER TABLE "exports" ADD COLUMN "error_code" varchar(64);--> statement-breakpoint
ALTER TABLE "exports" ADD COLUMN "processing_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "exports" ADD COLUMN "ready_at" timestamp;--> statement-breakpoint
UPDATE "exports" AS e
SET
	"workspace_id" = d."workspace_id"
FROM "documents" AS d
WHERE
	e."document_id" = d."id"
	AND e."workspace_id" IS NULL;--> statement-breakpoint
UPDATE "exports"
SET
	"billing_period" = to_char("created_at", 'YYYY-MM')
WHERE
	"billing_period" IS NULL;--> statement-breakpoint
ALTER TABLE "exports" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "exports" ALTER COLUMN "billing_period" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "exports_user_id_idempotency_key_idx" ON "exports" USING btree ("user_id","idempotency_key");
