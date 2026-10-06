import { Prisma } from '@prisma/client'

// Progress is based on completed decisions, never on an unresolved provider refund.
export async function updateSettlementProgress(tx: Prisma.TransactionClient, settlementId: string, now: Date) {
  const settlement = await tx.depositSettlement.findUniqueOrThrow({
    where: { id: settlementId },
    include: { depositSettlementItemsViaSettlementId: true },
  })
  const items = settlement.depositSettlementItemsViaSettlementId
  const settled = items.filter((i) => i.status === 'SETTLED')
  const sum = (field: 'depositAmount' | 'refundAmount' | 'deductionAmount') =>
    settled.reduce((n, i) => n.plus(i[field]), new Prisma.Decimal(0))
  const complete =
    items.length > 0 && settled.length === items.length && sum('depositAmount').equals(settlement.totalDeposit)
  await tx.depositSettlement.update({
    where: { id: settlementId },
    data: {
      totalDeduction: sum('deductionAmount'),
      refundAmount: sum('refundAmount'),
      status: complete
        ? 'SETTLED'
        : items.some((i) => ['REFUND_FAILED', 'REVIEW_REQUIRED'].includes(i.status))
          ? 'ACTION_REQUIRED'
          : settled.length
            ? 'PARTIALLY_SETTLED'
            : 'OPEN',
      settledAt: complete ? now : null,
      outcome: complete
        ? sum('deductionAmount').isZero()
          ? 'FULL_REFUND'
          : sum('refundAmount').isZero()
            ? 'FULL_DEDUCTION'
            : 'PARTIAL_REFUND'
        : null,
      version: { increment: 1 },
    },
  })
}
