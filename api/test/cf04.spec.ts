import { randomUUID } from 'crypto'
import { readFileSync } from 'fs'
import { join as joinPath } from 'path'
import { Client } from 'pg'
import { PrismaClient, Trip, User } from '@prisma/client'
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { TripsModule } from '../src/modules/trips/trips.module'
import { SharedModule } from '../src/shared/shared.module'
import { PrismaService } from '../src/shared/services/prisma.service'
import { SupabaseService } from '../src/shared/services/supabase.service'
import { GlobalErrorFilter } from '../src/shared/errors'
import { PrivateMembershipUseCase } from '../src/modules/trips/application/use-cases/private-membership.use-case'
import { PrismaPrivateMembershipAdapter } from '../src/modules/trips/infrastructure/adapters/prisma-private-membership.adapter'
import { PrivateTripUseCase } from '../src/modules/trips/application/use-cases/private-trip.use-case'
import { PrismaPrivateTripAdapter } from '../src/modules/trips/infrastructure/adapters/prisma-private-trip.adapter'

const url = process.env.CF04_TEST_DATABASE_URL
if (url) {
  const u = new URL(url)
  if (!['localhost', '127.0.0.1'].includes(u.hostname) || u.pathname !== '/cf04_test')
    throw new Error('Only isolated localhost cf04_test is allowed')
}
;(url ? describe : describe.skip)('CF04 PostgreSQL, real shared guards and HTTP contract', () => {
  const db = new PrismaClient({ datasourceUrl: url ?? 'postgresql://unused@127.0.0.1:1/cf04_test' })
  const member = new PrivateMembershipUseCase(new PrismaPrivateMembershipAdapter(db as unknown as PrismaService))
  const hostApi = new PrivateTripUseCase(new PrismaPrivateTripAdapter(db as unknown as PrismaService))
  const tokens = new Map<string, { id: string; email: string }>()
  let app: INestApplication, host: User, guest: User, other: User, trip: Trip, code: string
  const newUser = async () => {
    const u = await db.user.create({
      data: { authUserId: randomUUID(), email: `${randomUUID()}@cf04.test`, fullName: 'Test member', role: 'USER' },
    })
    tokens.set(u.id, { id: u.authUserId, email: u.email })
    return u
  }
  const invite = async () => {
    const current = await db.trip.findUniqueOrThrow({ where: { id: trip.id } })
    return (await hostApi.invite(host, trip.id, current.version)) as {
      inviteCode: string
      tripVersion: number
      inviteUrl: string
    }
  }
  const join = (u = guest, c = code) =>
    member.join(u, c) as Promise<{
      alreadyMember: boolean
      rejoined: boolean
      membership: { id: string; version: number }
      activeMemberCount: number
    }>
  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [SharedModule, TripsModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .overrideProvider(SupabaseService)
      .useValue({ verifyToken: (t: string) => Promise.resolve(tokens.get(t) ?? null) })
      .compile()
    app = m.createNestApplication()
    app.setGlobalPrefix('api/v1')
    app.useGlobalFilters(new GlobalErrorFilter())
    await app.init()
  })
  afterAll(async () => {
    await app?.close()
    await db.$disconnect()
  })
  beforeEach(async () => {
    host = await newUser()
    guest = await newUser()
    other = await newUser()
    const d = await db.destination.create({ data: { name: 'CF04 test' } })
    const p = await db.pickupPoint.create({
      data: {
        destinationId: d.id,
        code: randomUUID(),
        name: 'Private pickup',
        address: 'Private address',
        latitude: 10,
        longitude: 106,
        createdBy: host.id,
      },
    })
    const t = await db.personalTrail.create({
      data: {
        userId: host.id,
        destinationId: d.id,
        title: 'Private route',
        routeGeojson: {
          type: 'LineString',
          coordinates: [
            [106, 10],
            [106, 11],
          ],
        },
      },
    })
    const cp = await db.personalCheckpoint.create({
      data: { personalTrailId: t.id, name: 'Secret checkpoint', latitude: 11, longitude: 106, sequence: 1 },
    })
    trip = (await hostApi.create(host, {
      type: 'PERSONAL',
      trailRef: t.id,
      destinationId: d.id,
      title: 'CF04 trip',
      startAt: new Date(Date.now() + 10 * 86400000).toISOString(),
      endAt: new Date(Date.now() + 11 * 86400000).toISOString(),
      pickupPointId: p.id,
      capacity: 3,
      checkpointIds: [cp.id],
    })) as Trip
    code = (await invite()).inviteCode
  })
  it('counts HOST once; creator reads room and cannot leave/remove self', async () => {
    const h = await db.tripMember.findFirstOrThrow({ where: { tripId: trip.id, role: 'HOST' } })
    expect(h.userId).toBe(host.id)
    expect(await member.room(host, trip.id)).toMatchObject({
      trip: { activeMemberCount: 1 },
      viewer: { isHost: true },
      permissions: { canRent: false },
    })
    await expect(member.leave(host, trip.id, h.version)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(member.remove(host, trip.id, h.id, h.version)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await db.trip.update({ where: { id: trip.id }, data: { maxPax: 1 } })
    await expect(join()).rejects.toMatchObject({ code: 'CAPACITY_CONFLICT' })
    await db.tripMember.delete({ where: { id: h.id } }) // local fixture: historical trip without HOST
    expect(await member.room(host, trip.id)).toMatchObject({ viewer: { isHost: true } })
  })
  it('public preview is minimal, no-store, and does not auto-join', async () => {
    const r = await request(app.getHttpServer()).get(`/api/v1/private-trip-invitations/${code}`).expect(200)
    expect(r.headers['cache-control']).toBe('no-store')
    expect(r.body.trip.activeMemberCount).toBe(1)
    for (const forbidden of ['Private address', 'Secret checkpoint', 'routeGeojson', host.email, code])
      expect(JSON.stringify(r.body)).not.toContain(forbidden)
    expect(await db.tripMember.count({ where: { tripId: trip.id } })).toBe(1)
  })
  it('enforces real shared auth, USER role, bootstrap and account status', async () => {
    const endpoint = `/api/v1/private-trip-invitations/${code}/join`
    expect((await request(app.getHttpServer()).post(endpoint).send({}).expect(401)).body.error.code).toBe(
      'UNAUTHENTICATED',
    )
    for (const role of ['LEADER', 'STAFF_INVENTORY', 'STAFF_DELIVERY', 'ADMIN'] as const) {
      await db.user.update({ where: { id: guest.id }, data: { role } })
      expect(
        (await request(app.getHttpServer()).post(endpoint).auth(guest.id, { type: 'bearer' }).send({}).expect(403)).body
          .error.code,
      ).toBe('FORBIDDEN')
    }
    await db.user.update({ where: { id: guest.id }, data: { role: 'USER', status: 'SUSPENDED' } })
    await request(app.getHttpServer()).post(endpoint).auth(guest.id, { type: 'bearer' }).send({}).expect(403)
    tokens.set('not-bootstrapped', { id: randomUUID(), email: 'missing@cf04.test' })
    await request(app.getHttpServer()).post(endpoint).auth('not-bootstrapped', { type: 'bearer' }).send({}).expect(401)
  })
  it('joins once, emits one event and returns stable 200 duplicate response', async () => {
    const path = `/api/v1/private-trip-invitations/${code}/join`
    const r = await request(app.getHttpServer()).post(path).auth(guest.id, { type: 'bearer' }).send({}).expect(200)
    expect(r.body.alreadyMember).toBe(false)
    expect(r.body.redirectTo).toBe(`/private-trips/${trip.id}`)
    const repeat = await request(app.getHttpServer()).post(path).auth(guest.id, { type: 'bearer' }).send({}).expect(200)
    expect(repeat.body.alreadyMember).toBe(true)
    expect((await db.privateTripInvite.findUniqueOrThrow({ where: { code } })).usedCount).toBe(1)
    expect(
      await db.bookingOutboxEvent.count({ where: { aggregateId: trip.id, eventType: 'PRIVATE_TRIP_MEMBER_JOINED' } }),
    ).toBe(1)
    expect(await db.booking.count({ where: { tripId: trip.id } })).toBe(0)
  })
  it('serializes two users on the last slot and duplicate concurrent join', async () => {
    await db.trip.update({ where: { id: trip.id }, data: { maxPax: 2 } })
    const results = await Promise.allSettled([join(guest), join(other)])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.find((r) => r.status === 'rejected')).toMatchObject({ reason: { code: 'CAPACITY_CONFLICT' } })
    expect(await db.tripMember.count({ where: { tripId: trip.id, status: 'ACTIVE' } })).toBe(2)
    const winner = await db.tripMember.findFirstOrThrow({ where: { tripId: trip.id, role: 'MEMBER' } })
    const u = winner.userId === guest.id ? guest : other
    expect((await Promise.all([join(u), join(u)])).every((r) => r.alreadyMember)).toBe(true)
    expect((await db.privateTripInvite.findUniqueOrThrow({ where: { code } })).usedCount).toBe(1)
  })
  it('LEFT reuses membership, frees a slot, resets state, blocks stale leave', async () => {
    const first = await join()
    await member.leave(guest, trip.id, first.membership.version)
    const second = await join()
    expect(second.rejoined).toBe(true)
    expect(second.membership.id).toBe(first.membership.id)
    expect(second.membership.version).toBe(3)
    await expect(member.leave(guest, trip.id, 1)).rejects.toMatchObject({ code: 'MEMBERSHIP_VERSION_CONFLICT' })
    expect((await db.privateTripInvite.findUniqueOrThrow({ where: { code } })).usedCount).toBe(2)
    expect(
      await db.bookingOutboxEvent.count({ where: { aggregateId: trip.id, eventType: 'PRIVATE_TRIP_MEMBER_JOINED' } }),
    ).toBe(2)
  })
  it('two initial join requests from the same user produce only one transition', async () => {
    const results = await Promise.all([join(), join()])
    expect(results.filter((r) => !r.alreadyMember)).toHaveLength(1)
    expect(results.filter((r) => r.alreadyMember)).toHaveLength(1)
    expect(results[0].membership.id).toBe(results[1].membership.id)
    expect((await db.privateTripInvite.findUniqueOrThrow({ where: { code } })).usedCount).toBe(1)
    expect(
      await db.bookingOutboxEvent.count({ where: { aggregateId: trip.id, eventType: 'PRIVATE_TRIP_MEMBER_JOINED' } }),
    ).toBe(1)
  })
  it('REMOVED is blocked on new codes and loses all private read access', async () => {
    const first = await join()
    await member.remove(host, trip.id, first.membership.id, 1)
    const fresh = await invite()
    await expect(join(guest, fresh.inviteCode)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(member.room(guest, trip.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(member.members(guest, trip.id, { page: 1, pageSize: 20, status: 'ACTIVE' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    expect(await member.remove(host, trip.id, first.membership.id, 1)).toMatchObject({ changed: false })
    expect((await join(other, fresh.inviteCode)).activeMemberCount).toBe(2)
  })
  it('expired/revoked/full/started do not block an existing ACTIVE member', async () => {
    await join()
    await db.privateTripInvite.update({ where: { code }, data: { status: 'REVOKED', revokedAt: new Date() } })
    expect((await join()).alreadyMember).toBe(true)
    await expect(join(other)).rejects.toMatchObject({ code: 'INVITE_REVOKED' })
    await db.trip.update({ where: { id: trip.id }, data: { startAt: new Date(Date.now() - 1000), maxPax: 2 } })
    expect((await join()).alreadyMember).toBe(true)
    await expect(join(other)).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' })
  })
  it('validates expiry and revoke with shared 400/404/409/410 contract', async () => {
    await request(app.getHttpServer()).get('/api/v1/private-trip-invitations/bad').expect(400)
    await request(app.getHttpServer())
      .get(`/api/v1/private-trip-invitations/${'z'.repeat(43)}`)
      .expect(404)
    await db.privateTripInvite.update({ where: { code }, data: { expiresAt: new Date(Date.now() - 1000) } })
    const expired = await request(app.getHttpServer()).get(`/api/v1/private-trip-invitations/${code}`).expect(410)
    expect(expired.body.error.code).toBe('INVITE_EXPIRED')
    expect(expired.body.meta.requestId).toBeTruthy()
    code = (await invite()).inviteCode
    const latest = await db.trip.findUniqueOrThrow({ where: { id: trip.id } })
    await request(app.getHttpServer())
      .post(`/api/v1/private-trips/${trip.id}/invitations/revoke`)
      .auth(host.id, { type: 'bearer' })
      .send({ expectedVersion: latest.version })
      .expect(200)
    expect(
      (await request(app.getHttpServer()).get(`/api/v1/private-trip-invitations/${code}`).expect(410)).body.error.code,
    ).toBe('INVITE_REVOKED')
  })
  it('scopes members and room projections and blocks arbitrary targets', async () => {
    const first = await join()
    const room = await member.room(guest, trip.id)
    expect(room).toMatchObject({ rental: { eligible: false }, requiredCheckpoints: [{ name: 'Secret checkpoint' }] })
    expect(JSON.stringify(room)).not.toContain(host.email)
    expect(JSON.stringify(room)).not.toContain(code)
    await expect(member.room(other, trip.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(member.members(guest, trip.id, { page: 1, pageSize: 20, status: 'ALL' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(member.remove(other, trip.id, first.membership.id, 1)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(member.remove(host, trip.id, randomUUID(), 1)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await request(app.getHttpServer())
      .get(`/api/v1/private-trips/${trip.id}/members?pageSize=1000`)
      .auth(host.id, { type: 'bearer' })
      .expect(400)
  })
  it('rejects leave/remove after start and rolls back join when outbox insert fails', async () => {
    const first = await join()
    await member.leave(guest, trip.id, 1)
    await db.bookingOutboxEvent.create({
      data: {
        deduplicationKey: `PRIVATE_TRIP_MEMBER_JOINED:${first.membership.id}:3`,
        eventType: 'TEST_COLLISION',
        aggregateType: 'PRIVATE_TRIP',
        aggregateId: trip.id,
        payload: {},
      },
    })
    await expect(join()).rejects.toBeDefined()
    expect((await db.tripMember.findUniqueOrThrow({ where: { id: first.membership.id } })).status).toBe('LEFT')
    expect((await db.privateTripInvite.findUniqueOrThrow({ where: { code } })).usedCount).toBe(1)
    const otherMember = await join(other)
    await db.trip.update({ where: { id: trip.id }, data: { startAt: new Date(Date.now() - 1000) } })
    await expect(member.leave(other, trip.id, 1)).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' })
    await expect(member.remove(host, trip.id, otherMember.membership.id, 1)).rejects.toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
    })
  })
  it('revoke/cancel races cannot admit a new user after their commit', async () => {
    const before = await db.trip.findUniqueOrThrow({ where: { id: trip.id } })
    await Promise.allSettled([join(guest), hostApi.revoke(host, trip.id, before.version)])
    const latest = await db.trip.findUniqueOrThrow({ where: { id: trip.id } })
    await hostApi.revoke(host, trip.id, latest.version)
    await expect(join(other)).rejects.toMatchObject({ code: 'INVITE_REVOKED' })
    const fresh = await invite()
    const now = await db.trip.findUniqueOrThrow({ where: { id: trip.id } })
    await hostApi.cancel(host, trip.id, now.version)
    await expect(join(other, fresh.inviteCode)).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' })
  })
  it('database enforces one host and one active invite; swagger exposes CF04 routes', async () => {
    await expect(
      db.tripMember.create({ data: { tripId: trip.id, userId: other.id, role: 'HOST' } }),
    ).rejects.toMatchObject({ code: 'P2002' })
    await expect(
      db.privateTripInvite.create({
        data: { tripId: trip.id, createdBy: host.id, code: randomUUID(), expiresAt: new Date(Date.now() + 86400000) },
      }),
    ).rejects.toMatchObject({ code: 'P2002' })
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().addBearerAuth().build())
    expect(doc.paths['/api/v1/private-trip-invitations/{code}/join'].post).toBeDefined()
    expect(doc.paths['/api/v1/private-trips/{id}/room'].get).toBeDefined()
  })
  it('migration backfills safe legacy HOST rows and refuses over-capacity without partial changes', async () => {
    const sql = readFileSync(
      joinPath(__dirname, '../prisma/migrations/20260929120000_cf04_private_membership/migration.sql'),
      'utf8',
    )
      .replace(/^BEGIN;/, '')
      .replace(/COMMIT;\s*$/, '')
    const client = new Client({ connectionString: url })
    await client.connect()
    try {
      for (const unsafe of [false, true]) {
        await client.query('BEGIN')
        try {
          await client.query('DROP INDEX private_trip_one_active_invite; DROP INDEX trip_member_one_host;')
          await client.query("DELETE FROM trip_members WHERE trip_id=$1 AND role='HOST'", [trip.id])
          if (unsafe) {
            await client.query('UPDATE trips SET max_pax=1 WHERE id=$1', [trip.id])
            await client.query(
              "INSERT INTO trip_members(id,trip_id,user_id,role,status,updated_at) VALUES($1,$2,$3,'MEMBER','ACTIVE',now())",
              [randomUUID(), trip.id, other.id],
            )
            await expect(client.query(sql)).rejects.toThrow('capacity would be exceeded')
          } else {
            await client.query(sql)
            const result = await client.query("SELECT user_id FROM trip_members WHERE trip_id=$1 AND role='HOST'", [
              trip.id,
            ])
            expect(result.rows).toEqual([{ user_id: host.id }])
          }
        } finally {
          await client.query('ROLLBACK')
        }
      }
    } finally {
      await client.end()
    }
    expect(await db.tripMember.count({ where: { tripId: trip.id, role: 'HOST' } })).toBe(1)
  })
})
