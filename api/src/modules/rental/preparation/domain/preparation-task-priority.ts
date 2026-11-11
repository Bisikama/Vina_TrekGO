import { InventoryTaskStatus } from '@prisma/client'

export type PreparationTaskPriority = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW'

/** Task kho còn phải soạn/đóng gói. */
export const PREPARATION_ACTIVE_STATUSES: InventoryTaskStatus[] = [
  InventoryTaskStatus.OPEN,
  InventoryTaskStatus.PICKING,
  InventoryTaskStatus.CONDITION_CAPTURED,
  InventoryTaskStatus.PACKED,
]

/** Kho đã làm xong, chờ bên giao. */
export const PREPARATION_HANDED_OFF_STATUSES: InventoryTaskStatus[] = [
  InventoryTaskStatus.READY,
  InventoryTaskStatus.TRANSFERRED,
]

/** Task còn làm mà hạn trong khoảng này thì xếp HIGH. */
export const PREPARATION_DUE_SOON_MINUTES = 120

/**
 * Hạng sắp xếp của hàng đợi kho, nhỏ hơn thì lên trước:
 * 0 BLOCKED, 1 trễ hạn, 2 đang chờ kho, 3 kho đã xong, 4 đã kết thúc.
 * SQL ORDER BY trong `listTasks` phải khớp với hàm này.
 */
export function preparationTaskRank(status: InventoryTaskStatus, deadline: Date | null, now: Date): number {
  if (status === InventoryTaskStatus.BLOCKED) return 0
  if (PREPARATION_ACTIVE_STATUSES.includes(status)) return deadline && deadline < now ? 1 : 2
  if (PREPARATION_HANDED_OFF_STATUSES.includes(status)) return 3
  return 4
}

export function preparationTaskPriority(
  status: InventoryTaskStatus,
  deadline: Date | null,
  now: Date,
): { priority: PreparationTaskPriority; isOverdue: boolean } {
  const rank = preparationTaskRank(status, deadline, now)
  if (rank <= 1) return { priority: 'URGENT', isOverdue: rank === 1 }
  if (rank === 2) {
    const dueSoon = deadline !== null && deadline.getTime() - now.getTime() <= PREPARATION_DUE_SOON_MINUTES * 60_000
    return { priority: dueSoon ? 'HIGH' : 'NORMAL', isOverdue: false }
  }
  return { priority: 'LOW', isOverdue: false }
}
