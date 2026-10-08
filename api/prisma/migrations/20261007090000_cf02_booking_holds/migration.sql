-- Additive: legacy bookings retain nullable replay metadata.
ALTER TABLE bookings ADD COLUMN create_idempotency_key CHAR(64), ADD COLUMN create_request_hash CHAR(64);
CREATE UNIQUE INDEX bookings_create_idempotency_key_key ON bookings(create_idempotency_key);
ALTER TABLE bookings ADD CONSTRAINT ck_booking_create_replay CHECK (
  (create_idempotency_key IS NULL) = (create_request_hash IS NULL)
);
