import { createHash, createHmac } from 'node:crypto'
import envconfig from 'src/shared/config'
import { RentalEvidenceAccessService } from './rental-evidence-access.service'

describe('evidence access interruption and restoration', () => {
  const oldSecret = envconfig.RENTAL_MEDIA_ACCESS_ATTESTATION_SECRET
  beforeEach(() => { envconfig.RENTAL_MEDIA_ACCESS_ATTESTATION_SECRET = 'test-secret' })
  afterEach(() => { envconfig.RENTAL_MEDIA_ACCESS_ATTESTATION_SECRET = oldSecret })
  const fixture = () => {
    const now = new Date(), blockedAt = new Date(now.getTime() - 60_000)
    const c = { id: 'case', orderId: 'order', inspectionId: 'inspection', status: 'RESOLVED', evidenceIds: ['file'],
      evidenceAccessibleAt: new Date(now.getTime() - 2 * 3600_000), evidenceAccessBlockedAt: blockedAt,
      evidenceAccessCustomerConfirmationRequired: false,
      dueAt: new Date(now.getTime() + 46 * 3600_000), order: { userId: 'owner', rentalPolicy: { userAssessmentReviewMinutes: 2880 } } }
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ now }]),
      rentalOrder: { findUnique: jest.fn().mockResolvedValue({ id: 'order', userId: 'owner' }) },
      rentalExceptionCase: { findUnique: jest.fn().mockResolvedValue(c), findFirst: jest.fn().mockResolvedValue(c), update: jest.fn() },
      depositSettlementItem: { findFirst: jest.fn().mockResolvedValue({ status: 'DEDUCTION_APPROVED' }) },
      mediaAsset: { findMany: jest.fn().mockResolvedValue([{ id: 'file' }]) },
      notification: { create: jest.fn().mockResolvedValue({ createdAt: now }) },
      auditLog: { create: jest.fn() },
      idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
    }
    const db = { rentalExceptionCase: { findUnique: jest.fn().mockResolvedValue({ orderId: 'order' }) },
      $transaction: (cb: (t: typeof tx) => unknown) => cb(tx) }
    const service = new RentalEvidenceAccessService(db as never)
    const request = { caseId: 'case', userId: 'owner', mediaIds: ['file'], requestId: 'request', publishedAt: now.toISOString() }
    const sign = (time: string) => createHmac('sha256', 'test-secret').update(JSON.stringify(['case', 'owner', time, ['file'], 'request'])).digest('hex')
    return { service, tx, c, now, request, sign }
  }

  it('restores access with a new full 48-hour deadline and audits the old deadline', async () => {
    const { service, tx, c, now, request, sign } = fixture()
    const result = await service.confirm(request, sign(request.publishedAt))
    expect(result).toMatchObject({ restored: true, windowEndsAt: new Date(now.getTime() + 48 * 3600_000).toISOString() })
    expect(tx.rentalExceptionCase.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      evidenceAccessBlockedAt: null, dueAt: new Date(now.getTime() + 48 * 3600_000),
    }) }))
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      action: 'RENTAL_EVIDENCE_ACCESS_RESTORED', oldValues: expect.objectContaining({ dueAt: c.dueAt.toISOString() }),
    }) }))
  })

  it('rejects an attestation made before the access problem was reported', async () => {
    const { service, tx, c, request, sign } = fixture()
    request.publishedAt = new Date(c.evidenceAccessBlockedAt.getTime() - 1).toISOString()
    await expect(service.confirm(request, sign(request.publishedAt))).rejects.toThrow('STALE_MEDIA_ATTESTATION')
    expect(tx.notification.create).not.toHaveBeenCalled()
  })

  it('rejects a verification that began before a concurrent interruption', async () => {
    const { service, tx, request, sign } = fixture()
    await expect(service.confirm(request, sign(request.publishedAt), null)).rejects.toThrow('STALE_MEDIA_ATTESTATION')
    expect(tx.notification.create).not.toHaveBeenCalled()
  })

  it('holds an existing published case and records the original deadline', async () => {
    const { service, tx, c } = fixture()
    c.evidenceAccessBlockedAt = null as never
    const result = await service.blockAccess({ orderId: 'order', caseId: 'case', actorUserId: 'owner', idempotencyKey: 'report-key' })
    expect(result).toMatchObject({ status: 'ACCESS_INTERRUPTED' })
    expect(tx.rentalExceptionCase.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ evidenceAccessBlockedAt: expect.any(Date) }) }))
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'RENTAL_EVIDENCE_ACCESS_INTERRUPTED' }) }))
  })

  it('replays the same report key without blocking a restored case a second time', async () => {
    const { service, tx, c } = fixture()
    c.evidenceAccessBlockedAt = null as never
    const saved = { caseId: 'case', status: 'ACCESS_INTERRUPTED', evidenceAccessBlockedAt: new Date().toISOString() }
    tx.idempotencyRecord.findUnique.mockResolvedValue({ requestHash: createHash('sha256').update(JSON.stringify(['order', 'case'])).digest('hex'), responseBody: saved })
    expect(await service.blockAccess({ orderId: 'order', caseId: 'case', actorUserId: 'owner', idempotencyKey: 'report-key' })).toEqual(saved)
    expect(tx.rentalExceptionCase.update).not.toHaveBeenCalled()
  })

  it('rejects a report from someone other than the order owner', async () => {
    const { service, tx } = fixture()
    await expect(service.blockAccess({ orderId: 'order', caseId: 'case', actorUserId: 'other', idempotencyKey: 'report-key' }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(tx.rentalExceptionCase.update).not.toHaveBeenCalled()
  })

  it('requires customer confirmation before the verifier can restore a customer-reported interruption', async () => {
    const { service, tx, c, request, sign } = fixture()
    c.evidenceAccessCustomerConfirmationRequired = true
    await expect(service.confirm(request, sign(request.publishedAt))).rejects.toThrow('CUSTOMER_ACCESS_CONFIRMATION_REQUIRED')
    expect(tx.notification.create).not.toHaveBeenCalled()
    expect(await service.acknowledge({ orderId: 'order', assessmentId: 'inspection', actorUserId: 'owner', idempotencyKey: 'confirm-key' }))
      .toMatchObject({ status: 'AWAITING_VERIFICATION' })
    expect(tx.rentalExceptionCase.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ evidenceAccessCustomerConfirmationRequired: false }) }))
  })
})
