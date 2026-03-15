CREATE TABLE "billing_customers" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"polar_customer_id" text,
	"email" text,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_message" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_metadata" (
	"document_id" text PRIMARY KEY NOT NULL,
	"source_object_key" text NOT NULL,
	"content_type" text NOT NULL,
	"file_size_bytes" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"filename" text NOT NULL,
	"status" text NOT NULL,
	"pipeline_stage" text NOT NULL,
	"require_translate" boolean DEFAULT false NOT NULL,
	"require_video_generation" boolean DEFAULT false NOT NULL,
	"source_lang" text,
	"page_count" integer,
	"title" text,
	"abstract" text,
	"pdf_type" text,
	"ocr_quality" real,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"document_id" text,
	"type" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"document_id" text NOT NULL,
	"type" text NOT NULL,
	"rating" integer,
	"comment" text,
	"issue_type" text,
	"description" text,
	"paragraph_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "map_nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"parent_id" text,
	"label" text NOT NULL,
	"label_id" text,
	"type" text NOT NULL,
	"para_refs" text[] DEFAULT '{}' NOT NULL,
	"order_no" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paragraph_translations" (
	"paragraph_id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"text_en" text,
	"text_id" text,
	"cache_hash" text,
	"translated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paragraphs" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"section_id" text,
	"order_no" integer NOT NULL,
	"page_no" integer NOT NULL,
	"source_start" integer,
	"source_end" integer,
	"text_raw" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"parent_id" text,
	"level" integer DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"title_id" text,
	"para_start" text,
	"order_no" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stage_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"progress_pct" integer,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_amount" integer,
	"price_currency" text,
	"interval" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"user_id" text NOT NULL,
	"plan_id" text,
	"status" text NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "term_occurrences" (
	"id" text PRIMARY KEY NOT NULL,
	"term_id" text NOT NULL,
	"paragraph_id" text NOT NULL,
	"page_no" integer NOT NULL,
	"snippet_en" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terms" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"term_en" text NOT NULL,
	"definition" text,
	"definition_id" text,
	"example" text,
	"example_id" text,
	"occurrence_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_counters" (
	"customer_id" text NOT NULL,
	"user_id" text NOT NULL,
	"period_key" text NOT NULL,
	"used_units" integer DEFAULT 0 NOT NULL,
	"held_units" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_holds" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"hold_key" text NOT NULL,
	"units" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"user_id" text NOT NULL,
	"entry_type" text NOT NULL,
	"units_delta" integer NOT NULL,
	"source_type" text NOT NULL,
	"source_ref" text,
	"idempotency_key" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_job_artifacts" (
	"id" text PRIMARY KEY NOT NULL,
	"video_job_id" text NOT NULL,
	"artifact_type" text NOT NULL,
	"object_key" text NOT NULL,
	"content_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_job_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"video_job_id" text NOT NULL,
	"event_type" text NOT NULL,
	"attempt" integer NOT NULL,
	"worker_id" text,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_job_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"video_job_id" text NOT NULL,
	"topic" text NOT NULL,
	"payload" jsonb NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_job_scenes" (
	"id" text PRIMARY KEY NOT NULL,
	"video_job_id" text NOT NULL,
	"scene_index" integer NOT NULL,
	"title" text,
	"narration_text" text,
	"template_type" text,
	"planned_duration_ms" integer,
	"actual_audio_duration_ms" integer,
	"render_status" text DEFAULT 'pending' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"manim_code_object_key" text,
	"audio_object_key" text,
	"video_object_key" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"status" text NOT NULL,
	"pipeline_stage" text NOT NULL,
	"progress_pct" integer DEFAULT 0 NOT NULL,
	"target_duration_sec" integer DEFAULT 60 NOT NULL,
	"voice" text NOT NULL,
	"language" text NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"current_attempt" integer DEFAULT 1 NOT NULL,
	"current_scene_index" integer,
	"fallback_used_count" integer DEFAULT 0 NOT NULL,
	"render_profile" text DEFAULT '720p' NOT NULL,
	"worker_id" text,
	"accepted_at" timestamp with time zone,
	"last_heartbeat_at" timestamp with time zone,
	"lease_expires_at" timestamp with time zone,
	"terminal_event_id" text,
	"quality_gate" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_code" text,
	"error_message" text,
	"final_video_object_key" text,
	"final_thumbnail_object_key" text,
	"duration_sec" real,
	"resolution" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warnings" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"code" text NOT NULL,
	"message" text NOT NULL,
	"pages" integer[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_metadata" ADD CONSTRAINT "document_metadata_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_nodes" ADD CONSTRAINT "map_nodes_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paragraph_translations" ADD CONSTRAINT "paragraph_translations_paragraph_id_paragraphs_id_fk" FOREIGN KEY ("paragraph_id") REFERENCES "public"."paragraphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paragraph_translations" ADD CONSTRAINT "paragraph_translations_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paragraphs" ADD CONSTRAINT "paragraphs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_runs" ADD CONSTRAINT "stage_runs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "term_occurrences" ADD CONSTRAINT "term_occurrences_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."terms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "term_occurrences" ADD CONSTRAINT "term_occurrences_paragraph_id_paragraphs_id_fk" FOREIGN KEY ("paragraph_id") REFERENCES "public"."paragraphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terms" ADD CONSTRAINT "terms_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_holds" ADD CONSTRAINT "usage_holds_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_ledger" ADD CONSTRAINT "usage_ledger_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_job_artifacts" ADD CONSTRAINT "video_job_artifacts_video_job_id_video_jobs_id_fk" FOREIGN KEY ("video_job_id") REFERENCES "public"."video_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_job_events" ADD CONSTRAINT "video_job_events_video_job_id_video_jobs_id_fk" FOREIGN KEY ("video_job_id") REFERENCES "public"."video_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_job_outbox" ADD CONSTRAINT "video_job_outbox_video_job_id_video_jobs_id_fk" FOREIGN KEY ("video_job_id") REFERENCES "public"."video_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_job_scenes" ADD CONSTRAINT "video_job_scenes_video_job_id_video_jobs_id_fk" FOREIGN KEY ("video_job_id") REFERENCES "public"."video_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_jobs" ADD CONSTRAINT "video_jobs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_customers_user_uidx" ON "billing_customers" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_customers_polar_customer_uidx" ON "billing_customers" USING btree ("polar_customer_id");--> statement-breakpoint
CREATE INDEX "billing_events_type_received_idx" ON "billing_events" USING btree ("event_type","received_at");--> statement-breakpoint
CREATE INDEX "billing_events_status_received_idx" ON "billing_events" USING btree ("status","received_at");--> statement-breakpoint
CREATE INDEX "document_metadata_source_object_key_idx" ON "document_metadata" USING btree ("source_object_key");--> statement-breakpoint
CREATE INDEX "documents_owner_created_idx" ON "documents" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "documents_owner_status_created_idx" ON "documents" USING btree ("owner_id","status","created_at");--> statement-breakpoint
CREATE INDEX "events_actor_created_idx" ON "events" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "events_document_created_idx" ON "events" USING btree ("document_id","created_at");--> statement-breakpoint
CREATE INDEX "events_type_created_idx" ON "events" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "feedback_document_created_idx" ON "feedback" USING btree ("document_id","created_at");--> statement-breakpoint
CREATE INDEX "feedback_actor_created_idx" ON "feedback" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "map_nodes_document_parent_order_idx" ON "map_nodes" USING btree ("document_id","parent_id","order_no");--> statement-breakpoint
CREATE UNIQUE INDEX "map_nodes_document_node_uidx" ON "map_nodes" USING btree ("document_id","id");--> statement-breakpoint
CREATE INDEX "paragraph_translations_document_status_idx" ON "paragraph_translations" USING btree ("document_id","status","paragraph_id");--> statement-breakpoint
CREATE INDEX "paragraphs_document_order_idx" ON "paragraphs" USING btree ("document_id","order_no");--> statement-breakpoint
CREATE INDEX "paragraphs_document_section_order_idx" ON "paragraphs" USING btree ("document_id","section_id","order_no");--> statement-breakpoint
CREATE INDEX "paragraphs_document_page_idx" ON "paragraphs" USING btree ("document_id","page_no");--> statement-breakpoint
CREATE UNIQUE INDEX "paragraphs_document_paragraph_uidx" ON "paragraphs" USING btree ("document_id","id");--> statement-breakpoint
CREATE INDEX "sections_document_order_idx" ON "sections" USING btree ("document_id","order_no");--> statement-breakpoint
CREATE UNIQUE INDEX "sections_document_section_uidx" ON "sections" USING btree ("document_id","id");--> statement-breakpoint
CREATE INDEX "stage_runs_document_created_idx" ON "stage_runs" USING btree ("document_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "stage_runs_document_name_uidx" ON "stage_runs" USING btree ("document_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_plans_code_uidx" ON "subscription_plans" USING btree ("code");--> statement-breakpoint
CREATE INDEX "subscription_plans_is_active_idx" ON "subscription_plans" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "subscriptions_user_status_idx" ON "subscriptions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "subscriptions_customer_idx" ON "subscriptions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "subscriptions_plan_idx" ON "subscriptions" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "term_occurrences_term_page_idx" ON "term_occurrences" USING btree ("term_id","page_no");--> statement-breakpoint
CREATE INDEX "terms_document_term_idx" ON "terms" USING btree ("document_id","term_en");--> statement-breakpoint
CREATE UNIQUE INDEX "terms_document_term_uidx" ON "terms" USING btree ("document_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_counters_customer_period_uidx" ON "usage_counters" USING btree ("customer_id","period_key");--> statement-breakpoint
CREATE INDEX "usage_counters_user_period_idx" ON "usage_counters" USING btree ("user_id","period_key");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_holds_hold_key_uidx" ON "usage_holds" USING btree ("hold_key");--> statement-breakpoint
CREATE INDEX "usage_holds_customer_status_idx" ON "usage_holds" USING btree ("customer_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_ledger_idempotency_uidx" ON "usage_ledger" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "usage_ledger_user_created_idx" ON "usage_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "usage_ledger_customer_created_idx" ON "usage_ledger" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "video_job_artifacts_job_created_idx" ON "video_job_artifacts" USING btree ("video_job_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "video_job_events_event_id_uidx" ON "video_job_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "video_job_events_job_created_idx" ON "video_job_events" USING btree ("video_job_id","created_at");--> statement-breakpoint
CREATE INDEX "video_job_outbox_publish_idx" ON "video_job_outbox" USING btree ("published_at","next_attempt_at","created_at");--> statement-breakpoint
CREATE INDEX "video_job_outbox_job_created_idx" ON "video_job_outbox" USING btree ("video_job_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "video_job_scenes_job_scene_uidx" ON "video_job_scenes" USING btree ("video_job_id","scene_index");--> statement-breakpoint
CREATE INDEX "video_job_scenes_job_status_idx" ON "video_job_scenes" USING btree ("video_job_id","render_status");--> statement-breakpoint
CREATE INDEX "video_jobs_owner_status_created_idx" ON "video_jobs" USING btree ("owner_id","status","created_at");--> statement-breakpoint
CREATE INDEX "video_jobs_document_created_idx" ON "video_jobs" USING btree ("document_id","created_at");--> statement-breakpoint
CREATE INDEX "warnings_document_code_idx" ON "warnings" USING btree ("document_id","code");