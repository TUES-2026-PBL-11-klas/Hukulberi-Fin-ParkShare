CREATE TYPE "SpotVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

ALTER TABLE "spots"
  ADD COLUMN "photo_urls" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "verification_status" "SpotVerificationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "verification_note" VARCHAR(500),
  ADD COLUMN "verified_at" TIMESTAMPTZ(6);

CREATE INDEX "spots_verification_status_idx" ON "spots"("verification_status");
