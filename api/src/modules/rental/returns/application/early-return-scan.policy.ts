type EarlyReturnScan = {
  status: string
  confirmedSlotAt: Date | null
  previousTaskAt: Date | null
  supersededAt: Date | null
}

/** Nhân viên được quét sớm tối đa 30 phút trước giờ hẹn đã xác nhận. */
export const EARLY_RETURN_SCAN_TOLERANCE_MINUTES = 30
/** Giờ hẹn phải cách lúc gửi tối thiểu bao nhiêu phút. Đang để 0 cho demo. */
export const EARLY_RETURN_MIN_LEAD_MINUTES = 0

/** Applies only to a task linked to an early-return request. */
export function earlyReturnScanAllowed(request: EarlyReturnScan, taskAt: Date | null, due: Date, now: Date): boolean {
  if (now >= due) return true
  // The first successful scan started this return; subsequent units must be
  // accepted in the same collection session before the contractual due time.
  if (request.status === 'COMPLETED') return true
  if (request.status === 'SUPERSEDED') return true
  // REJECTED/EXPIRED chỉ còn task khi lịch đã từng được xác nhận rồi bị dời Trip
  // đưa về PENDING; xử lý như yêu cầu đã huỷ.
  if (['CANCELLED', 'REJECTED', 'EXPIRED'].includes(request.status)) {
    return (
      !!request.supersededAt ||
      !!(request.previousTaskAt && taskAt && request.previousTaskAt.getTime() === taskAt.getTime())
    )
  }
  return (
    request.status === 'CONFIRMED' &&
    !!request.confirmedSlotAt &&
    now.getTime() >= request.confirmedSlotAt.getTime() - EARLY_RETURN_SCAN_TOLERANCE_MINUTES * 60_000
  )
}
