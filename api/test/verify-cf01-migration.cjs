// Run only against a NEW, empty localhost database named cf01_test_upgrade*.
// Never reads .env; never drops/recreates a database or truncates existing tables.
const { Client } = require('pg')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')

async function main() {
  const connectionString = process.env.CF01_MIGRATION_TEST_URL
  if (!connectionString) throw new Error('Set CF01_MIGRATION_TEST_URL to an empty localhost cf01_test_upgrade database')
  const url = new URL(connectionString)
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.startsWith('/cf01_test_upgrade'))
    throw new Error('Isolated upgrade database required')
  const db = new Client({ connectionString })
  await db.connect()
  try {
    const tables = await db.query(
      "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public'",
    )
    assert.equal(tables.rows[0].count, 0, 'Refusing to operate on a non-empty database')
    for (const migration of ['20260926103348_align_rental_flow', '20260927060956_update_gps'])
      await db.query(readFileSync(resolve(__dirname, '../prisma/migrations', migration, 'migration.sql'), 'utf8'))
    const user = randomUUID(),
      destination = randomUUID()
    await db.query('INSERT INTO users(id,auth_user_id,email,full_name) VALUES($1,$2,$3,$4)', [
      user,
      randomUUID(),
      `${user}@fixture.test`,
      'Preserve me',
    ])
    await db.query('INSERT INTO destinations(id,name) VALUES($1,$2)', [destination, 'Legacy destination'])
    for (const type of ['PUBLIC', 'PRIVATE'])
      await db.query(
        "INSERT INTO trips(id,trip_type,title,destination_id,creator_id,start_at,end_at,max_pax) VALUES($1,$2,$3,$4,$5,'2035-01-01','2035-01-02',5)",
        [randomUUID(), type, `${type} legacy`, destination, user],
      )
    const before = (await db.query('SELECT * FROM trips ORDER BY id')).rows
    const catalogBefore = (await db.query('SELECT * FROM destinations')).rows
    await db.query('BEGIN')
    await db.query(
      readFileSync(resolve(__dirname, '../prisma/migrations/20260927120000_cf01_trip_planning/migration.sql'), 'utf8'),
    )
    await db.query('COMMIT')
    const after = (await db.query('SELECT * FROM trips ORDER BY id')).rows
    for (const row of after) {
      assert.equal(row.pickup_point_id, null)
      delete row.pickup_point_id
    }
    assert.deepEqual(after, before)
    assert.deepEqual((await db.query('SELECT * FROM destinations')).rows, catalogBefore)
    await assert.rejects(
      db.query('UPDATE trips SET pickup_point_id=$1 WHERE id=$2', [randomUUID(), before[0].id]),
      (e) => e.code === '23503',
    )
    console.log('PASS: migration preserves legacy PUBLIC/PRIVATE rows and catalog, adds nullable pickup, enforces FK.')
  } finally {
    await db.end()
  }
}
main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
