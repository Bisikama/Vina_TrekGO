import { randomUUID } from 'node:crypto'
import { Test } from '@nestjs/testing'
import { APP_GUARD } from '@nestjs/core'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { TripsModule } from '../src/modules/trips/trips.module'
import { SharedModule } from '../src/shared/shared.module'
import { PrismaService } from '../src/shared/services/prisma.service'
import { SupabaseService } from '../src/shared/services/supabase.service'
import { AuthBootstrapUseCase } from '../src/modules/identity/application/use-cases/auth-bootstrap.use-case'
import type { IUserRepository } from '../src/modules/identity/application/ports/user.port'
import {
  LeaderPublicTripController,
  PublicTripController,
  TripOptionsController,
} from '../src/modules/trips/presentation/controllers/public-trip.controller'
import { PublicTripUseCase } from '../src/modules/trips/application/use-cases/public-trip.use-case'
import { TRIP_STORE } from '../src/modules/trips/application/trip.types'
import { GlobalErrorFilter } from '../src/shared/errors'

describe('CF01 Swagger and HTTP responses without external services', () => {
  let app: INestApplication
  const leader = { id: randomUUID(), role: 'LEADER', status: 'ACTIVE' }
  const destinationId = randomUUID()
  const catalog = {
    destination: jest.fn().mockResolvedValue({ id: destinationId, status: 'ACTIVE' }),
    pickups: jest.fn().mockResolvedValue([{ id: randomUUID(), name: 'Điểm đón demo' }]),
    checkpointOptions: jest.fn().mockResolvedValue([]),
    conflicts: jest.fn().mockResolvedValue([]),
  }
  const store = {
    list: jest.fn().mockResolvedValue([]),
    read: (work: (session: typeof catalog) => unknown) => work(catalog),
  }
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [LeaderPublicTripController, TripOptionsController, PublicTripController],
      providers: [PublicTripUseCase, { provide: TRIP_STORE, useValue: store }],
    }).compile()
    app = module.createNestApplication()
    app.setGlobalPrefix('api/v1')
    app.useGlobalFilters(new GlobalErrorFilter())
    // Only the identity/database boundaries are fixtures; controller, parsing and use-case are real.
    app.use((req: any, _res: unknown, next: () => void) => {
      req.user = leader
      next()
    })
    await app.init()
  })
  afterAll(async () => {
    await app?.close()
  })

  it('documents success JSON, UUID paths, paging and required queries for all 17 operations', () => {
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('CF01').addBearerAuth().build())
    let count = 0
    for (const [path, item] of Object.entries(doc.paths)) {
      for (const method of ['get', 'post', 'put', 'patch'] as const) {
        const op = item[method]
        if (!op) continue
        count++
        expect(op.summary).toBeTruthy()
        const status = method === 'post' ? '201' : '200'
        expect((op.responses[status] as any).content['application/json'].schema.type).toMatch(/array|object/)
        if (path.includes('{id}'))
          expect(op.parameters).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                name: 'id',
                in: 'path',
                required: true,
                schema: expect.objectContaining({ format: 'uuid' }),
              }),
            ]),
          )
      }
    }
    expect(count).toBe(17)
    const prefix = '/api/v1/'
    for (const path of [
      'leader/public-trips',
      'public-trips',
      'leader/trip-options/destinations',
      'leader/trip-options/pickup-points',
      'leader/trip-options/checkpoints',
      'leader/public-trips/{id}/trail-suggestions',
    ]) {
      expect(doc.paths[prefix + path].get!.parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'page',
            in: 'query',
            required: false,
            schema: expect.objectContaining({ default: 1 }),
          }),
          expect.objectContaining({
            name: 'pageSize',
            in: 'query',
            required: false,
            schema: expect.objectContaining({ default: 20 }),
          }),
        ]),
      )
    }
    for (const kind of ['pickup-points', 'checkpoints']) {
      expect(doc.paths[prefix + 'leader/trip-options/' + kind].get!.parameters).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'destinationId', in: 'query', required: true })]),
      )
    }
    expect(doc.paths[prefix + 'leaders/me/schedule-conflicts'].get!.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'startAt', required: true }),
        expect.objectContaining({ name: 'endAt', required: true }),
        expect.objectContaining({ name: 'excludeTripId', required: false }),
      ]),
    )
  })

  it('returns JSON [] for an empty list and JSON rows for the current leader with parsed paging', async () => {
    const url = '/api/v1/leader/public-trips'
    await request(app.getHttpServer()).get(url).expect(200).expect('Content-Type', /json/).expect([])
    expect(store.list).toHaveBeenLastCalledWith(leader.id, { page: 1, pageSize: 20 })
    const row = { id: randomUUID(), title: 'Chuyến của Leader', status: 'DRAFT' }
    store.list.mockResolvedValueOnce([row])
    await request(app.getHttpServer()).get(url).query({ page: 2, pageSize: 5 }).expect(200).expect([row])
    expect(store.list).toHaveBeenLastCalledWith(leader.id, { page: 2, pageSize: 5 })
    await request(app.getHttpServer()).get(url).query({ pageSize: 101 }).expect(400)
  })

  it('accepts destination/time query inputs and returns actionable errors when required input is absent', async () => {
    for (const kind of ['pickup-points', 'checkpoints']) {
      const url = '/api/v1/leader/trip-options/' + kind
      const missing = await request(app.getHttpServer()).get(url).expect(400)
      expect(missing.body.code).toBe('VALIDATION_ERROR')
      await request(app.getHttpServer()).get(url).query({ destinationId: 'invalid' }).expect(400)
      const result = await request(app.getHttpServer()).get(url).query({ destinationId }).expect(200)
      expect(Array.isArray(result.body)).toBe(true)
    }
    const startAt = '2026-11-15T06:00:00+07:00',
      endAt = '2026-11-15T18:00:00+07:00'
    await request(app.getHttpServer())
      .get('/api/v1/leaders/me/schedule-conflicts')
      .query({ startAt, endAt })
      .expect(200)
      .expect({ hasConflict: false, conflicts: [] })
    expect(catalog.conflicts).toHaveBeenLastCalledWith(leader.id, startAt, endAt, undefined)
  })
})

const url = process.env.CF01_TEST_DATABASE_URL
if (url) {
  const parsed = new URL(url)
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || !parsed.pathname.startsWith('/cf01_test'))
    throw new Error('Isolated localhost cf01_test database required')
}
const suite = url ? describe : describe.skip
suite('CF01 HTTP boundary with real guards and database', () => {
  const db = new PrismaClient({ datasourceUrl: url || 'postgresql://unused@127.0.0.1:1/cf01_test' })
  let app: INestApplication
  let leaderToken: string
  let userToken: string
  let suspendedToken: string
  const tokens = new Map<string, { id: string; email: string }>()
  beforeAll(async () => {
    for (const kind of ['leader', 'user', 'suspended']) {
      const authUserId = randomUUID(),
        email = `${authUserId}@cf01.test`
      await db.user.create({
        data: {
          authUserId,
          email,
          fullName: kind,
          role: kind === 'user' ? 'USER' : 'LEADER',
          status: kind === 'suspended' ? 'SUSPENDED' : 'ACTIVE',
        },
      })
      const token = randomUUID()
      tokens.set(token, { id: authUserId, email })
      if (kind === 'leader') leaderToken = token
      if (kind === 'user') userToken = token
      if (kind === 'suspended') suspendedToken = token
    }
    const module = await Test.createTestingModule({ imports: [SharedModule, TripsModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .overrideProvider(SupabaseService)
      .useValue({ verifyToken: (token: string) => Promise.resolve(tokens.get(token) || null) })
      .compile()
    app = module.createNestApplication()
    app.setGlobalPrefix('api/v1')
    await app.init()
  })
  afterAll(async () => {
    await app?.close()
    await db.$disconnect()
  })
  it('requires authentication and LEADER, blocks inactive accounts', async () => {
    await request(app.getHttpServer()).get('/api/v1/leader/public-trips').expect(401)
    await request(app.getHttpServer())
      .get('/api/v1/leader/public-trips')
      .auth(userToken, { type: 'bearer' })
      .expect(403)
    await request(app.getHttpServer())
      .get('/api/v1/leader/public-trips')
      .auth(suspendedToken, { type: 'bearer' })
      .expect(403)
    await request(app.getHttpServer())
      .get('/api/v1/leader/public-trips')
      .auth(leaderToken, { type: 'bearer' })
      .expect(200)
  })
  it('validates UUID, body and pagination with stable business error codes', async () => {
    const bad = await request(app.getHttpServer())
      .post('/api/v1/leader/public-trips')
      .auth(leaderToken, { type: 'bearer' })
      .send({ status: 'OPEN' })
      .expect(400)
    expect(bad.body.code).toBe('VALIDATION_ERROR')
    await request(app.getHttpServer())
      .get('/api/v1/leader/public-trips/not-uuid')
      .auth(leaderToken, { type: 'bearer' })
      .expect(400)
    await request(app.getHttpServer()).get('/api/v1/public-trips?pageSize=99999').expect(400)
  })
  it('serves public projection without exposing ownership/route snapshots', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/public-trips').expect(200)
    for (const trip of response.body) {
      expect(trip).not.toHaveProperty('creatorId')
      expect(trip).not.toHaveProperty('trails')
      expect(['OPEN', 'FULL']).toContain(trip.status)
    }
  })
  it('generates OpenAPI for all CF01 controllers and typed request bodies', () => {
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('CF01 test').build())
    expect(doc.paths['/api/v1/leader/public-trips']?.post?.requestBody).toBeDefined()
    expect(doc.paths['/api/v1/leader/public-trips/{id}/publish']).toBeDefined()
    expect(Object.keys(doc.paths).length).toBeGreaterThanOrEqual(14)
  })
})

describe('Bootstrap cannot assign privileged roles', () => {
  it('always creates USER and looks up by authenticated identity only', async () => {
    const create = jest.fn().mockResolvedValue({ id: randomUUID(), role: 'USER' })
    const repository = { findByAuthId: jest.fn().mockResolvedValue(null), create } as unknown as IUserRepository
    await new AuthBootstrapUseCase(repository).execute({
      authUserId: randomUUID(),
      email: 'fixture@cf01.test',
      role: 'ADMIN',
    })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ role: 'USER' }))
  })
})
