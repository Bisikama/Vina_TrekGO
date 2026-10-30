CREATE TABLE cancellation_worker_settings (
  id integer PRIMARY KEY CHECK (id = 1),
  started_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO cancellation_worker_settings(id) VALUES (1);
CREATE TABLE cancellation_deliveries (
  event_id uuid NOT NULL REFERENCES booking_outbox_events(id) ON DELETE RESTRICT,
  consumer varchar(100) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','RUNNING','COMPLETED','FAILED')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  lease_owner uuid,
  last_error varchar(160),
  completed_at timestamptz,
  PRIMARY KEY(event_id, consumer)
);
CREATE INDEX cancellation_delivery_retry_idx ON cancellation_deliveries(consumer, status, next_attempt_at);
