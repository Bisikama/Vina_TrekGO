-- Additive SF01 migration. Abort rather than rewrite duplicate history.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM leader_applications WHERE status IN ('SUBMITTED','UNDER_REVIEW')
             GROUP BY user_id HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'SF01: duplicate open applications; resolve explicitly before migrating';
  END IF;
END $$;

ALTER TYPE media_scope ADD VALUE IF NOT EXISTS 'LEADER_CERTIFICATE';
ALTER TABLE leader_certificates ADD COLUMN media_asset_id UUID;
ALTER TABLE leader_certificates ADD CONSTRAINT leader_certificates_media_asset_id_fkey
  FOREIGN KEY (media_asset_id) REFERENCES media_assets(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX leader_certificates_media_asset_id_key ON leader_certificates(media_asset_id);
CREATE UNIQUE INDEX leader_application_one_open_per_user ON leader_applications(user_id)
  WHERE status IN ('SUBMITTED','UNDER_REVIEW');

-- Preserve certificate evidence even if a concurrent cleanup/delete checked references
-- before the submit transaction committed. Submit locks media_assets first.
CREATE FUNCTION sf01_preserve_certificate_media() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('DELETE_PENDING','DELETED') AND EXISTS
    (SELECT 1 FROM leader_certificates WHERE media_asset_id = OLD.id) THEN
    RAISE EXCEPTION 'SF01: certificate evidence is retained' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sf01_preserve_certificate_media BEFORE UPDATE OF status ON media_assets
  FOR EACH ROW EXECUTE FUNCTION sf01_preserve_certificate_media();
