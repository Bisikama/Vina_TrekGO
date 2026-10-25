import { randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { APP_GUARD, Reflector } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { GlobalErrorFilter } from '../../../../shared/errors'
import { AccessTokenGuard } from '../../../../shared/guards/access-token.guard'
import { AuthenticationGuard } from '../../../../shared/guards/authentication.guard'
import { ApiKeyGuard } from '../../../../shared/guards/api-key.guard'
import { PrismaService } from '../../../../shared/services/prisma.service'
import { SupabaseService } from '../../../../shared/services/supabase.service'
import { TripHistoryPort } from '../../application/trip-history.port'
import { TripHistoryUseCase } from '../../application/use-cases/trip-history.use-case'
import { PrismaTripHistoryAdapter } from '../../infrastructure/adapters/prisma-trip-history.adapter'
import { TripHistoryController } from './trip-history.controller'

describe('My trip history HTTP (real guards, validation, use case and adapter)', () => {
  let app: INestApplication
  const user = { id: randomUUID(), role: 'USER', status: 'ACTIVE' }
  const db = {
    user: { findUnique: jest.fn() },
    trip: { findMany: jest.fn(), count: jest.fn() },
    $transaction: jest.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
  }
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TripHistoryController],
      providers: [
        Reflector,
        TripHistoryUseCase,
        { provide: TripHistoryPort, useClass: PrismaTripHistoryAdapter },
        { provide: PrismaService, useValue: db },
        { provide: SupabaseService, useValue: { verifyToken: jest.fn().mockResolvedValue({ id: randomUUID() }) } },
        AccessTokenGuard,
        { provide: ApiKeyGuard, useValue: {} },
        { provide: APP_GUARD, useClass: AuthenticationGuard },
      ],
    }).compile()
    app = module.createNestApplication()
    app.setGlobalPrefix('api/v1')
    app.useGlobalFilters(new GlobalErrorFilter())
    await app.init()
  })
  beforeEach(() => {
    jest.clearAllMocks()
    db.user.findUnique.mockResolvedValue(user)
    db.trip.findMany.mockResolvedValue([])
    db.trip.count.mockResolvedValue(0)
  })
  afterAll(async () => { await app?.close() })

  const get = (type: string, query = '') =>
    request(app.getHttpServer()).get(`/api/v1/me/${type}-trips/history${query}`).set('Authorization', 'Bearer test')

  it.each(['public', 'private'])('requires authentication for %s history', async type => {
    const res = await request(app.getHttpServer()).get(`/api/v1/me/${type}-trips/history`).expect(401)
    expect(res.body.error.code).toBe('UNAUTHENTICATED')
    expect(res.body.meta.requestId).toBeTruthy()
    expect(db.trip.findMany).not.toHaveBeenCalled()
  })

  it.each(['public', 'private'])('rejects spoofed ownership and invalid paging for %s', async type => {
    for (const query of [`?userId=${randomUUID()}`, '?page=0', '?pageSize=101', '?page=1.5']) {
      const res = await get(type, query).expect(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    }
    expect(db.trip.findMany).not.toHaveBeenCalled()
  })

  it.each([{ ...user, status: 'SUSPENDED' }, { ...user, role: 'ADMIN' }])(
    'rejects disallowed account $role/$status',
    async actor => {
      db.user.findUnique.mockResolvedValue(actor)
      await get('private').expect(403)
      expect(db.trip.findMany).not.toHaveBeenCalled()
    },
  )

  it('scopes public history to the authenticated booking owner with confirmed payment', async () => {
    const res = await get('public').expect(200)
    expect(res.body).toEqual({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 })
    const query = db.trip.findMany.mock.calls[0][0]
    expect(query.where).toEqual({
      tripType: 'PUBLIC',
      status: { in: ['COMPLETED', 'CANCELLED', 'INTERRUPTED'] },
      bookingsViaTripId: { some: { userId: user.id, confirmedAt: { not: null } } },
    })
    expect(db.trip.count).toHaveBeenCalledWith({ where: query.where })
    expect(query.select.bookingsViaTripId).toBeUndefined()
    expect(query.select.tripMembersViaTripId).toBeUndefined()
  })

  it('includes private creator or past member and returns a stable page with totals for leaders too', async () => {
    db.user.findUnique.mockResolvedValue({ ...user, role: 'LEADER' })
    const trip = { id: randomUUID(), title: 'My past trip', tripType: 'PRIVATE', status: 'COMPLETED' }
    db.trip.findMany.mockResolvedValue([trip])
    db.trip.count.mockResolvedValue(3)
    const res = await get('private', '?page=2&pageSize=2').expect(200)
    expect(res.body).toEqual({ items: [trip], page: 2, pageSize: 2, total: 3, totalPages: 2 })
    const query = db.trip.findMany.mock.calls[0][0]
    expect(query.where).toEqual({
      tripType: 'PRIVATE',
      status: { in: ['COMPLETED', 'CANCELLED', 'INTERRUPTED'] },
      OR: [{ creatorId: user.id }, { tripMembersViaTripId: { some: { userId: user.id } } }],
    })
    expect(query).toMatchObject({ skip: 2, take: 2, orderBy: [{ startAt: 'desc' }, { id: 'desc' }] })
    expect(db.trip.count).toHaveBeenCalledWith({ where: query.where })
  })
})
