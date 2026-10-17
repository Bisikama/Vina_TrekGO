import { basicIssues, routeIssues } from './trip.policy'
import { createSchema, updateSchema, parse } from '../presentation/dtos/public-trip.dto'
import { PublicTripUseCase } from './use-cases/public-trip.use-case'
import type { TripStore, TripView } from './trip.types'

describe('CF01 policies', () => {
  it('allows draft explanations but limits their length', () => {
    expect(updateSchema.safeParse({ expectedVersion: 1, priceExplanation: null }).success).toBe(true)
    expect(updateSchema.parse({ expectedVersion: 1, priceExplanation: '  Vé và hướng dẫn  ' }).priceExplanation)
      .toBe('Vé và hướng dẫn')
    expect(updateSchema.safeParse({ expectedVersion: 1, priceExplanation: 'x'.repeat(5001) }).success).toBe(false)
  })
  it('blocks publish without an explanation and excludes internal pricing from public responses', async () => {
    const actor = { id: 'leader', role: 'LEADER', status: 'ACTIVE' }
    const trip: TripView = {
      id: 'trip', creatorId: actor.id, leaderId: actor.id, tripType: 'PUBLIC',
      destinationId: 'destination', title: 'Trip', description: null,
      startAt: '2099-01-01T00:00:00Z', endAt: '2099-01-02T00:00:00Z',
      pickupPointId: 'pickup', capacity: 10, price: '700000', status: 'DRAFT',
      version: 1, publishedAt: null, checkpoints: [], trails: [], priceExplanation: '   ',
    }
    const session = {
      actor: async () => actor, find: async () => trip,
      destination: async () => ({ status: 'ACTIVE' }),
      pickup: async () => ({ status: 'ACTIVE', destinationId: 'destination' }),
      conflicts: async () => [], checkpoints: async () => [], trails: async () => [], publish: jest.fn(),
    }
    const store = {
      read: async (work: any) => work(session),
      transaction: async (_actor: string, _trip: string, work: any) => work(session),
      publicDetail: async () => trip, list: async () => [trip],
    } as unknown as TripStore
    const service = new PublicTripUseCase(store)
    expect((await service.readiness(actor, trip.id)).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'priceExplanation' }),
    ]))
    await expect(service.publish(actor, trip.id, 1)).rejects.toMatchObject({ status: 422 })
    expect(session.publish).not.toHaveBeenCalled()
    trip.priceExplanation = 'Chi phí và lợi nhuận nội bộ'
    expect((await service.readiness(actor, trip.id)).issues.some(i => i.field === 'priceExplanation')).toBe(false)
    expect(await service.publicDetail(trip.id)).not.toHaveProperty('priceExplanation')
    expect((await service.publicList({ page: 1, pageSize: 10 }))[0]).not.toHaveProperty('priceExplanation')
    expect((await service.detail(actor, trip.id)).priceExplanation).toBe(trip.priceExplanation)
  })
  const a = { id: 'a', checkpointIds: ['start', 'junction'] }
  const b = { id: 'b', checkpointIds: ['junction', 'summit'] }
  it('accepts ordered checkpoints across connected trails', () =>
    expect(routeIssues(['start', 'summit'], [a, b])).toEqual([]))
  it('rejects disconnected trails even when their union covers the goal', () =>
    expect(routeIssues(['start', 'summit'], [a, { ...b, checkpointIds: ['other', 'summit'] }])).not.toEqual([]))
  it('rejects reversed objectives and duplicate trails/checkpoints', () => {
    expect(routeIssues(['summit', 'start'], [a, b])).not.toEqual([])
    expect(routeIssues(['start', 'start'], [a])).not.toEqual([])
    expect(routeIssues(['start'], [a, a])).not.toEqual([])
  })
  it('requires a future interval, positive integer price and integer capacity', () => {
    const input = { startAt: '2030-01-02T00:00:00Z', endAt: '2030-01-03T00:00:00Z', price: '100', capacity: 2 }
    const now = new Date('2030-01-01T00:00:00Z')
    expect(basicIssues(input, now)).toEqual([])
    for (const price of ['0', '-1', 'NaN', '10000000000', '0.0001', '100.50', '100.00'])
      expect(basicIssues({ ...input, price }, now)).not.toEqual([])
    expect(basicIssues({ ...input, capacity: 1.5 }, now)).not.toEqual([])
    expect(basicIssues({ ...input, endAt: input.startAt }, now)).not.toEqual([])
    expect(basicIssues(input, new Date('2031-01-01'))).not.toEqual([])
  })
  it('rejects client-assigned state, actor and numeric money at the HTTP boundary', () => {
    const data = {
      destinationId: '00000000-0000-4000-8000-000000000001',
      pickupPointId: '00000000-0000-4000-8000-000000000002',
      title: 'Trip',
      startAt: '2030-01-02T00:00:00Z',
      endAt: '2030-01-03T00:00:00Z',
      capacity: 2,
      price: '100',
    }
    expect(() => parse(createSchema, data)).not.toThrow()
    expect(() => parse(createSchema, { ...data, status: 'OPEN' })).toThrow()
    expect(() => parse(createSchema, { ...data, leaderId: data.destinationId })).toThrow()
    expect(() => parse(createSchema, { ...data, price: 100 })).toThrow()
    for (const price of ['0', '000', '-1', '100.50', '100.00', '10000000000']) {
      expect(createSchema.safeParse({ ...data, price }).success).toBe(false)
      expect(updateSchema.safeParse({ expectedVersion: 1, price }).success).toBe(false)
    }
    for (const price of ['1', '700000', '9999999999']) {
      expect(createSchema.safeParse({ ...data, price }).success).toBe(true)
      expect(updateSchema.safeParse({ expectedVersion: 1, price }).success).toBe(true)
    }
  })
})
