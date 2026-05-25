CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_no_active_overlap"
  EXCLUDE USING gist (
    "spot_id" WITH =,
    tstzrange("start_at", "end_at", '[)') WITH &&
  )
  WHERE ("status" IN ('HOLD', 'CONFIRMED'));
