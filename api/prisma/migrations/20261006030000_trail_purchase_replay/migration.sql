-- Additive replay storage supports free grants without a fabricated successful Payment.
CREATE TABLE "trail_purchase_requests" (
  "id" CHAR(64) PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "system_trail_id" UUID NOT NULL REFERENCES "system_trails"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "trail_access_id" UUID NOT NULL REFERENCES "trail_accesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "invoice_id" UUID REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "payment_method" VARCHAR(80) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ck_trail_purchase_request" CHECK ("id" ~ '^[0-9a-f]{64}$' AND "payment_method" IN ('QR', 'REDIRECT'))
);
CREATE INDEX "trail_purchase_requests_trail_access_id_idx" ON "trail_purchase_requests"("trail_access_id");
