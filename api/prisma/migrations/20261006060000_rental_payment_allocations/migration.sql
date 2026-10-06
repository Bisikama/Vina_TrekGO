BEGIN;
CREATE TYPE payment_allocation_component AS ENUM ('RENTAL_FEE', 'RENTAL_DEPOSIT');
CREATE TABLE payment_allocations (
 id UUID PRIMARY KEY, payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 rental_order_line_id UUID NOT NULL REFERENCES rental_order_lines(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 component payment_allocation_component NOT NULL, amount DECIMAL(12,2) NOT NULL,
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT ck_payment_allocation_amount CHECK (amount > 0 AND amount = trunc(amount))
);
CREATE UNIQUE INDEX payment_allocations_payment_id_rental_order_line_id_component_key ON payment_allocations(payment_id,rental_order_line_id,component);
CREATE INDEX payment_allocations_rental_order_line_id_idx ON payment_allocations(rental_order_line_id);
CREATE TABLE refund_allocations (
 id UUID PRIMARY KEY, refund_id UUID NOT NULL REFERENCES refunds(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 payment_allocation_id UUID NOT NULL REFERENCES payment_allocations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 amount DECIMAL(12,2) NOT NULL, created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT ck_refund_allocation_amount CHECK (amount > 0 AND amount = trunc(amount))
);
CREATE UNIQUE INDEX refund_allocations_refund_id_payment_allocation_id_key ON refund_allocations(refund_id,payment_allocation_id);
CREATE INDEX refund_allocations_payment_allocation_id_idx ON refund_allocations(payment_allocation_id);
LOCK TABLE invoices IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM invoices WHERE rental_order_id IS NOT NULL AND revision_no IS NOT NULL
 GROUP BY rental_order_id,revision_no HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate Rental invoice revisions require review'; END IF;
 IF EXISTS (SELECT 1 FROM invoices WHERE rental_order_id IS NOT NULL AND status IN ('DRAFT','PENDING_PAYMENT')
 GROUP BY rental_order_id HAVING count(*)>1) THEN RAISE EXCEPTION 'Multiple open Rental invoices require review'; END IF;
END $$;
CREATE UNIQUE INDEX invoices_rental_order_id_revision_no_key ON invoices(rental_order_id,revision_no);
CREATE UNIQUE INDEX uq_invoice_open_rental ON invoices(rental_order_id)
 WHERE rental_order_id IS NOT NULL AND status IN ('DRAFT','PENDING_PAYMENT');
COMMIT;
