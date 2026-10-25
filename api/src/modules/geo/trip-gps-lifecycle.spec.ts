import { TripGpsRecordingService } from './infrastructure/adapters/trip-gps-recording.service'

jest.mock('@nestjs/schedule', () => ({ Interval: () => () => undefined }))

describe('Geo trip recording lifecycle', () => {
  function setup(status = 'OPEN', tripRole = 'MEMBER') {
    const trip: any = { id: 'trip', status, completedAt: null }
    const tx: any = {
      auditLog: { create: jest.fn() },
      trip: { update: jest.fn(async ({ data }) => ({ ...trip, ...data })) },
      gpsStartReceipt: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      gpsSession: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }) => ({ ...data, id: 'new-session', status: 'ACTIVE' })),
      },
    }
    const projection = { refresh: jest.fn() }
    const service: any = new TripGpsRecordingService(
      {} as any,
      { require: jest.fn().mockResolvedValue({ tripRole }) } as any,
      projection as any,
      {} as any,
    )
    service.transaction = (_tripId: string, _userId: string, run: any) => run(tx, trip)
    service.effectivePolicy = jest.fn().mockResolvedValue({ id: 'policy' })
    service.response = (session: any) => ({ session })
    service.reconcile = jest.fn()
    return { service, trip, tx, projection }
  }

  it.each(['OPEN', 'FULL', 'CLOSED', 'IN_PROGRESS'])('member records in %s without starting trip', async (status) => {
    const { service, tx } = setup(status)
    await service.start('trip', 'user', { clientSessionId: 'new', deviceId: 'device' })
    expect(tx.gpsSession.create).toHaveBeenCalled()
    expect(tx.trip.update).not.toHaveBeenCalled()
  })

  it.each(['HOST', 'LEADER'])('%s starts trip when recording', async (role) => {
    const { service, tx } = setup('OPEN', role)
    await service.start('trip', 'user', { clientSessionId: 'new', deviceId: 'device' })
    expect(tx.trip.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'IN_PROGRESS', startedAt: expect.any(Date) }),
      }),
    )
  })

  it.each(['DRAFT', 'CANCEL_PENDING', 'COMPLETED', 'CANCELLED', 'INTERRUPTED'])(
    'rejects new sessions in %s',
    async (status) => {
      const { service, tx } = setup(status)
      await expect(service.start('trip', 'user', { clientSessionId: 'new', deviceId: 'device' })).rejects.toBeDefined()
      expect(tx.gpsSession.create).not.toHaveBeenCalled()
    },
  )

  it('does not reject a new session just because an older session stopped', async () => {
    const { service, tx } = setup()
    tx.gpsSession.findFirst.mockImplementation(async ({ where }: any) =>
      where.status === 'STOPPED' ? { status: 'STOPPED' } : null,
    )
    await service.start('trip', 'user', { clientSessionId: 'new', deviceId: 'device' })
    expect(tx.gpsSession.create).toHaveBeenCalled()
  })

  it('rejects ending a trip by an ordinary member', async () => {
    const { service, tx } = setup('IN_PROGRESS')
    await expect(service.endTrip('trip', 'user')).rejects.toBeDefined()
    expect(tx.trip.update).not.toHaveBeenCalled()
  })

  it.each(['HOST', 'LEADER'])('%s ends the trip once and reconciles all sessions', async (role) => {
    const { service, tx } = setup('IN_PROGRESS', role)
    const first = await service.endTrip('trip', 'user')
    const retry = await service.endTrip('trip', 'user')
    expect(first.tripStatus).toBe('COMPLETED')
    expect(retry.completedAt).toBe(first.completedAt)
    expect(tx.trip.update).toHaveBeenCalledTimes(1)
    expect(service.reconcile).toHaveBeenCalledTimes(2)
  })
})
