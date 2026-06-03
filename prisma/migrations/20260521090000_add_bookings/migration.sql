CREATE TYPE "BookingStatus" AS ENUM ('HOLD', 'CONFIRMED', 'CANCELED', 'EXPIRED');

CREATE TABLE "bookings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "spot_id" UUID NOT NULL,
  "spot_label" VARCHAR(160) NOT NULL DEFAULT 'Unknown spot',
  "driver_user_id" UUID NOT NULL,
  "status" "BookingStatus" NOT NULL DEFAULT 'HOLD',
  "amount" INTEGER NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "start_at" TIMESTAMPTZ(6) NOT NULL,
  "end_at" TIMESTAMPTZ(6) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "bookings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bookings_driver_user_id_fkey" FOREIGN KEY ("driver_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "bookings_driver_user_id_idx" ON "bookings"("driver_user_id");
CREATE INDEX "bookings_spot_id_idx" ON "bookings"("spot_id");
CREATE INDEX "bookings_status_idx" ON "bookings"("status");
CREATE INDEX "bookings_start_at_end_at_idx" ON "bookings"("start_at", "end_at");

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;
