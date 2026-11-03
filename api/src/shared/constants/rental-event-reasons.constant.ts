/**
 * Giá trị `reason` / `kind` trong payload rental_outbox_events mà module khác (notifications) đọc.
 * Để ở shared để notifications không phải import từ bên trong module rental.
 */

/** RENTAL_ORDER_CANCELLED do ADMIN huỷ vì lỗi TrekGo trước bàn giao. */
export const SYSTEM_FAULT_CANCELLATION_REASON = 'SYSTEM_FAULT_CANCELLATION'

/** RENTAL_ACTION_REQUIRED khi hạ hạng làm đơn chưa bàn giao thiếu hàng đúng hạng. */
export const GRADE_DOWNGRADE_SHORTAGE_REASON = 'GRADE_DOWNGRADE_CAPACITY_SHORTAGE'

/** RENTAL_ACTION_REQUIRED (`kind`) khi đơn vẫn thiếu hàng do hạ hạng lúc sắp tới giờ nhận đồ. */
export const GRADE_SHORTAGE_HANDOVER_DEADLINE_KIND = 'GRADE_SHORTAGE_HANDOVER_DEADLINE'

/** RENTAL_ACTION_REQUIRED khi Trip/Booking/membership bị huỷ lúc khách đang giữ thiết bị. */
export const CUSTODY_PRESERVED_REASONS = {
  TRIP: 'TRIP_CANCELLED_WITH_ACTIVE_RENTAL',
  BOOKING: 'BOOKING_CANCELLED_WITH_ACTIVE_RENTAL',
  MEMBERSHIP: 'ACTIVE_RENTAL_MEMBERSHIP_REVOKED_CUSTODY_PRESERVED',
} as const

/** Nguồn huỷ ghi trong payload RENTAL_ORDER_CANCELLED của lifecycle. */
export type RentalCancellationSource = 'TRIP' | 'BOOKING' | 'MEMBERSHIP'
