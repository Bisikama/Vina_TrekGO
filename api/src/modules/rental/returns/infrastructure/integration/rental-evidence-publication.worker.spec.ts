jest.mock('@nestjs/schedule', () => ({ Cron: () => () => undefined, CronExpression: { EVERY_MINUTE: '* * * * *' } }))
import envconfig from 'src/shared/config'
import { RentalEvidencePublicationWorker } from './rental-evidence-publication.worker'

describe('rental evidence publication', () => {
  const originalFetch = global.fetch
  const originalSecret = envconfig.RENTAL_MEDIA_ACCESS_ATTESTATION_SECRET
  const owner = { id: 'user', authUserId: 'auth', email: 'a@example.com', role: 'USER', status: 'ACTIVE' }
  const c = { id: 'case', order: { user: owner }, evidenceIds: ['file'],
    inspection: { evidenceIds: ['file'], findingsViaInspectionId: [] } }
  const makeWorker = () => {
    const db = { rentalExceptionCase: { findMany: jest.fn().mockResolvedValue([c]) },
      mediaAsset: { findMany: jest.fn().mockResolvedValue([{ id: 'file', resourceType: 'IMAGE' }]) } }
    const delivery = { execute: jest.fn().mockResolvedValue({ url: 'https://example.test/evidence' }) }
    const access = { confirm: jest.fn().mockResolvedValue({}), blockAccess: jest.fn().mockResolvedValue({}) }
    return { db, delivery, access, worker: new RentalEvidencePublicationWorker(db as never, delivery as never, access as never) }
  }
  beforeEach(() => { envconfig.RENTAL_MEDIA_ACCESS_ATTESTATION_SECRET = 'test-secret' })
  afterEach(() => { global.fetch = originalFetch; envconfig.RENTAL_MEDIA_ACCESS_ATTESTATION_SECRET = originalSecret })

  it('confirms only after owner-scoped media delivery returns successfully', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, body: { cancel: jest.fn() } }) as never
    const { worker, delivery, access } = makeWorker()
    await worker.publishPending()
    expect(delivery.execute).toHaveBeenCalledWith({ mediaId: 'file', variant: 'EVIDENCE_PREVIEW' }, expect.objectContaining({ id: 'user' }))
    expect(access.confirm).toHaveBeenCalledWith(expect.objectContaining({ caseId: 'case', userId: 'user', mediaIds: ['file'] }), expect.stringMatching(/^[a-f0-9]{64}$/), null)
  })

  it('does not start the clock if evidence delivery fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, body: { cancel: jest.fn() } }) as never
    const { worker, access } = makeWorker()
    await worker.publishPending()
    expect(access.confirm).not.toHaveBeenCalled()
  })

  it('holds a published case when the owner can no longer access evidence', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, body: { cancel: jest.fn() } }) as never
    const { worker, access, db } = makeWorker()
    db.rentalExceptionCase.findMany.mockResolvedValue([{ ...c, orderId: 'order', evidenceAccessibleAt: new Date(), evidenceAccessBlockedAt: null }])
    await worker.publishPending()
    expect(access.blockAccess).toHaveBeenCalledWith({ orderId: 'order', caseId: 'case' })
    expect(access.confirm).not.toHaveBeenCalled()
  })
})
