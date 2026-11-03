import { deductionReviewGate } from './deduction-review-gate'

describe('deduction review gate', () => {
  const publishedAt = new Date('2026-10-01T00:00:00Z')
  const input = {
    orderId: 'order', inspectionId: 'inspection', assignmentId: 'unit',
    reviewMinutes: 2880, now: new Date('2026-10-03T00:00:00Z'),
  }
  const tx = (open: object | null, accessible: Date | null) => ({
    rentalExceptionCase: { findFirst: jest.fn().mockResolvedValueOnce(open)
      .mockResolvedValueOnce(accessible ? { evidenceAccessibleAt: accessible } : null) },
  }) as any

  it('holds while the dispute is open, even after 48 hours', async () => {
    expect(await deductionReviewGate(tx({ id: 'dispute' }, publishedAt), input))
      .toBe('USER_DISPUTE_MUST_BE_RESOLVED')
  })

  it('holds when evidence was never published or the window has not expired', async () => {
    expect(await deductionReviewGate(tx(null, null), input)).toBe('USER_48H_REVIEW_WINDOW_NOT_CLOSED')
    expect(await deductionReviewGate(tx(null, publishedAt), { ...input, now: new Date(input.now.getTime() - 1) }))
      .toBe('USER_48H_REVIEW_WINDOW_NOT_CLOSED')
  })

  it('allows a closed dispute after the original published window expires', async () => {
    const db = tx(null, publishedAt)
    expect(await deductionReviewGate(db, input)).toBeNull()
    expect(db.rentalExceptionCase.findFirst.mock.calls[1][0].where).toMatchObject({
      orderId: input.orderId, inspectionId: input.inspectionId, evidenceAccessibleAt: { not: null },
    })
  })

  it('fails closed without a valid policy duration', async () => {
    expect(await deductionReviewGate(tx(null, publishedAt), { ...input, reviewMinutes: null }))
      .toBe('USER_48H_REVIEW_WINDOW_NOT_CLOSED')
  })

  it('holds during an access interruption even when the old deadline passed', async () => {
    const db = tx(null, publishedAt)
    db.rentalExceptionCase.findFirst.mockReset().mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ evidenceAccessibleAt: publishedAt, evidenceAccessBlockedAt: publishedAt })
    expect(await deductionReviewGate(db, input)).toBe('EVIDENCE_ACCESS_INTERRUPTED')
  })

  it('uses the persisted deadline after restoration', async () => {
    const db = tx(null, publishedAt)
    db.rentalExceptionCase.findFirst.mockReset().mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ evidenceAccessibleAt: publishedAt, dueAt: new Date(input.now.getTime() + 1000) })
    expect(await deductionReviewGate(db, input)).toBe('USER_48H_REVIEW_WINDOW_NOT_CLOSED')
  })
})
