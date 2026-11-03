-- CreateEnum
CREATE TYPE "refund_execution_mode" AS ENUM ('PROVIDER_API', 'MANUAL_BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "manual_refund_status" AS ENUM ('AWAITING_RECIPIENT', 'READY', 'PROCESSING', 'NEEDS_REVIEW', 'COMPLETED');

-- AlterTable
ALTER TABLE "refunds" ADD COLUMN     "execution_mode" "refund_execution_mode" NOT NULL DEFAULT 'PROVIDER_API';

-- CreateTable
CREATE TABLE "payos_checkouts" (
    "payment_id" UUID NOT NULL,
    "order_code" BIGSERIAL NOT NULL,
    "payment_link_id" VARCHAR(180),
    "request_snapshot" JSONB,
    "last_response" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payos_checkouts_pkey" PRIMARY KEY ("payment_id")
);

-- CreateTable
CREATE TABLE "manual_refunds" (
    "refund_id" UUID NOT NULL,
    "status" "manual_refund_status" NOT NULL DEFAULT 'AWAITING_RECIPIENT',
    "bank_bin" VARCHAR(6),
    "account_number" VARCHAR(40),
    "account_holder_name" VARCHAR(200),
    "ownership_confirmed_at" TIMESTAMPTZ(6),
    "assigned_admin_id" UUID,
    "claimed_at" TIMESTAMPTZ(6),
    "source_bank_bin" VARCHAR(6),
    "source_account_number" VARCHAR(40),
    "bank_transaction_ref" VARCHAR(180),
    "transferred_at" TIMESTAMPTZ(6),
    "confirmed_by" UUID,
    "evidence_media_id" UUID,
    "note" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manual_refunds_pkey" PRIMARY KEY ("refund_id")
);

-- CreateTable
CREATE TABLE "manual_refund_actions" (
    "id" UUID NOT NULL,
    "refund_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" VARCHAR(30) NOT NULL,
    "idempotency_key" VARCHAR(200) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manual_refund_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payos_checkouts_order_code_key" ON "payos_checkouts"("order_code");

-- CreateIndex
CREATE UNIQUE INDEX "payos_checkouts_payment_link_id_key" ON "payos_checkouts"("payment_link_id");

-- CreateIndex
CREATE INDEX "manual_refunds_status_created_at_idx" ON "manual_refunds"("status", "created_at");

-- CreateIndex
CREATE INDEX "manual_refunds_assigned_admin_id_status_idx" ON "manual_refunds"("assigned_admin_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_manual_refund_bank_transfer" ON "manual_refunds"("source_bank_bin", "source_account_number", "bank_transaction_ref");

-- CreateIndex
CREATE UNIQUE INDEX "manual_refund_actions_idempotency_key_key" ON "manual_refund_actions"("idempotency_key");

-- CreateIndex
CREATE INDEX "manual_refund_actions_refund_id_created_at_idx" ON "manual_refund_actions"("refund_id", "created_at");

-- AddForeignKey
ALTER TABLE "payos_checkouts" ADD CONSTRAINT "payos_checkouts_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_refunds" ADD CONSTRAINT "manual_refunds_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_refund_actions" ADD CONSTRAINT "manual_refund_actions_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "manual_refunds"("refund_id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Keep payOS order codes representable as JSON numbers.
ALTER SEQUENCE payos_checkouts_order_code_seq MAXVALUE 9007199254740991;
