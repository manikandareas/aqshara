ALTER TABLE "video_jobs" ADD COLUMN IF NOT EXISTS "bunny_library_id" text;--> statement-breakpoint
ALTER TABLE "video_jobs" ADD COLUMN IF NOT EXISTS "bunny_video_id" text;--> statement-breakpoint
ALTER TABLE "video_jobs" ADD COLUMN IF NOT EXISTS "bunny_status" integer;
