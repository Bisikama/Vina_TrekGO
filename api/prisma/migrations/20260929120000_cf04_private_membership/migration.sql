BEGIN;
-- Serialize preflight/backfill with membership and invite writers. No data is deleted.
LOCK TABLE trips, trip_members, private_trip_invites IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT trip_id FROM trip_members WHERE role = 'HOST' GROUP BY trip_id HAVING count(*) > 1)
     OR EXISTS (SELECT trip_id FROM private_trip_invites WHERE status = 'ACTIVE' GROUP BY trip_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'CF04 preflight: duplicate host or active invitation; resolve explicitly before migrating';
  END IF;
  IF EXISTS (SELECT 1 FROM trip_members m JOIN trips t ON t.id=m.trip_id
             WHERE t.trip_type='PRIVATE' AND m.role='HOST' AND m.user_id<>t.creator_id)
     OR EXISTS (SELECT 1 FROM trips t JOIN trip_members m ON m.trip_id=t.id AND m.user_id=t.creator_id
                WHERE t.trip_type='PRIVATE' AND t.status='OPEN' AND (m.role<>'HOST' OR m.status<>'ACTIVE')) THEN
    RAISE EXCEPTION 'CF04 preflight: existing creator membership requires manual review';
  END IF;
  IF EXISTS (SELECT 1 FROM trips t WHERE t.trip_type='PRIVATE' AND t.status='OPEN'
    AND (SELECT count(*) FROM trip_members m WHERE m.trip_id=t.id AND m.status='ACTIVE')
      + CASE WHEN EXISTS (SELECT 1 FROM trip_members m WHERE m.trip_id=t.id AND m.user_id=t.creator_id) THEN 0 ELSE 1 END > t.max_pax) THEN
    RAISE EXCEPTION 'CF04 preflight: capacity would be exceeded by host backfill';
  END IF;
END $$;
-- Historical completed/cancelled trips deliberately retain their old membership history.
INSERT INTO trip_members (id,trip_id,user_id,pickup_point_id,role,status,joined_at,created_at,updated_at)
SELECT gen_random_uuid(),t.id,t.creator_id,t.pickup_point_id,'HOST','ACTIVE',t.created_at,now(),now()
FROM trips t WHERE t.trip_type='PRIVATE' AND t.status='OPEN'
AND NOT EXISTS (SELECT 1 FROM trip_members m WHERE m.trip_id=t.id AND m.user_id=t.creator_id);
CREATE UNIQUE INDEX private_trip_one_active_invite ON private_trip_invites(trip_id) WHERE status='ACTIVE';
CREATE UNIQUE INDEX trip_member_one_host ON trip_members(trip_id) WHERE role='HOST';
COMMIT;
