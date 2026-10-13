-- Preserve all existing policies and booking snapshots. Existing rows are historical publications.
ALTER TABLE booking_policies ADD COLUMN published_at timestamptz(6), ADD COLUMN revision integer NOT NULL DEFAULT 1;
UPDATE booking_policies SET published_at = created_at;
ALTER TABLE booking_policies ALTER COLUMN is_active SET DEFAULT false;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM booking_policies a JOIN booking_policies b ON a.policy_code = b.policy_code AND a.id < b.id
    WHERE a.is_active AND b.is_active
      AND tstzrange(a.effective_from, a.effective_to, '[)') && tstzrange(b.effective_from, b.effective_to, '[)')
  ) THEN RAISE EXCEPTION 'Booking policy intervals overlap; reconcile explicitly before migration'; END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE booking_policies
  ADD CONSTRAINT booking_policy_valid_interval CHECK (effective_to IS NULL OR effective_to > effective_from),
  ADD CONSTRAINT booking_policy_positive_version CHECK (version_no > 0 AND revision > 0),
  ADD CONSTRAINT booking_policy_valid_ttl CHECK (hold_ttl_minutes BETWEEN 1 AND 1440) NOT VALID,
  ADD CONSTRAINT booking_policy_draft_inactive CHECK (published_at IS NOT NULL OR NOT is_active),
  ADD CONSTRAINT booking_policy_no_overlap EXCLUDE USING gist
    (policy_code WITH =, tstzrange(effective_from, effective_to, '[)') WITH &&)
    WHERE (is_active AND published_at IS NOT NULL);

CREATE FUNCTION protect_booking_policy_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Same serialization key as the runtime resolver and admin publisher.
  PERFORM pg_advisory_xact_lock(hashtextextended('booking-policy:PUBLIC_BOOKING_DEFAULT', 0));
  IF TG_OP = 'DELETE' THEN
    IF OLD.published_at IS NOT NULL THEN RAISE EXCEPTION 'Published booking policy cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.published_at IS NOT NULL THEN
    IF (to_jsonb(NEW) - 'effective_to') IS DISTINCT FROM (to_jsonb(OLD) - 'effective_to') THEN
      RAISE EXCEPTION 'Published booking policy content is immutable';
    END IF;
    IF NEW.effective_to IS DISTINCT FROM OLD.effective_to AND
      (OLD.effective_to IS NOT NULL OR NEW.effective_to IS NULL OR NEW.effective_to < date_trunc('milliseconds', transaction_timestamp())) THEN
      RAISE EXCEPTION 'Only prospective closure of a published policy is allowed';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER booking_policy_preserve_history BEFORE UPDATE OR DELETE ON booking_policies
  FOR EACH ROW EXECUTE FUNCTION protect_booking_policy_history();
