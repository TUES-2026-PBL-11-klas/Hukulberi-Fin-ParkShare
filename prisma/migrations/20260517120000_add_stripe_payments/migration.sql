CREATE TYPE "PaymentProviderType" AS ENUM ('STRIPE');

CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'SUCCEEDED', 'FAILED', 'CANCELED');

CREATE TYPE "WebhookProcessingStatus" AS ENUM ('PROCESSED', 'FAILED');

CREATE TABLE "payments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "booking_id" UUID,
  "driver_user_id" UUID NOT NULL,
  "provider" "PaymentProviderType" NOT NULL DEFAULT 'STRIPE',
  "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
  "provider_checkout_session_id" VARCHAR(255),
  "provider_payment_intent_id" VARCHAR(255),
  "amount" INTEGER NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payments_driver_user_id_fkey" FOREIGN KEY ("driver_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "payment_webhook_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "provider" "PaymentProviderType" NOT NULL DEFAULT 'STRIPE',
  "provider_event_id" VARCHAR(255) NOT NULL,
  "payment_id" UUID,
  "event_type" VARCHAR(120) NOT NULL,
  "processing_status" "WebhookProcessingStatus" NOT NULL,
  "raw_json" JSONB NOT NULL,
  "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMPTZ(6),

  CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_webhook_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "payments_provider_checkout_session_id_key" ON "payments"("provider_checkout_session_id");
CREATE INDEX "payments_driver_user_id_idx" ON "payments"("driver_user_id");
CREATE INDEX "payments_booking_id_idx" ON "payments"("booking_id");
CREATE UNIQUE INDEX "payment_webhook_events_provider_event_id_key" ON "payment_webhook_events"("provider_event_id");
CREATE INDEX "payment_webhook_events_payment_id_idx" ON "payment_webhook_events"("payment_id");

ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_webhook_events" ENABLE ROW LEVEL SECURITY;
