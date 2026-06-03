-- CreateEnum for ReviewRating
CREATE TYPE "ReviewRating" AS ENUM ('ONE', 'TWO', 'THREE', 'FOUR', 'FIVE');

-- CreateEnum for AccessEventStatus
CREATE TYPE "AccessEventStatus" AS ENUM ('SUCCESS', 'FAILED', 'DENIED');

-- Create Spot table
CREATE TABLE "spots" (
    "id" UUID NOT NULL,
    "host_user_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "address" VARCHAR(500) NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "price_per_hour" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spots_pkey" PRIMARY KEY ("id")
);

-- Create Review table
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "spot_id" UUID NOT NULL,
    "rating" "ReviewRating" NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- Create AccessEvent table
CREATE TABLE "access_events" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "gate_id" VARCHAR(100) NOT NULL,
    "status" "AccessEventStatus" NOT NULL,
    "reason" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_events_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys
ALTER TABLE "spots" ADD CONSTRAINT "spots_host_user_id_fkey" FOREIGN KEY ("host_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing development bookings can contain placeholder spot IDs from before
-- real spot listings existed. Seed inactive placeholders so the FK can attach
-- without deleting booking/payment history.
INSERT INTO "spots" (
    "id",
    "host_user_id",
    "title",
    "description",
    "address",
    "latitude",
    "longitude",
    "price_per_hour",
    "is_active",
    "created_at",
    "updated_at"
)
SELECT
    "bookings"."spot_id",
    MIN("bookings"."driver_user_id"::text)::uuid,
    'Imported booking spot',
    'Created automatically for existing booking history.',
    'Unknown address',
    0,
    0,
    0,
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "bookings"
WHERE NOT EXISTS (
    SELECT 1 FROM "spots" WHERE "spots"."id" = "bookings"."spot_id"
)
GROUP BY "bookings"."spot_id";

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_spot_id_fkey" FOREIGN KEY ("spot_id") REFERENCES "spots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_spot_id_fkey" FOREIGN KEY ("spot_id") REFERENCES "spots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "access_events" ADD CONSTRAINT "access_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create indexes
CREATE INDEX "spots_host_user_id_idx" ON "spots"("host_user_id");
CREATE INDEX "spots_is_active_idx" ON "spots"("is_active");
CREATE INDEX "spots_latitude_longitude_idx" ON "spots"("latitude", "longitude");

CREATE UNIQUE INDEX "reviews_booking_id_key" ON "reviews"("booking_id");
CREATE INDEX "reviews_spot_id_idx" ON "reviews"("spot_id");
CREATE INDEX "reviews_author_id_idx" ON "reviews"("author_id");

CREATE INDEX "access_events_booking_id_idx" ON "access_events"("booking_id");
CREATE INDEX "access_events_user_id_idx" ON "access_events"("user_id");
CREATE INDEX "access_events_gate_id_idx" ON "access_events"("gate_id");
