-- Expand payment storage without guessing legacy merchant, hash or revision metadata.
-- Existing CHECK violations are retained with NOT VALID; new/updated rows must comply.
-- Unique index conflicts intentionally abort: audit legacy duplicates before deployment.
BEGIN;

-- CreateEnum
CREATE TYPE "payment_environment" AS ENUM ('MOCK', 'SANDBOX', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "payment_reconcile_status" AS ENUM ('IDLE', 'SCHEDULED', 'RUNNING', 'NEEDS_REVIEW', 'RESOLVED');

-- CreateEnum
CREATE TYPE "payment_webhook_kind" AS ENUM ('PAYMENT', 'REFUND');

-- CreateEnum
CREATE TYPE "payment_webhook_processing_status" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'RETRY', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "payment_application_status" AS ENUM ('PENDING', 'APPLIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "booking_cancellation_source" AS ENUM ('USER', 'ORGANIZER', 'ADMIN');

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_booking_id_fkey";

-- DropForeignKey
ALTER TABLE "refunds" DROP CONSTRAINT "refunds_booking_cancellation_id_fkey";

-- DropIndex
DROP INDEX "payment_webhook_events_payment_gateway_provider_event_id_key";

-- AlterTable
ALTER TABLE "booking_cancellations" ADD COLUMN     "idempotency_key" VARCHAR(200),
ADD COLUMN     "source" "booking_cancellation_source",
ADD COLUMN     "trip_cancellation_request_id" UUID;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "revision_no" INTEGER,
ADD COLUMN     "supersedes_invoice_id" UUID;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "checkout_data" JSONB,
ADD COLUMN     "expires_at" TIMESTAMPTZ(6),
ADD COLUMN     "last_checked_at" TIMESTAMPTZ(6),
ADD COLUMN     "last_error_code" VARCHAR(100),
ADD COLUMN     "lease_token" UUID,
ADD COLUMN     "lease_until" TIMESTAMPTZ(6),
ADD COLUMN     "merchant_account_key" VARCHAR(100),
ADD COLUMN     "merchant_request_ref" VARCHAR(180),
ADD COLUMN     "next_retry_at" TIMESTAMPTZ(6),
ADD COLUMN     "payment_method" VARCHAR(80),
ADD COLUMN     "provider_environment" "payment_environment",
ADD COLUMN     "reconcile_status" "payment_reconcile_status" NOT NULL DEFAULT 'IDLE',
ADD COLUMN     "request_hash" CHAR(64),
ADD COLUMN     "request_hash_version" INTEGER,
ADD COLUMN     "retry_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "payment_webhook_events" ADD COLUMN     "attempt_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "event_kind" "payment_webhook_kind",
ADD COLUMN     "lease_token" UUID,
ADD COLUMN     "lease_until" TIMESTAMPTZ(6),
ADD COLUMN     "merchant_account_key" VARCHAR(100),
ADD COLUMN     "next_retry_at" TIMESTAMPTZ(6),
ADD COLUMN     "payload_hash" CHAR(64),
ADD COLUMN     "processing_status" "payment_webhook_processing_status",
ADD COLUMN     "provider_environment" "payment_environment",
ADD COLUMN     "refund_id" UUID,
ADD COLUMN     "verified_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "refunds" ADD COLUMN     "business_action_id" VARCHAR(200),
ADD COLUMN     "last_checked_at" TIMESTAMPTZ(6),
ADD COLUMN     "last_error_code" VARCHAR(100),
ADD COLUMN     "lease_token" UUID,
ADD COLUMN     "lease_until" TIMESTAMPTZ(6),
ADD COLUMN     "merchant_account_key" VARCHAR(100),
ADD COLUMN     "merchant_refund_ref" VARCHAR(180),
ADD COLUMN     "next_retry_at" TIMESTAMPTZ(6),
ADD COLUMN     "payment_gateway" VARCHAR(80),
ADD COLUMN     "provider_environment" "payment_environment",
ADD COLUMN     "reason_code" VARCHAR(80),
ADD COLUMN     "reconcile_status" "payment_reconcile_status" NOT NULL DEFAULT 'IDLE',
ADD COLUMN     "request_hash" CHAR(64),
ADD COLUMN     "request_hash_version" INTEGER,
ADD COLUMN     "retry_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "payment_applications" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "status" "payment_application_status" NOT NULL DEFAULT 'PENDING',
    "reason_code" VARCHAR(80),
    "applied_at" TIMESTAMPTZ(6),
    "decided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_outbox_events" (
    "id" UUID NOT NULL,
    "deduplication_key" VARCHAR(220) NOT NULL,
    "event_type" VARCHAR(140) NOT NULL,
    "aggregate_type" VARCHAR(100) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "event_status" NOT NULL DEFAULT 'PENDING',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "next_retry_at" TIMESTAMPTZ(6),
    "lease_until" TIMESTAMPTZ(6),
    "lease_token" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6),
    "processed_at" TIMESTAMPTZ(6),

    CONSTRAINT "payment_outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_consumer_receipts" (
    "event_id" UUID NOT NULL,
    "consumer_name" VARCHAR(100) NOT NULL,
    "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_consumer_receipts_pkey" PRIMARY KEY ("event_id","consumer_name")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_applications_payment_id_key" ON "payment_applications"("payment_id");

-- CreateIndex
CREATE INDEX "payment_applications_invoice_id_idx" ON "payment_applications"("invoice_id");

-- CreateIndex
CREATE INDEX "payment_applications_status_created_at_idx" ON "payment_applications"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_applications_payment_id_invoice_id_key" ON "payment_applications"("payment_id", "invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_outbox_events_deduplication_key_key" ON "payment_outbox_events"("deduplication_key");

-- CreateIndex
CREATE INDEX "payment_outbox_events_status_next_retry_at_idx" ON "payment_outbox_events"("status", "next_retry_at");

-- CreateIndex
CREATE INDEX "payment_outbox_events_aggregate_type_aggregate_id_created_a_idx" ON "payment_outbox_events"("aggregate_type", "aggregate_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "booking_cancellations_idempotency_key_key" ON "booking_cancellations"("idempotency_key");

-- CreateIndex
CREATE INDEX "booking_cancellations_trip_cancellation_request_id_idx" ON "booking_cancellations"("trip_cancellation_request_id");

-- CreateIndex
CREATE INDEX "invoices_supersedes_invoice_id_idx" ON "invoices"("supersedes_invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_booking_id_revision_no_key" ON "invoices"("booking_id", "revision_no");

-- CreateIndex
CREATE INDEX "payments_reconcile_status_next_retry_at_idx" ON "payments"("reconcile_status", "next_retry_at");

-- CreateIndex
CREATE INDEX "payments_status_created_at_idx" ON "payments"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_id_invoice_id_key" ON "payments"("id", "invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_payments_merchant_request" ON "payments"("payment_gateway", "provider_environment", "merchant_account_key", "merchant_request_ref");

-- CreateIndex
CREATE UNIQUE INDEX "uq_payments_provider_transaction" ON "payments"("payment_gateway", "provider_environment", "merchant_account_key", "transaction_ref");

-- CreateIndex
CREATE INDEX "payment_webhook_events_processing_status_next_retry_at_idx" ON "payment_webhook_events"("processing_status", "next_retry_at");

-- CreateIndex
CREATE INDEX "payment_webhook_events_refund_id_idx" ON "payment_webhook_events"("refund_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_payment_webhooks_provider_event" ON "payment_webhook_events"("payment_gateway", "provider_environment", "merchant_account_key", "provider_event_id");

-- CreateIndex
CREATE INDEX "refunds_reconcile_status_next_retry_at_idx" ON "refunds"("reconcile_status", "next_retry_at");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_payment_id_business_action_id_key" ON "refunds"("payment_id", "business_action_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_refunds_merchant_request" ON "refunds"("payment_gateway", "provider_environment", "merchant_account_key", "merchant_refund_ref");

-- CreateIndex
CREATE UNIQUE INDEX "uq_refunds_provider_transaction" ON "refunds"("payment_gateway", "provider_environment", "merchant_account_key", "refund_transaction_ref");

-- AddForeignKey
ALTER TABLE "booking_cancellations" ADD CONSTRAINT "booking_cancellations_trip_cancellation_request_id_fkey" FOREIGN KEY ("trip_cancellation_request_id") REFERENCES "trip_cancellation_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_supersedes_invoice_id_fkey" FOREIGN KEY ("supersedes_invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_booking_cancellation_id_fkey" FOREIGN KEY ("booking_cancellation_id") REFERENCES "booking_cancellations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_applications" ADD CONSTRAINT "payment_applications_payment_id_invoice_id_fkey" FOREIGN KEY ("payment_id", "invoice_id") REFERENCES "payments"("id", "invoice_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_applications" ADD CONSTRAINT "payment_applications_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_consumer_receipts" ADD CONSTRAINT "payment_consumer_receipts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "payment_outbox_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma 6 cannot express these partial indexes or row CHECK constraints.
-- Preserve legacy deduplication while allowing the same provider event in another scope.
CREATE UNIQUE INDEX "uq_payment_webhooks_legacy_event"
ON "payment_webhook_events" ("payment_gateway", "provider_event_id")
WHERE "provider_environment" IS NULL AND "merchant_account_key" IS NULL;

CREATE UNIQUE INDEX "uq_payments_open_attempt" ON "payments" ("invoice_id")
WHERE "status" IN ('PENDING', 'PROCESSING');
CREATE UNIQUE INDEX "uq_payment_application_applied" ON "payment_applications" ("invoice_id")
WHERE "status" = 'APPLIED';
-- Booking only: other teams own their invoice revision rollout.
CREATE UNIQUE INDEX "uq_invoice_open_booking" ON "invoices" ("booking_id")
WHERE "booking_id" IS NOT NULL AND "status" IN ('DRAFT', 'PENDING_PAYMENT');

ALTER TABLE "invoices" ADD CONSTRAINT "ck_invoices_source_type" CHECK (
  ("invoice_type" = 'BOOKING' AND "booking_id" IS NOT NULL AND "rental_order_id" IS NULL AND "trail_access_id" IS NULL)
  OR ("invoice_type" = 'RENTAL' AND "rental_order_id" IS NOT NULL AND "booking_id" IS NULL AND "trail_access_id" IS NULL)
  OR ("invoice_type" = 'TRAIL_ACCESS' AND "trail_access_id" IS NOT NULL AND "booking_id" IS NULL AND "rental_order_id" IS NULL)
) NOT VALID;
ALTER TABLE "invoices" ADD CONSTRAINT "ck_invoices_amounts" CHECK (
  "subtotal_amount" >= 0 AND "discount_amount" >= 0 AND "discount_amount" <= "subtotal_amount"
  AND "total_amount" = "subtotal_amount" - "discount_amount"
  AND ("currency" <> 'VND' OR ("subtotal_amount" = trunc("subtotal_amount")
    AND "discount_amount" = trunc("discount_amount") AND "total_amount" = trunc("total_amount")))
) NOT VALID;
ALTER TABLE "invoices" ADD CONSTRAINT "ck_invoices_revision" CHECK (
  ("revision_no" IS NULL OR "revision_no" > 0)
  AND ("supersedes_invoice_id" IS NULL OR ("revision_no" IS NOT NULL AND "revision_no" > 1 AND "supersedes_invoice_id" <> "id"))
) NOT VALID;
ALTER TABLE "invoice_lines" ADD CONSTRAINT "ck_invoice_lines_amounts" CHECK (
  "quantity" > 0 AND "unit_amount" >= 0 AND "line_amount" >= 0
  AND "line_amount" = round("quantity" * "unit_amount", 2)
) NOT VALID;

ALTER TABLE "payments" ADD CONSTRAINT "ck_payments_amount" CHECK (
  "amount" > 0 AND ("currency" <> 'VND' OR "amount" = trunc("amount"))
) NOT VALID;
ALTER TABLE "payments" ADD CONSTRAINT "ck_payments_metadata" CHECK (
  num_nonnulls("provider_environment", "merchant_account_key", "merchant_request_ref", "request_hash", "request_hash_version", "payment_method") = 0
  OR (num_nonnulls("provider_environment", "merchant_account_key", "merchant_request_ref", "request_hash", "request_hash_version", "payment_method") = 6
    AND length(trim("merchant_account_key")) > 0 AND length(trim("merchant_request_ref")) > 0
    AND length(trim("payment_method")) > 0 AND "request_hash" ~ '^[0-9a-f]{64}$' AND "request_hash_version" > 0)
) NOT VALID;
ALTER TABLE "payments" ADD CONSTRAINT "ck_payments_worker" CHECK (
  "retry_count" >= 0 AND (("lease_token" IS NULL) = ("lease_until" IS NULL))
) NOT VALID;

ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "ck_payment_webhooks_metadata" CHECK (
  num_nonnulls("provider_environment", "merchant_account_key", "event_kind", "payload_hash", "processing_status", "verified_at") = 0
  OR (num_nonnulls("provider_environment", "merchant_account_key", "event_kind", "payload_hash", "processing_status", "verified_at") = 6
    AND length(trim("merchant_account_key")) > 0 AND "payload_hash" ~ '^[0-9a-f]{64}$')
) NOT VALID;
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "ck_payment_webhooks_processing" CHECK (
  "attempt_count" >= 0 AND (("lease_token" IS NULL) = ("lease_until" IS NULL))
  AND ("refund_id" IS NULL OR ("event_kind" IS NOT NULL AND "event_kind" = 'REFUND'))
  AND ("processing_status" IS NULL OR (
    ("processing_status" = 'PROCESSED' AND "processed" AND "processed_at" IS NOT NULL)
    OR ("processing_status" <> 'PROCESSED' AND NOT "processed" AND "processed_at" IS NULL)))
) NOT VALID;

ALTER TABLE "refunds" ADD CONSTRAINT "ck_refunds_metadata" CHECK (
  num_nonnulls("payment_gateway", "provider_environment", "merchant_account_key", "merchant_refund_ref", "request_hash", "request_hash_version", "business_action_id") = 0
  OR (num_nonnulls("payment_gateway", "provider_environment", "merchant_account_key", "merchant_refund_ref", "request_hash", "request_hash_version", "business_action_id") = 7
    AND length(trim("payment_gateway")) > 0 AND length(trim("merchant_account_key")) > 0
    AND length(trim("merchant_refund_ref")) > 0 AND length(trim("business_action_id")) > 0
    AND "request_hash" ~ '^[0-9a-f]{64}$' AND "request_hash_version" > 0)
) NOT VALID;
ALTER TABLE "refunds" ADD CONSTRAINT "ck_refunds_worker_currency" CHECK (
  "retry_count" >= 0 AND (("lease_token" IS NULL) = ("lease_until" IS NULL))
  AND ("currency" <> 'VND' OR "amount" = trunc("amount"))
) NOT VALID;

-- Preserve all four existing source branches, including settlement AND item for DEPOSIT.
ALTER TABLE "refunds" DROP CONSTRAINT "ck_refunds_purpose_source";
ALTER TABLE "refunds" ADD CONSTRAINT "ck_refunds_purpose_source" CHECK (
  ("purpose" = 'DEPOSIT' AND ("deposit_settlement_id" IS NOT NULL OR "deposit_settlement_item_id" IS NOT NULL)
    AND "booking_cancellation_id" IS NULL AND "rental_order_id" IS NULL AND "trail_access_id" IS NULL)
  OR ("purpose" = 'BOOKING_CANCELLATION' AND "booking_cancellation_id" IS NOT NULL
    AND "deposit_settlement_id" IS NULL AND "deposit_settlement_item_id" IS NULL AND "rental_order_id" IS NULL AND "trail_access_id" IS NULL)
  OR ("purpose" = 'RENTAL_CANCELLATION' AND "rental_order_id" IS NOT NULL
    AND "deposit_settlement_id" IS NULL AND "deposit_settlement_item_id" IS NULL AND "booking_cancellation_id" IS NULL AND "trail_access_id" IS NULL)
  OR ("purpose" = 'TRAIL_ACCESS' AND "trail_access_id" IS NOT NULL
    AND "deposit_settlement_id" IS NULL AND "deposit_settlement_item_id" IS NULL AND "booking_cancellation_id" IS NULL AND "rental_order_id" IS NULL)
  OR ("purpose" = 'TECHNICAL_REVERSAL' AND "reason_code" IS NOT NULL
    AND "reason_code" IN ('LATE_PAYMENT', 'DUPLICATE_PAYMENT', 'DOMAIN_NOT_ELIGIBLE')
    AND "business_action_id" IS NOT NULL
    AND "deposit_settlement_id" IS NULL AND "deposit_settlement_item_id" IS NULL
    AND "booking_cancellation_id" IS NULL AND "rental_order_id" IS NULL AND "trail_access_id" IS NULL)
);

ALTER TABLE "booking_cancellations" ADD CONSTRAINT "ck_booking_cancellations_origin" CHECK (
  (("source" IS NULL) = ("idempotency_key" IS NULL))
  AND ("idempotency_key" IS NULL OR length(trim("idempotency_key")) > 0)
  AND ("trip_cancellation_request_id" IS NULL OR ("source" IS NOT NULL AND "source" IN ('ORGANIZER', 'ADMIN')))
) NOT VALID;
ALTER TABLE "payment_applications" ADD CONSTRAINT "ck_payment_applications_decision" CHECK (
  ("status" = 'PENDING' AND "applied_at" IS NULL AND "decided_at" IS NULL AND "reason_code" IS NULL)
  OR ("status" = 'APPLIED' AND "applied_at" IS NOT NULL AND "decided_at" IS NOT NULL AND "reason_code" IS NULL)
  OR ("status" = 'REJECTED' AND "applied_at" IS NULL AND "decided_at" IS NOT NULL
    AND "reason_code" IS NOT NULL AND length(trim("reason_code")) > 0)
);
ALTER TABLE "payment_outbox_events" ADD CONSTRAINT "ck_payment_outbox_worker" CHECK (
  "retry_count" >= 0 AND (("lease_token" IS NULL) = ("lease_until" IS NULL))
);

COMMIT;
