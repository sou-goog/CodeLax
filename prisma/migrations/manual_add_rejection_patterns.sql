-- Migration: add rejection_patterns column to review table
-- Apply when database is available: npx prisma migrate dev --name add_rejection_patterns

ALTER TABLE "review" ADD COLUMN IF NOT EXISTS "rejectionPatterns" TEXT;

-- Verify
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'review' AND column_name = 'rejectionPatterns';
