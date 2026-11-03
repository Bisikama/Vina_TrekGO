# Trip cancellation rollout

## Business contract

Customers may voluntarily cancel while a Public Trip is CANCEL_PENDING. Existing Rental prerequisites and voluntary policies still apply. Once Admin approval commits, remaining bookings are cancelled by ORGANIZER, linked to the approved request. Cancelled/expired orders are not reopened or topped up, regardless of their refund status. Rental orders are evaluated independently: already cancelled rentals retain their refund decision; equipment already handed over requires return and settlement.

Approval and voluntary cancellation acquire the same Trip row lock. Approval is allowed after scheduled departure only if no startedAt, completedAt, checked-in participant or operated booking exists. Rejection restores registration using previous status, current time, deadline and occupied seats; it does not revive cancelled orders.

## Deploy

1. Run `npx prisma migrate deploy` and `npx prisma generate` in api/. Migration 20261030000100 is additive. It saves a persistent rollout timestamp; older events are not automatically replayed.
2. Run `npm run test:trip-cancellations`. The runner requires localhost PostgreSQL permission to create a disposable database named trek_cancel_test_<uuid>; both DATABASE_URL and DIRECT_URL are redirected. It never truncates the configured database and drops only its generated test database.
3. Set `TRIP_CANCELLATION_WORKER_ENABLED=true` in the API environment, then restart the API. The flag defaults off; Admin review is unavailable while it is off. Existing Payment event/recovery workers must also be enabled for money recovery.
4. Verify RENTAL_PRIMARY_INVENTORY_LOCATION_ID points to an ACTIVE primary warehouse.
5. Admin UI: /admin/trip-cancellation-requests. Leader UI: /leader/trip-cancellation-requests. Shared global error envelopes apply to the new endpoints.

## Delivery operations

Each consumer has its own durable receipt, claim token and 120-second lease. Workers process at most four batches of 25 every two seconds. Failures back off to at most 300 seconds and stop after eight claims, including crashed leases. Completed delivery means domain processing committed, not that the payment provider refunded the customer.

GET /api/v1/admin/trip-cancellation-requests/:id exposes delivery attempts/errors, remaining bookings, action-required rentals and refund status separately. A failed delivery can be retried from the UI with a mandatory operational note. This resets delivery attempts, never the original refund identity or approved amount.

POST /api/v1/admin/trip-cancellation-requests/deliveries/:eventId/retry accepts `{consumer, note}`. Consumer must be trip-bookings-v1 or rental-lifecycle-v1. Event type must belong to that consumer. New explicit replays and retries are recorded in idempotency_records under trip-cancellation-replay-audit.

## Historical reconciliation (read only first)

```sql
SELECT id, trip_id, requested_at, previous_trip_status
FROM trip_cancellation_requests WHERE status='PENDING' ORDER BY requested_at;

SELECT e.id, e.event_type, e.aggregate_id, e.created_at
FROM booking_outbox_events e CROSS JOIN cancellation_worker_settings w
LEFT JOIN rental_inbox_events i ON i.event_id=e.id::text
WHERE e.created_at < w.started_at
  AND e.event_type IN ('TRIP_CANCELLED','PRIVATE_TRIP_CANCELLED','BOOKING_CANCELLED',
    'PRIVATE_TRIP_MEMBER_LEFT','PRIVATE_TRIP_MEMBER_REMOVED')
  AND i.id IS NULL ORDER BY e.created_at,e.id;

SELECT consumer,status,count(*),min(next_attempt_at) AS oldest_due
FROM cancellation_deliveries GROUP BY consumer,status;
```

Review each historical event against current order status, custody and prior refunds before an explicitly noted replay. Do not delete RentalInboxEvent, reset successful refunds or move the rollout timestamp backwards to replay everything. Existing corrupt/unfinished legacy inbox records require investigation; they are not silently acknowledged.

Already acknowledged events with incorrect historical effects need a separate, reviewed repair event. The worker never upgrades earlier voluntary cancellations.

## Monitoring and rollback

Watch pending/running age, failed deliveries, action-required rentals, payment NEEDS_REVIEW and failed refunds. Domain completion and provider money completion are independent. To stop new automatic cancellation work, set TRIP_CANCELLATION_WORKER_ENABLED=false and restart; recorded approvals/jobs remain durable. Do not roll back the additive migration or reverse confirmed refunds.
