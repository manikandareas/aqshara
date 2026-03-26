CREATE TABLE "ai_actions_reserved" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"period" varchar(7) NOT NULL,
	"ai_actions_reserved" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_change_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"proposal_json" jsonb NOT NULL,
	"action_type" varchar(32) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"base_updated_at" timestamp NOT NULL,
	"target_block_ids" text[] NOT NULL,
	"applied_at" timestamp,
	"dismissed_at" timestamp,
	"invalidated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usage_events" ADD COLUMN "billing_period" varchar(7);--> statement-breakpoint
ALTER TABLE "usage_events" ADD COLUMN "feature_key" varchar(64);--> statement-breakpoint
ALTER TABLE "usage_events" ADD COLUMN "status" varchar(16) DEFAULT 'succeeded';--> statement-breakpoint
ALTER TABLE "usage_events" ADD COLUMN "idempotency_key" varchar(255);--> statement-breakpoint
ALTER TABLE "usage_events" ADD COLUMN "request_hash" varchar(128);--> statement-breakpoint
ALTER TABLE "usage_events" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "usage_events" ADD COLUMN "released_at" timestamp;--> statement-breakpoint
UPDATE "usage_events"
SET
	"billing_period" = COALESCE("billing_period", to_char("created_at", 'YYYY-MM')),
	"feature_key" = COALESCE("feature_key", left(COALESCE(NULLIF("event_type", ''), 'legacy'), 64)),
	"status" = COALESCE("status", 'succeeded'),
	"completed_at" = COALESCE("completed_at", "created_at")
WHERE
	"billing_period" IS NULL
	OR "feature_key" IS NULL
	OR "status" IS NULL
	OR "completed_at" IS NULL;--> statement-breakpoint
ALTER TABLE "usage_events" ALTER COLUMN "billing_period" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "usage_events" ALTER COLUMN "feature_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "usage_events" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_actions_reserved_user_id_period_idx" ON "ai_actions_reserved" USING btree ("user_id","period");--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "monthly_usage_counters"
		GROUP BY "user_id", "period"
		HAVING COUNT(*) > 1
	) THEN
		RAISE EXCEPTION 'Cannot create monthly_usage_counters_user_id_period_idx: duplicate (user_id, period) rows exist';
	END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_usage_counters_user_id_period_idx" ON "monthly_usage_counters" USING btree ("user_id","period");--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "usage_events"
		WHERE "idempotency_key" IS NOT NULL
		GROUP BY "user_id", "idempotency_key"
		HAVING COUNT(*) > 1
	) THEN
		RAISE EXCEPTION 'Cannot create usage_events_user_id_idempotency_key_idx: duplicate (user_id, idempotency_key) rows exist';
	END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX "usage_events_user_id_idempotency_key_idx" ON "usage_events" USING btree ("user_id","idempotency_key");
