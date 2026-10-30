import { AppError } from 'src/shared/errors/app-error'
import { RENTAL_ERROR_CODES } from 'src/shared/errors/codes/rental.error-codes'
import { calculateSafeCapacity } from '../../../ordering/application/services/capacity-safety-gate'

export type GradeDecisionKind = 'KEEP' | 'DOWNGRADE'

export interface GradeDecisionInput {
  decision: GradeDecisionKind
  reason?: string
  note?: string
  evidenceIds?: string[]
}

export interface GradedProductRef {
  id: string
  gradeGroupId: string | null
  grade: 'LIKE_NEW' | 'GOOD_USED' | null
}

/**
 * Kiểm quyết định hạng so với sản phẩm hiện tại của unit.
 * - `required`: luồng đưa món về kho bắt buộc phải có quyết định với sản phẩm có hạng.
 * Trả về null khi sản phẩm không phân hạng (chạy như cũ).
 */
export function assertGradeDecision(
  product: GradedProductRef,
  input: GradeDecisionInput | undefined,
  options: { required: boolean },
): GradeDecisionInput | null {
  if (!product.gradeGroupId || !product.grade) {
    if (input)
      throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_GRADE_DECISION_NOT_APPLICABLE, {
        details: { productId: product.id },
      })
    return null
  }
  if (!input) {
    if (options.required)
      throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_GRADE_DECISION_REQUIRED, { details: { productId: product.id } })
    return null
  }
  if (input.decision === 'DOWNGRADE' && product.grade !== 'LIKE_NEW') {
    throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_GRADE_DOWNGRADE_NOT_ALLOWED, {
      details: { productId: product.id, grade: product.grade },
    })
  }
  return input
}

export interface OpenReservation {
  id: string
  orderId: string
  quantity: number
  occupiedFrom: Date
  occupiedUntil: Date
}

export interface ShortageWindow {
  reservation: OpenReservation
  from: Date
  until: Date
  peakReserved: number
}

/**
 * Số món một reservation còn thực sự chiếm của sản phẩm.
 * - Đơn chưa bàn giao: toàn bộ số lượng đặt.
 * - Đơn đã bàn giao: chỉ số món còn ở chỗ khách hoặc đang xử lý trả (assignment HANDED_OVER/RETURNED).
 *   Reservation vẫn CONFIRMED tới hết buffer sau khi trả, nên nếu tính đủ số lượng sẽ báo thiếu giả
 *   khi món vừa trả được hạ hạng.
 */
export function effectiveReservedQuantity(
  isPreHandover: boolean,
  reservedQuantity: number,
  openAssignmentCount: number,
): number {
  if (isPreHandover) return reservedQuantity
  return Math.min(reservedQuantity, openAssignmentCount)
}

/**
 * Tìm các reservation rơi vào khoảng mà tổng số đặt vượt số món của sản phẩm.
 * `supply` đếm mọi món còn dùng được (kể cả đang cho thuê) — không dùng readiness,
 * vì món đang ở chỗ khách sẽ quay về và không phải thiếu hàng do hạ hạng.
 * Chỉ xét phần từ `now` trở đi.
 */
export function findShortageWindows(supply: number, reservations: OpenReservation[], now: Date): ShortageWindow[] {
  const units = Array.from({ length: Math.max(0, supply) }, (_, i) => ({ id: `supply-${i}`, ready: true }))
  const result: ShortageWindow[] = []
  for (const reservation of reservations) {
    const from = reservation.occupiedFrom > now ? reservation.occupiedFrom : now
    const until = reservation.occupiedUntil
    if (!(from < until)) continue
    const capacity = calculateSafeCapacity({ from, until, units, reservations })
    if (capacity.peakReserved > supply) result.push({ reservation, from, until, peakReserved: capacity.peakReserved })
  }
  return result
}
