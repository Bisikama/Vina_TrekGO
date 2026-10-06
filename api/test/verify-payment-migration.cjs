// Only an explicitly provided NEW, EMPTY localhost payment_test_* database is accepted.
// Does not load .env, reset databases, delete legacy records or contact a provider.
const { Client } = require('pg');
const { readFileSync, readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { randomUUID: uuid } = require('node:crypto');
const assert = require('node:assert/strict');

async function main() {
  const connectionString = process.env.PAYMENT_MIGRATION_TEST_URL;
  if (!connectionString) throw new Error('Set PAYMENT_MIGRATION_TEST_URL to a new empty localhost payment_test_* database');
  const url = new URL(connectionString);
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/payment_test_[a-z0-9_]+$/.test(url.pathname))
    throw new Error('Isolated localhost payment_test_* database required');
  const db = new Client({ connectionString });
  await db.connect();
  const q = (sql, values) => db.query(sql, values);
  let checks = 0;
  const rejects = async (sql, values, code, constraint) => {
    await assert.rejects(q(sql, values), (e) => [code].flat().includes(e.code) && (!constraint || e.constraint === constraint));
    checks++;
  };
  try {
    assert.equal((await q("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'")).rows[0].n, 0);
    const root = resolve(__dirname, '../prisma/migrations');
    const migrations = readdirSync(root).filter((n) => /^\d/.test(n)).sort();
    for (const name of migrations.filter((n) => n < '20261004090000'))
      await q(readFileSync(resolve(root, name, 'migration.sql'), 'utf8'));

    const user = uuid(), destination = uuid(), pickup = uuid(), trip = uuid(), policy = uuid(), booking = uuid();
    await q('INSERT INTO users(id,auth_user_id,email,full_name) VALUES($1::uuid,$2,$3,$4)', [user, uuid(), `${user}@test.invalid`, 'Migration fixture']);
    await q('INSERT INTO destinations(id,name) VALUES($1::uuid,$2)', [destination, 'Fixture']);
    await q("INSERT INTO pickup_points(id,code,name,address,latitude,longitude,created_by) VALUES($1::uuid,'FIXTURE','Fixture','Fixture',0,0,$2)", [pickup, user]);
    await q("INSERT INTO trips(id,trip_type,title,destination_id,creator_id,start_at,end_at,max_pax) VALUES($1::uuid,'PUBLIC','Fixture',$2,$3,'2035-01-01','2035-01-02',10)", [trip, destination, user]);
    await q("INSERT INTO booking_policies(id,policy_code,version_no,hold_ttl_minutes,cancellation_rules,effective_from) VALUES($1::uuid,'FIXTURE',1,15,'{}',now())", [policy]);
    await q("INSERT INTO bookings(id,trip_id,user_id,pickup_point_id,return_point_id,booking_policy_id,participant_count,price_per_pax_snapshot,subtotal_amount,total_amount,policy_snapshot,expires_at) VALUES($1::uuid,$2,$3,$4,$4,$5,1,1000,1000,1000,'{}','2035-01-01')", [booking, trip, user, pickup, policy]);
    const invoice = uuid(), otherInvoice = uuid(), legacyPayment = uuid();
    for (const id of [invoice, otherInvoice])
      await q("INSERT INTO invoices(id,invoice_no,user_id,invoice_type,booking_id,subtotal_amount,total_amount,status) VALUES($1::uuid,$1::text,$2,'BOOKING',$3,1000,1000,'PAID')", [id, user, booking]);
    await q("INSERT INTO payments(id,invoice_id,amount,payment_gateway,status,idempotency_key) VALUES($1::uuid,$2,1000,'mock','SUCCEEDED',$1::text)", [legacyPayment, invoice]);
    await q("INSERT INTO payment_webhook_events(id,payment_gateway,provider_event_id,payload,processed,processed_at) VALUES($1::uuid,'mock','legacy','{}',true,now())", [uuid()]);
    const before = (await q('SELECT * FROM payments WHERE id=$1', [legacyPayment])).rows[0];
    for (const name of migrations.filter((n) => n >= '20261004090000'))
      await q(readFileSync(resolve(root, name, 'migration.sql'), 'utf8'));
    const after = (await q('SELECT * FROM payments WHERE id=$1', [legacyPayment])).rows[0];
    for (const key of Object.keys(before)) assert.deepEqual(after[key], before[key]);
    assert.equal(after.provider_environment, null);
    assert.equal(after.request_hash, null);
    assert.equal((await q('SELECT revision_no FROM invoices WHERE id=$1', [invoice])).rows[0].revision_no, null);
    checks++;

    const paymentSql = `INSERT INTO payments(id,invoice_id,amount,payment_gateway,status,idempotency_key,
      provider_environment,merchant_account_key,merchant_request_ref,request_hash,request_hash_version,payment_method,transaction_ref)
      VALUES($1::uuid,$2,$3,'mock',$4,$1::text,$5,'merchant',$1::text,repeat('a',64),1,'QR',$6)`;
    const p1 = uuid(), p2 = uuid();
    await q(paymentSql, [p1, invoice, '1000', 'PENDING', 'SANDBOX', null]);
    await rejects(paymentSql, [uuid(), invoice, '1000', 'PROCESSING', 'SANDBOX', null], '23505', 'uq_payments_open_attempt');
    await q("UPDATE payments SET status='SUCCEEDED', transaction_ref='txn-1' WHERE id=$1", [p1]);
    await rejects(paymentSql, [uuid(), invoice, '1000', 'SUCCEEDED', 'SANDBOX', 'txn-1'], '23505', 'uq_payments_provider_transaction');
    await q(paymentSql, [p2, invoice, '1000', 'SUCCEEDED', 'SANDBOX', 'txn-2']);
    await q(paymentSql, [uuid(), invoice, '1000', 'SUCCEEDED', 'MOCK', 'txn-1']);
    await rejects(paymentSql, [uuid(), invoice, '0', 'SUCCEEDED', 'SANDBOX', null], '23514', 'ck_payments_amount');
    await rejects(paymentSql, [uuid(), invoice, '1.50', 'SUCCEEDED', 'SANDBOX', null], '23514', 'ck_payments_amount');
    await rejects('UPDATE payments SET merchant_account_key=NULL WHERE id=$1', [p1], '23514', 'ck_payments_metadata');
    await rejects('UPDATE payments SET lease_token=$2 WHERE id=$1', [p1, uuid()], '23514', 'ck_payments_worker');

    const applied = `INSERT INTO payment_applications(id,payment_id,invoice_id,status,applied_at,decided_at)
      VALUES($1::uuid,$2,$3,'APPLIED',now(),now())`;
    await q(applied, [uuid(), p1, invoice]);
    await rejects(applied, [uuid(), p2, invoice], '23505', 'uq_payment_application_applied');
    await rejects(applied, [uuid(), p2, otherInvoice], '23503', 'payment_applications_payment_id_invoice_id_fkey');
    await rejects("INSERT INTO payment_applications(id,payment_id,invoice_id,status) VALUES($1::uuid,$2,$3,'REJECTED')", [uuid(), p2, invoice], '23514', 'ck_payment_applications_decision');
    await q("INSERT INTO payment_applications(id,payment_id,invoice_id,status,reason_code,decided_at) VALUES($1::uuid,$2,$3,'REJECTED','DUPLICATE_PAYMENT',now())", [uuid(), p2, invoice]);

    const refund = uuid();
    const refundSql = `INSERT INTO refunds(id,payment_id,purpose,amount,idempotency_key,reason_code,business_action_id,
      payment_gateway,provider_environment,merchant_account_key,merchant_refund_ref,request_hash,request_hash_version)
      VALUES($1::uuid,$2,'TECHNICAL_REVERSAL',1000,$1::text,$3,$4,'mock','SANDBOX','merchant',$1::text,repeat('b',64),1)`;
    await rejects(refundSql, [uuid(), p2, null, 'null-reason'], '23514', 'ck_refunds_purpose_source');
    await rejects(refundSql, [uuid(), p2, 'INVALID', 'bad-reason'], '23514', 'ck_refunds_purpose_source');
    await q(refundSql, [refund, p2, 'DUPLICATE_PAYMENT', `technical-reversal:${p2}`]);
    await rejects(refundSql, [uuid(), p2, 'DUPLICATE_PAYMENT', `technical-reversal:${p2}`], '23505', 'refunds_payment_id_business_action_id_key');
    await q(refundSql, [uuid(), legacyPayment, 'DOMAIN_NOT_ELIGIBLE', `technical-reversal:${legacyPayment}`]);
    await rejects("INSERT INTO refunds(id,payment_id,purpose,amount,idempotency_key) VALUES($1::uuid,$2,'BOOKING_CANCELLATION',100,$1::text)", [uuid(), p1], '23514', 'ck_refunds_purpose_source');
    const cancel = uuid();
    await q("INSERT INTO booking_cancellations(id,booking_id,policy_snapshot,source,idempotency_key) VALUES($1::uuid,$2,'{}','USER',$1::text)", [cancel, booking]);
    await q("INSERT INTO refunds(id,payment_id,purpose,amount,idempotency_key,booking_cancellation_id) VALUES($1::uuid,$2,'BOOKING_CANCELLATION',100,$1::text,$3)", [uuid(), p1, cancel]);
    await rejects('DELETE FROM booking_cancellations WHERE id=$1', [cancel], ['23503', '23001']);

    const webhookSql = `INSERT INTO payment_webhook_events(id,payment_gateway,provider_event_id,payload,provider_environment,
      merchant_account_key,event_kind,payload_hash,processing_status,verified_at)
      VALUES($1::uuid,'mock','event-1','{}',$2,'merchant','PAYMENT',repeat('c',64),'RECEIVED',now())`;
    const event = uuid();
    await q(webhookSql, [event, 'SANDBOX']);
    await rejects(webhookSql, [uuid(), 'SANDBOX'], '23505', 'uq_payment_webhooks_provider_event');
    await q(webhookSql, [uuid(), 'MOCK']);
    await rejects("INSERT INTO payment_webhook_events(id,payment_gateway,provider_event_id,payload) VALUES($1::uuid,'mock','legacy','{}')", [uuid()], '23505', 'uq_payment_webhooks_legacy_event');
    await rejects('UPDATE payment_webhook_events SET processed=true WHERE id=$1', [event], '23514', 'ck_payment_webhooks_processing');
    await q("UPDATE payment_webhook_events SET processed=true,processed_at=now(),processing_status='PROCESSED' WHERE id=$1", [event]);

    await rejects("UPDATE invoices SET invoice_type='RENTAL' WHERE id=$1", [invoice], '23514', 'ck_invoices_source_type');
    await rejects('UPDATE invoices SET total_amount=999 WHERE id=$1', [invoice], '23514', 'ck_invoices_amounts');
    await q('UPDATE invoices SET revision_no=1 WHERE id=$1', [invoice]);
    await rejects('UPDATE invoices SET revision_no=1 WHERE id=$1', [otherInvoice], '23505', 'invoices_booking_id_revision_no_key');
    await q("UPDATE invoices SET status='PENDING_PAYMENT' WHERE id=$1", [invoice]);
    await rejects("UPDATE invoices SET status='DRAFT' WHERE id=$1", [otherInvoice], '23505', 'uq_invoice_open_booking');
    await rejects('DELETE FROM bookings WHERE id=$1', [booking], ['23503', '23001']);

    const outbox = uuid();
    await q("INSERT INTO payment_outbox_events(id,deduplication_key,event_type,aggregate_type,aggregate_id,payload) VALUES($1::uuid,$1::text,'PAYMENT_SUCCEEDED','Payment',$2,'{}')", [outbox, p1]);
    await q("INSERT INTO payment_consumer_receipts(event_id,consumer_name) VALUES($1::uuid,'booking')", [outbox]);
    await rejects("INSERT INTO payment_consumer_receipts(event_id,consumer_name) VALUES($1::uuid,'booking')", [outbox], '23505', 'payment_consumer_receipts_pkey');

    // Real competing transactions, not mocks: a second checkout must wait and lose to the committed attempt.
    const contender = new Client({ connectionString });
    await contender.connect();
    try {
      await contender.query("SET statement_timeout='5s'");
      await q('BEGIN');
      await q(paymentSql, [uuid(), otherInvoice, '1000', 'PENDING', 'MOCK', null]);
      const pending = contender.query(paymentSql, [uuid(), otherInvoice, '1000', 'PENDING', 'MOCK', null]).then(() => null, (e) => e);
      await q('COMMIT');
      assert.equal((await pending)?.constraint, 'uq_payments_open_attempt');
      checks++;
    } finally { await contender.end(); }
    console.log(`PASS: ${checks} migration/business checks; legacy data preserved; real PostgreSQL uniqueness, FK, CHECK and competing checkout verified.`);
  } finally { await db.end(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

