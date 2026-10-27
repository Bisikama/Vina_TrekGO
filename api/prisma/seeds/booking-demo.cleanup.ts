import { Prisma } from '@prisma/client'

type DB = Prisma.TransactionClient
type Row = Record<string, any>
type Edge = { child: string; parent: string; childColumns: string[]; parentColumns: string[] }
const ALLOWED = new Set([
  'trips', 'trip_trail_plans', 'trip_active_trail_plans', 'trip_trail_switches', 'trip_checkpoints',
  'trip_transports', 'trip_cost_plans', 'trip_cost_items', 'trip_cost_step_tiers', 'trip_pricing_versions',
  'private_trip_invites', 'private_trip_member_invitations', 'trip_members', 'bookings',
  'booking_participants', 'booking_participant_invitations', 'booking_cancellations', 'trip_cancellation_requests',
  'invoices', 'invoice_lines', 'payments', 'payment_applications', 'payment_webhook_events', 'refunds',
  'mock_payment_operations', 'booking_outbox_events', 'booking_notification_receipts',
  'payment_outbox_events', 'payment_consumer_receipts', 'audit_logs', 'idempotency_records',
])
const q = (name: string) => '"' + name.replace(/"/g, '""') + '"'
const table = (name: string) => `public.${q(name)}`
export function containsOwnedId(value: unknown, ids: Set<string>): boolean {
  if (typeof value === 'string') return ids.has(value)
  if (Array.isArray(value)) return value.some((v) => containsOwnedId(v, ids))
  if (value && typeof value === 'object') return Object.values(value).some((v) => containsOwnedId(v, ids))
  return false
}
export type CleanupPlan = Awaited<ReturnType<typeof planCleanup>>

/** Follow incoming foreign keys only. Never follow a Trip's source/user references outwards. */
export async function planCleanup(db: DB, tripIds: string[]) {
  const edges = await db.$queryRaw<Edge[]>`
    SELECT child.relname AS child, parent.relname AS parent,
      array_agg(ca.attname ORDER BY k.ord) AS "childColumns",
      array_agg(pa.attname ORDER BY k.ord) AS "parentColumns"
    FROM pg_constraint fk JOIN pg_class child ON child.oid=fk.conrelid
    JOIN pg_namespace cn ON cn.oid=child.relnamespace
    JOIN pg_class parent ON parent.oid=fk.confrelid JOIN pg_namespace pn ON pn.oid=parent.relnamespace
    CROSS JOIN LATERAL unnest(fk.conkey, fk.confkey) WITH ORDINALITY k(cnum,pnum,ord)
    JOIN pg_attribute ca ON ca.attrelid=child.oid AND ca.attnum=k.cnum
    JOIN pg_attribute pa ON pa.attrelid=parent.oid AND pa.attnum=k.pnum
    WHERE fk.contype='f' AND pn.nspname='public' AND cn.nspname='public'
    GROUP BY fk.oid, child.relname, parent.relname`
  const primaryKeys = await db.$queryRaw<{ name: string; columns: string[] }[]>`
    SELECT c.relname AS name, array_agg(a.attname ORDER BY k.ord) AS columns
    FROM pg_constraint p JOIN pg_class c ON c.oid=p.conrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN LATERAL unnest(p.conkey) WITH ORDINALITY k(num,ord)
    JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.num
    WHERE p.contype='p' AND n.nspname='public' GROUP BY c.relname`
  const keys = new Map(primaryKeys.map((p) => [p.name, p.columns]))
  const rows = new Map<string, Row[]>()
  const add = (name: string, incoming: Row[]) => {
    if (!incoming.length) return false
    if (!ALLOWED.has(name)) throw new Error(`Cleanup blocked: ${name} references demo data (${incoming.length} rows). No data deleted.`)
    const pk = keys.get(name)
    if (!pk) throw new Error(`Cleanup cannot identify primary key: ${name}`)
    const all = rows.get(name) ?? []
    const id = (r: Row) => JSON.stringify(pk.map((k) => r[k]))
    const seen = new Set(all.map(id))
    const fresh = incoming.filter((r) => !seen.has(id(r)))
    rows.set(name, [...all, ...fresh])
    if ([...rows.values()].reduce((n, r) => n + r.length, 0) > 20000) throw new Error('Cleanup exceeds 20,000 demo rows; inspect manually')
    return fresh.length > 0
  }
  const fetch = async (sql: string, ...params: any[]) =>
    (await db.$queryRawUnsafe<{ row: Row }[]>(sql, ...params)).map((r) => r.row)
  add('trips', await fetch('SELECT to_jsonb(t) AS row FROM public.trips t WHERE id=ANY($1::uuid[])', tripIds))
  const owned = () => new Set([...rows.values()].flat().map((r) => r.id).filter((id) => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)))
  let changed = true
  while (changed) {
    changed = false
    for (const edge of edges) {
      const parents = rows.get(edge.parent)
      if (!parents?.length) continue
      const join = edge.childColumns.map((c, i) => `c.${q(c)}=p.${q(edge.parentColumns[i])}`).join(' AND ')
      const found = await fetch(`SELECT DISTINCT to_jsonb(c) AS row FROM ${table(edge.child)} c
        JOIN jsonb_populate_recordset(NULL::${table(edge.parent)}, $1::jsonb) p ON ${join}`, JSON.stringify(parents))
      changed = add(edge.child, found) || changed
    }
    const ids = owned()
    if (!ids.size) continue
    for (const name of ['booking_outbox_events', 'payment_outbox_events']) {
      const candidates = await fetch(`SELECT to_jsonb(e) AS row FROM ${table(name)} e
        WHERE aggregate_id=ANY($1::uuid[]) OR payload::text LIKE ANY($2::text[])`, [...ids], [...ids].map((id) => `%${id}%`))
      changed = add(name, candidates.filter((e) => ids.has(e.aggregate_id) || containsOwnedId(e.payload, ids))) || changed
    }
  }
  const ids = owned()
  if (ids.size) {
    // Some GPS projections/presence tables deliberately have no FK. Treat their logical references as blockers too.
    const logical = await db.$queryRaw<{ name: string; column: string }[]>`
      SELECT table_name AS name, column_name AS column FROM information_schema.columns
      WHERE table_schema='public' AND column_name IN ('trip_id','booking_id','booking_participant_id','recipient_participant_id') AND udt_name='uuid'`
    for (const ref of logical.filter((r) => !ALLOWED.has(r.name))) {
      const found = await fetch(`SELECT to_jsonb(t) AS row FROM ${table(ref.name)} t WHERE ${q(ref.column)}=ANY($1::uuid[]) LIMIT 1`, [...ids])
      if (found.length) throw new Error(`Cleanup blocked: ${ref.name}.${ref.column} references demo data`)
    }
    add('audit_logs', await fetch('SELECT to_jsonb(a) AS row FROM public.audit_logs a WHERE entity_id=ANY($1::uuid[])', [...ids]))
    const replay = await fetch(`SELECT to_jsonb(r) AS row FROM public.idempotency_records r
      WHERE scope LIKE 'public-invitation:%' OR scope LIKE 'private-invitation:%' OR scope LIKE 'admin-simulate-refund:%'`)
    add('idempotency_records', replay.filter((r) => r.scope.split(':').some((s: string) => ids.has(s)) || containsOwnedId(r.response_body, ids)))
    const references = new Set([...(rows.get('payments') ?? []).map((p) => p.merchant_request_ref),
      ...(rows.get('refunds') ?? []).map((p) => p.merchant_refund_ref)].filter(Boolean))
    const mocks = await fetch(`SELECT to_jsonb(m) AS row FROM public.mock_payment_operations m
      WHERE request->>'merchantRequestRef'=ANY($1::text[]) OR request->>'merchantRefundRef'=ANY($1::text[])`, [...references])
    add('mock_payment_operations', mocks)
  }
  const bookingIds = new Set((rows.get('bookings') ?? []).map((b) => b.id))
  for (const invoice of rows.get('invoices') ?? []) {
    if (invoice.invoice_type !== 'BOOKING' || !bookingIds.has(invoice.booking_id))
      throw new Error(`Cleanup blocked: invoice ${invoice.id} is not exclusively a demo booking invoice`)
  }
  for (const payment of [...(rows.get('payments') ?? []), ...(rows.get('refunds') ?? [])]) {
    if (payment.payment_gateway !== 'mock' || payment.provider_environment !== 'MOCK')
      throw new Error(`Cleanup blocked: non-MOCK financial record ${payment.id}`)
    if (payment.rental_order_id || payment.trail_access_id || payment.deposit_settlement_id || payment.deposit_settlement_item_id)
      throw new Error(`Cleanup blocked: financial record ${payment.id} is shared with another domain`)
  }
  return { rows, keys, edges, ids: [...owned()], eventIds: ['booking_outbox_events', 'payment_outbox_events']
    .flatMap((name) => (rows.get(name) ?? []).map((r) => r.id as string)),
    counts: Object.fromEntries([...rows.entries()].map(([name, r]) => [name, r.length])) }
}

export async function executeCleanup(db: DB, plan: CleanupPlan) {
  const remaining = new Set([...plan.rows.keys()])
  // Invoice revision chains are the sole supported self-reference; every selected revision is booking-owned.
  const invoices = plan.rows.get('invoices') ?? []
  if (invoices.length) await db.$executeRaw`UPDATE invoices SET supersedes_invoice_id=NULL WHERE id=ANY(${invoices.map((i) => i.id)}::uuid[])`
  while (remaining.size) {
    const leaves = [...remaining].filter((parent) => !plan.edges.some((e) =>
      e.parent === parent && remaining.has(e.child) && !(e.child === 'invoices' && e.parent === 'invoices')))
    if (!leaves.length) throw new Error(`Unsupported cleanup dependency cycle: ${[...remaining].join(', ')}`)
    for (const name of leaves) {
      const pk = plan.keys.get(name)!
      const predicate = pk.map((k) => `t.${q(k)}=r.${q(k)}`).join(' AND ')
      await db.$executeRawUnsafe(`DELETE FROM ${table(name)} t USING
        jsonb_populate_recordset(NULL::${table(name)}, $1::jsonb) r WHERE ${predicate}`, JSON.stringify(plan.rows.get(name)))
      remaining.delete(name)
    }
  }
}
