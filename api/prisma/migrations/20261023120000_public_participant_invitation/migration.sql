BEGIN;
CREATE TABLE booking_participant_invitations (
 id uuid PRIMARY KEY, booking_participant_id uuid NOT NULL REFERENCES booking_participants(id) ON DELETE RESTRICT,
 sender_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 recipient_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 recipient_email_snapshot varchar(255) NOT NULL,
 status invitation_status NOT NULL DEFAULT 'PENDING', expires_at timestamptz(6) NOT NULL,
 responded_at timestamptz(6), invalidated_at timestamptz(6), reason varchar(100),
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 created_at timestamptz(6) NOT NULL DEFAULT now(), updated_at timestamptz(6) NOT NULL DEFAULT now(),
 CHECK (sender_user_id <> recipient_user_id)
);
CREATE UNIQUE INDEX public_invitation_one_pending ON booking_participant_invitations(booking_participant_id) WHERE status='PENDING';
CREATE INDEX booking_participant_invitations_recipient_user_id_created_at_idx ON booking_participant_invitations(recipient_user_id,created_at,id);
CREATE INDEX booking_participant_invitations_sender_user_id_created_at_id_idx ON booking_participant_invitations(sender_user_id,created_at,id);
CREATE INDEX booking_participant_invitations_status_expires_at_idx ON booking_participant_invitations(status,expires_at);
CREATE INDEX booking_participant_invitations_booking_participant_id_creat_idx ON booking_participant_invitations(booking_participant_id,created_at,id);
COMMIT;
