DROP TABLE IF EXISTS "video_job_events";
--> statement-breakpoint
DROP TABLE IF EXISTS "video_job_outbox";
--> statement-breakpoint
ALTER TABLE "video_job_scenes"
RENAME COLUMN "manim_code_object_key" TO "scene_definition_object_key";
