ALTER TABLE "paragraphs"
  ADD COLUMN IF NOT EXISTS "text_raw_md" text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE "paragraph_translations"
  ADD COLUMN IF NOT EXISTS "text_en_md" text;
--> statement-breakpoint
ALTER TABLE "paragraph_translations"
  ADD COLUMN IF NOT EXISTS "text_id_md" text;
