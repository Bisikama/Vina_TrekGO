-- Durable MOCK-only provider simulator. Recovery jobs remain on payments/refunds.
CREATE TABLE "mock_payment_operations" (
  "id" CHAR(64) NOT NULL,
  "kind" "payment_webhook_kind" NOT NULL,
  "request_hash" CHAR(64) NOT NULL,
  "request" JSONB NOT NULL,
  "result" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mock_payment_operations_pkey" PRIMARY KEY ("id")
);
