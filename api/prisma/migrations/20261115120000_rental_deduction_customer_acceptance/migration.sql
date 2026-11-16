-- RB-API-617: the customer may accept a published deduction, which closes the review window early.
ALTER TABLE "rental_exception_cases" ADD COLUMN "customer_accepted_at" TIMESTAMPTZ(6);
