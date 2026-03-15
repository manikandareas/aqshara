ALTER TABLE "video_jobs"
ADD COLUMN IF NOT EXISTS "bunny_library_id" text,
ADD COLUMN IF NOT EXISTS "bunny_video_id" text,
ADD COLUMN IF NOT EXISTS "bunny_status" integer;
