CREATE TYPE "UserRole" AS ENUM ('DRIVER', 'HOST', 'ADMIN');

CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" VARCHAR(320) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "password_hash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'DRIVER',
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
