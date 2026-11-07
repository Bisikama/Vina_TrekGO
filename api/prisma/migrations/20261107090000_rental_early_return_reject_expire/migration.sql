-- Early return: admin rejection and automatic expiry of unconfirmed requests.
ALTER TABLE "rental_early_return_requests" DROP CONSTRAINT "rental_early_return_requests_status_check";
ALTER TABLE "rental_early_return_requests" ADD CONSTRAINT "rental_early_return_requests_status_check"
  CHECK ("status" IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'SUPERSEDED', 'REJECTED', 'EXPIRED'));

ALTER TABLE "rental_early_return_requests"
  ADD COLUMN "rejected_by" UUID REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD COLUMN "rejected_at" TIMESTAMPTZ(6),
  ADD COLUMN "rejection_reason" VARCHAR(500),
  ADD COLUMN "expired_at" TIMESTAMPTZ(6);

ALTER TABLE "rental_early_return_requests" ADD CONSTRAINT "rental_early_return_requests_rejection_shape"
  CHECK ("status" <> 'REJECTED' OR ("rejected_at" IS NOT NULL AND "rejection_reason" IS NOT NULL));
