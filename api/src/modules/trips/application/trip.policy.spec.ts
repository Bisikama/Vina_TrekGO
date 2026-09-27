import { basicIssues, routeIssues } from './trip.policy'
import { createSchema, parse } from '../presentation/dtos/public-trip.dto'

describe('CF01 policies', () => {
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
  it('requires a future interval, positive decimal price and integer capacity', () => {
    const input = { startAt: '2030-01-02T00:00:00Z', endAt: '2030-01-03T00:00:00Z', price: '100.50', capacity: 2 }
    const now = new Date('2030-01-01T00:00:00Z')
    expect(basicIssues(input, now)).toEqual([])
    for (const price of ['0', '-1', 'NaN', '10000000000', '0.0001'])
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
  })
})
