import { Prisma } from '@prisma/client'
import { HANDOVER_SHORTAGE_REASON } from 'src/shared/constants/rental-event-reasons.constant'

/**
 * Bàn giao một phần (RB-API-404): một món TrekGo giao thiếu là assignment đã đóng gói rồi chuyển
 * UNASSIGNED mà chưa từng bàn giao. Mọi nơi nhận diện món thiếu dùng các helper ở đây.
 */

/**
 * `reportedIssues[].type` báo cả món không có trong kiện. `MISSING` là giá trị app gửi từ đầu (nút "Thiếu");
 * `UNIT_MISSING` là tên rõ nghĩa hơn của web/mobile mới. Thiếu phụ kiện đi qua loại khác (vd `DAMAGED`).
 */
export const UNIT_MISSING_ISSUE_TYPES: readonly string[] = ['MISSING', 'UNIT_MISSING']

/** Case kho tìm lại món thiếu: chỉ đóng không trừ cọc, không giữ đơn của khách. */
export const HANDOVER_SHORTAGE_CASE_PREFIX = `${HANDOVER_SHORTAGE_REASON}:`
/** Case Admin hoàn tay phí + cọc món thiếu khi hoàn tự động không tạo được hoặc thất bại. */
export const HANDOVER_SHORTAGE_REFUND_CASE_PREFIX = `${HANDOVER_SHORTAGE_REASON}_REFUND_REQUIRED:`

export const HANDOVER_SHORTAGE_ASSIGNMENT_WHERE = {
  status: 'UNASSIGNED',
  packedAt: { not: null },
  handedOverAt: null,
} as const satisfies Prisma.RentalUnitAssignmentWhereInput

export function isHandoverShortageAssignment(assignment: {
  status: string
  packedAt?: Date | null
  handedOverAt?: Date | null
}): boolean {
  return assignment.status === 'UNASSIGNED' && Boolean(assignment.packedAt) && !assignment.handedOverAt
}

export function isHandoverShortageCase(reason: string | null | undefined): boolean {
  return typeof reason === 'string' && reason.startsWith(HANDOVER_SHORTAGE_CASE_PREFIX)
}

export function isHandoverShortageRefundCase(reason: string | null | undefined): boolean {
  return typeof reason === 'string' && reason.includes(HANDOVER_SHORTAGE_REFUND_CASE_PREFIX)
}

/**
 * Per order line: how many units were missing at handover and the rental fee they carried.
 * The fee comes from the line itself (contract fee before any extension), not from the refund,
 * so it is the same whether the refund succeeded, failed or must be paid by hand.
 */
export async function handoverShortageByLine(
  db: Pick<Prisma.TransactionClient, 'rentalUnitAssignment' | 'rentalExtensionLine'>,
  orderId: string,
): Promise<Map<string, { count: number; missingFee: bigint }>> {
  const missing = await db.rentalUnitAssignment.findMany({
    where: { orderLine: { orderId }, ...HANDOVER_SHORTAGE_ASSIGNMENT_WHERE },
    select: { orderLineId: true, orderLine: { select: { quantity: true, lineRentalFee: true } } },
  })
  const result = new Map<string, { count: number; missingFee: bigint }>()
  if (!missing.length) return result
  const extended = await db.rentalExtensionLine.findMany({
    where: {
      orderLineId: { in: [...new Set(missing.map((row) => row.orderLineId))] },
      extension: { status: 'APPLIED' },
    },
    select: { orderLineId: true, additionalFee: true },
  })
  const counts = new Map<string, { count: number; quantity: number; lineRentalFee: Prisma.Decimal }>()
  for (const row of missing) {
    const entry = counts.get(row.orderLineId)
    counts.set(row.orderLineId, {
      count: (entry?.count ?? 0) + 1,
      quantity: row.orderLine.quantity,
      lineRentalFee: row.orderLine.lineRentalFee,
    })
  }
  for (const [lineId, entry] of counts) {
    // Extensions only ever add fees for the units still held, so subtracting them recovers the contract fee.
    const contractFee = extended
      .filter((row) => row.orderLineId === lineId)
      .reduce((fee, row) => fee.minus(row.additionalFee), entry.lineRentalFee)
    const missingFee = contractFee.mul(entry.count).div(entry.quantity).toDecimalPlaces(0, Prisma.Decimal.ROUND_DOWN)
    result.set(lineId, { count: entry.count, missingFee: BigInt(missingFee.toFixed(0)) })
  }
  return result
}
