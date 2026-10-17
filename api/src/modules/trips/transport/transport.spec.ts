import { Test } from '@nestjs/testing'
import { APP_GUARD } from '@nestjs/core'
import type { INestApplication } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import request from 'supertest'
import { TransportController } from './transport.controller'
import { TransportService } from './transport.service'
import { PrismaService } from '../../../shared/services/prisma.service'
import { GlobalErrorFilter } from '../../../shared/errors'
import { RolesGuard } from '../../../shared/guards/roles.guard'

describe('Admin transport HTTP and business flow', () => {
  const tripId = '00000000-0000-4000-8000-000000000001'
  const providerId = '00000000-0000-4000-8000-000000000002'
  const transportId = '00000000-0000-4000-8000-000000000003'
  let app: INestApplication
  let role = 'ADMIN'
  let row: any
  const trip = { id: tripId, tripType: 'PUBLIC', status: 'OPEN', pickupPointId: tripId,
    startAt: new Date('2099-01-01T08:00:00Z'), endAt: new Date('2099-01-02T08:00:00Z') }
  const provider = { id: providerId, name: 'Nhà xe test', status: 'ACTIVE' }
  const db: any = {
    user: { findUnique: jest.fn(async () => ({ role, status: 'ACTIVE' })) },
    trip: { findUnique: jest.fn(async () => trip) },
    pickupPoint: { findUnique: jest.fn(async () => ({ status: 'ACTIVE' })) },
    transportProvider: {
      findUnique: jest.fn(async () => provider),
      create: jest.fn(async ({ data }) => ({ id: providerId, ...data })),
      update: jest.fn(async ({ data }) => ({ ...provider, ...data })),
    },
    tripTransport: {
      aggregate: jest.fn(async () => ({ _max: { sequence: row?.sequence ?? null } })),
      create: jest.fn(async ({ data }) => (row = { id: transportId, version: 1, ...data })),
      findFirst: jest.fn(async ({ where }) => row?.tripId === where.tripId ? row : null),
      updateMany: jest.fn(async ({ where, data }) => {
        if (where.version !== row.version) return { count: 0 }
        row = { ...row, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)), version: row.version + 1 }
        return { count: 1 }
      }),
      findUniqueOrThrow: jest.fn(async () => row),
      findMany: jest.fn(async () => row ? [row] : []),
    },
    auditLog: { create: jest.fn(async () => ({})) },
    $queryRaw: jest.fn(async () => []),
    $transaction: jest.fn(async work => work(db)),
  }
  const root = `/api/v1/admin/public-trips/${tripId}/transports`
  const input = { providerId, vehicleType: 'Xe 16 chỗ', seatCapacity: 16, meetingAt: '2099-01-01T07:30:00Z' }
  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [TransportController],
      providers: [TransportService, { provide: PrismaService, useValue: db }, { provide: APP_GUARD, useClass: RolesGuard }],
    }).compile()
    app = mod.createNestApplication()
    app.setGlobalPrefix('api/v1')
    app.useGlobalFilters(new GlobalErrorFilter())
    app.use((req: any, _res: unknown, next: () => void) => { req.user = { id: tripId, role }; next() })
    await app.init()
  })
  afterAll(async () => { await app.close() })
  beforeEach(() => {
    role = 'ADMIN'; row = undefined; provider.status = 'ACTIVE'; trip.status = 'OPEN'; trip.tripType = 'PUBLIC'
    jest.clearAllMocks()
  })
  it('creates provider and records, confirms, completes driver details and cancels a transport', async () => {
    await request(app.getHttpServer()).post('/api/v1/admin/transport-providers')
      .send({ name: 'Nhà xe test', phone: '0901234567' }).expect(201)
    const created = await request(app.getHttpServer()).post(root).send(input).expect(201)
    expect(created.body).toMatchObject({ pickupPointId: tripId, sourceType: 'THIRD_PARTY', sequence: 1, status: 'PLANNED' })
    await request(app.getHttpServer()).patch(`${root}/${transportId}`)
      .send({ expectedVersion: 1, status: 'CONFIRMED' }).expect(200)
    provider.status = 'INACTIVE' // Existing assignment remains editable; only new assignments are blocked.
    await request(app.getHttpServer()).patch(`${root}/${transportId}`).send({
      expectedVersion: 2, plateNumber: 'TEST-001', driverName: 'Tài xế test', driverPhone: '0901234567',
    }).expect(200)
    const cancelled = await request(app.getHttpServer()).patch(`${root}/${transportId}`)
      .send({ expectedVersion: 3, status: 'CANCELLED', note: 'Đổi phương án đón' }).expect(200)
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', version: 4 })
    expect((await request(app.getHttpServer()).get(root).expect(200)).body).toHaveLength(1)
    expect(db.auditLog.create).toHaveBeenCalledTimes(5)
    await request(app.getHttpServer()).patch(`${root}/${transportId}`)
      .send({ expectedVersion: 4, status: 'PLANNED' }).expect(409)
  })
  it('enforces admin role and uses the global validation error envelope', async () => {
    role = 'LEADER'
    await request(app.getHttpServer()).post(root).send(input).expect(403)
    expect(db.tripTransport.create).not.toHaveBeenCalled()
    role = 'ADMIN'
    const response = await request(app.getHttpServer()).post(root).send({ ...input, seatCapacity: 0 }).expect(400)
    expect(response.body.error).toMatchObject({ code: 'VALIDATION_ERROR', retryable: false })
    expect(response.body.meta.requestId).toBeTruthy()
  })
  it('rejects inactive providers, private/closed trips and invalid schedule', async () => {
    provider.status = 'INACTIVE'
    expect((await request(app.getHttpServer()).post(root).send(input).expect(409)).body.error.code)
      .toBe('TRIP_TRANSPORT_PROVIDER_UNAVAILABLE')
    provider.status = 'ACTIVE'; trip.tripType = 'PRIVATE'
    await request(app.getHttpServer()).post(root).send(input).expect(404)
    trip.tripType = 'PUBLIC'; trip.status = 'CANCELLED'
    await request(app.getHttpServer()).post(root).send(input).expect(409)
    trip.status = 'OPEN'
    await request(app.getHttpServer()).post(root).send({ ...input, meetingAt: '2099-01-01T09:00:00Z' }).expect(400)
    expect(db.tripTransport.create).not.toHaveBeenCalled()
  })
  it('rejects stale versions and a vehicle accessed through a different trip', async () => {
    await request(app.getHttpServer()).post(root).send(input).expect(201)
    const stale = await request(app.getHttpServer()).patch(`${root}/${transportId}`)
      .send({ expectedVersion: 2, status: 'CONFIRMED' }).expect(409)
    expect(stale.body.error.code).toBe('TRIP_TRANSPORT_VERSION_CONFLICT')
    await request(app.getHttpServer()).patch(`/api/v1/admin/public-trips/${providerId}/transports/${transportId}`)
      .send({ expectedVersion: 1, status: 'CONFIRMED' }).expect(404)
    expect(db.tripTransport.updateMany).not.toHaveBeenCalled()
  })
  it('documents all six operations and excludes costs and pickup overrides from requests', () => {
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().addBearerAuth().build())
    expect(Object.keys(doc.paths)).toHaveLength(4)
    const operation = doc.paths['/api/v1/admin/public-trips/{tripId}/transports'].post!
    const body = (operation.requestBody as any).content['application/json'].schema
    expect(body.properties.providerId.format).toBe('uuid')
    expect(body.properties.pickupPointId).toBeUndefined()
    expect(body.properties.cost).toBeUndefined()
  })
})
