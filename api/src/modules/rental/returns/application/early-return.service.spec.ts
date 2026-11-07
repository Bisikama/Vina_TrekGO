import { EarlyReturnService } from './early-return.service'
import { earlyReturnScanAllowed } from './early-return-scan.policy'
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { REQUEST_USER_KEY } from 'src/shared/constants/auth.constant'
import { GlobalErrorFilter } from 'src/shared/errors/global-error.filter'
import { EarlyReturnController } from '../presentation/controllers/early-return.controller'
import { validateRentalOrderPaymentMembershipWithTx } from '../../payments/rental-membership.guard'
import { PrismaRentalReturnAdapter } from '../infrastructure/adapters/prisma-rental-return.adapter'

jest.mock('../../payments/rental-membership.guard', () => ({
  validateRentalOrderPaymentMembershipWithTx: jest.fn().mockResolvedValue(true),
}))

describe('EarlyReturnService request', () => {
  const now = new Date('2026-11-06T08:00:00Z')
  const slot = new Date('2026-11-06T10:00:00Z')
  const order = {
    id: 'order',
    userId: 'renter',
    status: 'ACTIVE',
    rentalEndAt: new Date('2026-11-07T10:00:00Z'),
    operationalReturnDueAt: null,
    packageViaOrderId: { id: 'package' },
    rentalHandoverViaOrderId: { id: 'handover' },
    rentalReturnSessionsViaOrderId: [],
    rentalOrderLinesViaOrderId: [{ rentalUnitAssignmentsViaOrderLineId: [{ status: 'HANDED_OVER' }] }],
  }
  function setup(overrides: Record<string, unknown> = {}) {
    const tx: any = {
      $queryRaw: jest.fn(),
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'admin' }) },
      idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
      rentalOrder: { findUnique: jest.fn().mockResolvedValue(order) },
      rentalExtensionRequest: { findFirst: jest.fn().mockResolvedValue(null) },
      rentalEarlyReturnRequest: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => ({ id: 'request', ...data })),
      },
      deliveryTask: { findUnique: jest.fn().mockResolvedValue(null) },
      auditLog: { create: jest.fn() },
      rentalOutboxEvent: { upsert: jest.fn() },
      ...overrides,
    }
    const prisma: any = { $transaction: jest.fn((work: (arg: any) => unknown) => work(tx)) }
    return { service: new EarlyReturnService(prisma), tx }
  }

  it('records a request without changing custody or the rental order', async () => {
    const { service, tx } = setup()
    const result = await service.request('order', 'renter', slot, 'request-key', now)
    expect(result.status).toBe('PENDING')
    expect(tx.rentalEarlyReturnRequest.create).toHaveBeenCalledTimes(1)
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1)
    expect(tx.rentalOutboxEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          eventType: 'RENTAL_EARLY_RETURN_UPDATED',
          payload: expect.objectContaining({ status: 'REQUESTED' }),
        }),
      }),
    )
    expect(tx.deliveryTask.findUnique).toHaveBeenCalledTimes(1)
  })

  it('rejects a different renter and an existing open request', async () => {
    const first = setup()
    await expect(first.service.request('order', 'other', slot, 'request-key', now)).rejects.toMatchObject({
      code: 'RENTAL_NOT_FOUND',
    })
    const second = setup()
    second.tx.rentalEarlyReturnRequest.findFirst.mockResolvedValue({ id: 'existing' })
    await expect(second.service.request('order', 'renter', slot, 'request-key', now)).rejects.toMatchObject({
      code: 'OPERATION_CONFLICT',
    })
    expect(second.tx.rentalEarlyReturnRequest.create).not.toHaveBeenCalled()
  })

  it('requires a valid trip membership for the renter', async () => {
    const { service, tx } = setup()
    jest.mocked(validateRentalOrderPaymentMembershipWithTx).mockResolvedValueOnce(false)
    await expect(service.request('order', 'renter', slot, 'request-key', now)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    expect(tx.rentalEarlyReturnRequest.create).not.toHaveBeenCalled()
  })

  it('rejects a request while extension payment is pending', async () => {
    const { service, tx } = setup()
    tx.rentalExtensionRequest.findFirst.mockResolvedValue({ id: 'extension' })
    await expect(service.request('order', 'renter', slot, 'request-key', now)).rejects.toMatchObject({
      code: 'OPERATION_CONFLICT',
    })
    expect(tx.rentalEarlyReturnRequest.create).not.toHaveBeenCalled()
  })

  it('rejects a request after a unit was already returned', async () => {
    const { service, tx } = setup()
    tx.rentalOrder.findUnique.mockResolvedValue({
      ...order,
      rentalOrderLinesViaOrderId: [
        {
          rentalUnitAssignmentsViaOrderLineId: [
            { status: 'HANDED_OVER', returnedAt: null },
            { status: 'RETURNED', returnedAt: now },
          ],
        },
      ],
    })
    await expect(service.request('order', 'renter', slot, 'request-key', now)).rejects.toMatchObject({
      code: 'RETURN_NOT_READY',
    })
    expect(tx.rentalEarlyReturnRequest.create).not.toHaveBeenCalled()
  })

  it('rejects a slot at or after the effective rental due time', async () => {
    const { service, tx } = setup()
    await expect(service.request('order', 'renter', order.rentalEndAt, 'request-key', now)).rejects.toMatchObject({
      code: 'INVALID_RETURN_STATE',
    })
    expect(tx.rentalEarlyReturnRequest.create).not.toHaveBeenCalled()
  })

  it('rejects a request that an earlier existing collection would make unconfirmable', async () => {
    const { service, tx } = setup()
    tx.deliveryTask.findUnique.mockResolvedValue({
      id: 'task',
      status: 'SCHEDULED',
      scheduledAt: new Date('2026-11-06T09:00:00Z'),
    })
    await expect(service.request('order', 'renter', slot, 'request-key', now)).rejects.toMatchObject({
      code: 'OPERATION_CONFLICT',
    })
    expect(tx.rentalEarlyReturnRequest.create).not.toHaveBeenCalled()
  })

  it('lets an admin reject only a pending request, keeping the reason', async () => {
    const { service, tx } = setup()
    const request = { id: 'request', orderId: 'order', status: 'PENDING', version: 1, requestedSlotAt: slot, order }
    tx.rentalEarlyReturnRequest.findUnique = jest
      .fn()
      .mockResolvedValueOnce({ orderId: 'order' })
      .mockResolvedValueOnce(request)
    tx.rentalEarlyReturnRequest.update = jest.fn().mockImplementation(({ data }: any) => ({ ...request, ...data }))
    const result = await service.reject('request', 'admin', 1, 'Không có nhân viên', 'reject-key', now)
    expect(result).toMatchObject({ status: 'REJECTED', rejectedBy: 'admin', rejectionReason: 'Không có nhân viên' })

    const confirmed = setup()
    confirmed.tx.rentalEarlyReturnRequest.findUnique = jest
      .fn()
      .mockResolvedValueOnce({ orderId: 'order' })
      .mockResolvedValueOnce({ ...request, status: 'CONFIRMED' })
    confirmed.tx.rentalEarlyReturnRequest.update = jest.fn()
    await expect(
      confirmed.service.reject('request', 'admin', 1, 'Không có nhân viên', 'reject-key', now),
    ).rejects.toMatchObject({ code: 'INVALID_RETURN_STATE' })
    expect(confirmed.tx.rentalEarlyReturnRequest.update).not.toHaveBeenCalled()
  })

  it('expires pending requests that can no longer be confirmed', async () => {
    const { service, tx } = setup()
    const rows: Record<string, any> = {
      past: { id: 'past', orderId: 'o1', status: 'PENDING', requestedSlotAt: new Date('2026-11-06T07:00:00Z'), order },
      future: { id: 'future', orderId: 'o2', status: 'PENDING', requestedSlotAt: slot, order },
      afterDue: {
        id: 'afterDue',
        orderId: 'o3',
        status: 'PENDING',
        requestedSlotAt: slot,
        order: {
          ...order,
          operationalReturnDueAt: new Date('2026-11-06T09:00:00Z'),
          rentalEndAt: new Date('2026-11-06T09:00:00Z'),
        },
      },
    }
    const prisma: any = {
      // Kể cả khi SQL lọc trả về một yêu cầu còn hợp lệ (ví dụ vừa gia hạn), transaction vẫn kiểm lại.
      $queryRaw: jest.fn().mockResolvedValue(Object.values(rows).map(({ id, orderId }) => ({ id, orderId }))),
      $transaction: jest.fn((work: (arg: any) => unknown) => work(tx)),
    }
    tx.rentalEarlyReturnRequest.findUnique = jest.fn(({ where }: any) => rows[where.id])
    tx.rentalEarlyReturnRequest.update = jest.fn().mockResolvedValue({ version: 2 })
    const expired = await new EarlyReturnService(prisma).expireStale(now)
    expect(expired).toBe(2)
    expect(tx.rentalEarlyReturnRequest.update.mock.calls.map(([arg]: any) => arg.where.id).sort()).toEqual([
      'afterDue',
      'past',
    ])
    expect(tx.rentalEarlyReturnRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'EXPIRED', expiredAt: now }) }),
    )
  })

  it('confirms a schedule by reusing the task without changing custody', async () => {
    const { service, tx } = setup()
    const request = {
      id: 'request',
      orderId: 'order',
      userId: 'renter',
      status: 'PENDING',
      version: 1,
      requestedSlotAt: slot,
      order,
    }
    tx.rentalEarlyReturnRequest.findUnique = jest
      .fn()
      .mockResolvedValueOnce({ orderId: 'order' })
      .mockResolvedValueOnce(request)
    tx.rentalEarlyReturnRequest.update = jest
      .fn()
      .mockImplementation(({ data }: any) => ({ ...request, ...data, version: 2 }))
    tx.rentalReturnSession = { findFirst: jest.fn().mockResolvedValue(null) }
    tx.rentalUnitAssignment = { count: jest.fn().mockResolvedValue(1) }
    tx.rentalOrder.findUnique.mockResolvedValue({ ...order, tripId: 'trip', returnPointId: 'point' })
    tx.deliveryTask.findUnique.mockResolvedValue({ id: 'task', status: 'SCHEDULED', scheduledAt: order.rentalEndAt })
    tx.deliveryTask.update = jest.fn()
    const result = await service.confirm('request', 'admin', 1, 'confirm-key', now)
    expect(result.status).toBe('CONFIRMED')
    expect(tx.deliveryTask.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ scheduledAt: slot }) }),
    )
    expect(tx.rentalEarlyReturnRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ taskId: 'task', previousTaskAt: order.rentalEndAt }) }),
    )
  })

  it('refuses confirmation by an inactive or non-admin actor', async () => {
    const { service, tx } = setup()
    tx.user.findFirst.mockResolvedValue(null)
    await expect(service.confirm('request', 'not-admin', 1, 'confirm-key', now)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    expect(tx.deliveryTask.findUnique).not.toHaveBeenCalled()
  })

  it('cancelling a confirmed request restores the previous schedule without unassigning', async () => {
    const { service, tx } = setup()
    const request = {
      id: 'request',
      orderId: 'order',
      userId: 'renter',
      status: 'CONFIRMED',
      version: 2,
      confirmedSlotAt: slot,
      previousTaskAt: order.rentalEndAt,
      taskId: 'task',
      supersededAt: null,
      order,
    }
    tx.rentalEarlyReturnRequest.findUnique = jest
      .fn()
      .mockResolvedValueOnce({ orderId: 'order' })
      .mockResolvedValueOnce(request)
    tx.rentalEarlyReturnRequest.update = jest.fn().mockImplementation(({ data }: any) => ({ ...request, ...data }))
    tx.rentalReturnSession = { findFirst: jest.fn().mockResolvedValue(null) }
    tx.deliveryTask.findUnique.mockResolvedValue({
      id: 'task',
      status: 'SCHEDULED',
      scheduledAt: slot,
      staffId: 'staff',
    })
    tx.deliveryTask.update = jest.fn()
    await service.cancel('request', 'renter', 2, 'cancel-key', now)
    expect(tx.deliveryTask.update).toHaveBeenCalledWith({
      where: { id: 'task' },
      data: { scheduledAt: order.rentalEndAt, version: { increment: 1 } },
    })
    expect(tx.rentalEarlyReturnRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED' }) }),
    )
  })
})

describe('early return collection timing', () => {
  const now = new Date('2026-11-06T08:00:00Z')
  const slot = new Date('2026-11-06T10:00:00Z')
  const due = new Date('2026-11-07T10:00:00Z')
  const request = { status: 'PENDING', confirmedSlotAt: slot, previousTaskAt: null, supersededAt: null }
  it('requires confirmation and the confirmed appointment before early collection', () => {
    expect(earlyReturnScanAllowed(request, slot, due, now)).toBe(false)
    expect(earlyReturnScanAllowed({ ...request, status: 'CONFIRMED' }, slot, due, now)).toBe(false)
    expect(earlyReturnScanAllowed({ ...request, status: 'CONFIRMED' }, slot, due, slot)).toBe(true)
    expect(earlyReturnScanAllowed({ ...request, status: 'COMPLETED' }, slot, due, slot)).toBe(true)
  })
  it('allows a confirmed early collection up to 30 minutes before the slot', () => {
    const confirmed = { ...request, status: 'CONFIRMED' }
    expect(earlyReturnScanAllowed(confirmed, slot, due, new Date(slot.getTime() - 30 * 60_000))).toBe(true)
    expect(earlyReturnScanAllowed(confirmed, slot, due, new Date(slot.getTime() - 31 * 60_000))).toBe(false)
  })
  it('treats rejected or expired requests like cancelled ones', () => {
    expect(earlyReturnScanAllowed({ ...request, status: 'REJECTED', supersededAt: now }, slot, due, now)).toBe(true)
    expect(earlyReturnScanAllowed({ ...request, status: 'EXPIRED' }, slot, due, now)).toBe(false)
  })
  it('honors an independent trip event and does not block the normal due-time return', () => {
    expect(earlyReturnScanAllowed({ ...request, status: 'SUPERSEDED' }, slot, due, now)).toBe(true)
    expect(earlyReturnScanAllowed({ ...request, status: 'CANCELLED' }, slot, due, due)).toBe(true)
    expect(earlyReturnScanAllowed({ ...request, status: 'CANCELLED' }, slot, due, now)).toBe(false)
    expect(earlyReturnScanAllowed({ ...request, status: 'CANCELLED', supersededAt: now }, slot, due, now)).toBe(true)
  })
  it('blocks the actual scan before the confirmed slot without changing custody', async () => {
    const tx: any = {
      $queryRaw: jest.fn(),
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'delivery', role: 'STAFF_DELIVERY' }) },
      idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
      rentalOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order',
          status: 'ACTIVE',
          version: 1,
          rentalEndAt: due,
          operationalReturnDueAt: null,
          rentalHandoverViaOrderId: { id: 'handover' },
          rentalOrderLinesViaOrderId: [],
        }),
      },
      deliveryTask: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'task', status: 'SCHEDULED', staffId: 'delivery', scheduledAt: slot }),
      },
      rentalEarlyReturnRequest: { findFirst: jest.fn().mockResolvedValue({ ...request, status: 'CONFIRMED' }) },
      custodyEvent: { create: jest.fn() },
      rentalUnitAssignment: { update: jest.fn() },
    }
    const adapter = new PrismaRentalReturnAdapter({ $transaction: (work: any) => work(tx) } as any)
    await expect(
      adapter.returnScan({
        actorUserId: 'delivery',
        orderId: 'order',
        assetCodes: ['UNIT-1'],
        operationId: 'operation-1',
        expectedVersion: 1,
        idempotencyKey: 'scan-key',
        now,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_RETURN_STATE' })
    expect(tx.custodyEvent.create).not.toHaveBeenCalled()
    expect(tx.rentalUnitAssignment.update).not.toHaveBeenCalled()
  })
})

describe('early return HTTP validation', () => {
  let app: INestApplication
  const service = { request: jest.fn(), get: jest.fn() }
  const orderId = '550e8400-e29b-41d4-a716-446655440000'
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [EarlyReturnController],
      providers: [{ provide: EarlyReturnService, useValue: service }],
    }).compile()
    app = module.createNestApplication()
    app.use((req: any, _res: any, next: () => void) => {
      req[REQUEST_USER_KEY] = { id: 'renter' }
      next()
    })
    app.useGlobalFilters(new GlobalErrorFilter())
    await app.init()
  })
  afterAll(async () => {
    await app.close()
  })
  it('returns the standard validation envelope for an invalid date', async () => {
    const response = await request(app.getHttpServer())
      .post(`/rental-orders/${orderId}/early-return`)
      .set('Idempotency-Key', 'request-key')
      .send({ requestedSlotAt: 'invalid' })
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
    expect(response.body.meta.requestId).toBeTruthy()
  })
  it('requires the idempotency key for a valid request', async () => {
    const response = await request(app.getHttpServer())
      .post(`/rental-orders/${orderId}/early-return`)
      .send({ requestedSlotAt: '2026-11-07T09:00:00.000Z' })
    expect(response.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED')
    expect(service.request).not.toHaveBeenCalled()
  })
})
