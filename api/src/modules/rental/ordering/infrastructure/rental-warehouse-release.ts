import {
  CustodyTransferStatus,
  DeliveryTaskStatus,
  EquipmentCondition,
  EquipmentUnitStatus,
  InventoryTaskStatus,
  PackageStatus,
  Prisma,
  RentalUnitAssignmentStatus,
} from '@prisma/client'

/**
 * Dọn phần kho khi huỷ một đơn thuê chưa rời kho.
 * Dùng chung cho luồng khách tự huỷ và ADMIN huỷ do lỗi TrekGo.
 */

const RELEASABLE_UNIT_STATUSES: EquipmentUnitStatus[] = [EquipmentUnitStatus.PICKED, EquipmentUnitStatus.PACKED]
const DELIVERY_CUSTODY_TASK_STATUSES: DeliveryTaskStatus[] = [
  DeliveryTaskStatus.PACKAGE_RECEIVED,
  DeliveryTaskStatus.RECIPIENT_VERIFIED,
  DeliveryTaskStatus.HANDED_OVER,
]
const INACTIVE_ASSIGNMENT_STATUSES: RentalUnitAssignmentStatus[] = [
  RentalUnitAssignmentStatus.CLOSED,
  RentalUnitAssignmentStatus.REPLACED,
  RentalUnitAssignmentStatus.UNASSIGNED,
]

export const warehouseReleaseOrderInclude = {
  rentalOrderLinesViaOrderId: {
    include: { rentalUnitAssignmentsViaOrderLineId: { include: { equipmentUnit: true } } },
  },
  inventoryTaskViaOrderId: true,
  deliveryTasksViaOrderId: true,
  packageViaOrderId: true,
} satisfies Prisma.RentalOrderInclude

export type WarehouseReleaseOrder = Prisma.RentalOrderGetPayload<{ include: typeof warehouseReleaseOrderInclude }>

export type WarehouseReleaseResult = {
  releasedUnitIds: string[]
  unsafeUnits: Array<{ unitId: string; reason: string }>
}

function activeAssignments(order: WarehouseReleaseOrder) {
  return order.rentalOrderLinesViaOrderId.flatMap((line) =>
    line.rentalUnitAssignmentsViaOrderLineId.filter((a) => !INACTIVE_ASSIGNMENT_STATUSES.includes(a.status)),
  )
}

export function hasActiveAssignments(order: WarehouseReleaseOrder): boolean {
  return activeAssignments(order).length > 0
}

/** Kiện đã ở chỗ nhân viên giao (hoặc unit đã rời kho): không được tự đưa unit về AVAILABLE. */
export function isWithDeliveryStaff(order: WarehouseReleaseOrder): boolean {
  return (
    order.inventoryTaskViaOrderId?.status === InventoryTaskStatus.TRANSFERRED ||
    order.packageViaOrderId?.status === PackageStatus.TRANSFERRED_TO_DELIVERY ||
    order.deliveryTasksViaOrderId.some((t) => DELIVERY_CUSTODY_TASK_STATUSES.includes(t.status)) ||
    activeAssignments(order).some((a) => a.equipmentUnit.currentInventoryLocationId === null)
  )
}

/**
 * Theo cách luồng huỷ Trip đang làm (prisma-trip-lifecycle.adapter.ts, nhánh "Still in inventory location").
 * Unit PICKED/PACKED ở kho chính và không hỏng → AVAILABLE; còn lại báo unsafe để nhân viên xử lý.
 * Caller phải đang khoá đơn và inventory task, và đã chặn trường hợp `isWithDeliveryStaff`.
 * `primaryLocationId` chỉ cần khi đơn có assignment còn hiệu lực.
 */
export async function releaseWarehouseCustodyWithTx(
  tx: Prisma.TransactionClient,
  order: WarehouseReleaseOrder,
  primaryLocationId: string | null,
  now: Date,
  options: { closedTaskStatus: InventoryTaskStatus },
): Promise<WarehouseReleaseResult> {
  const releasedUnitIds: string[] = []
  const unsafeUnits: Array<{ unitId: string; reason: string }> = []

  const pkg = order.packageViaOrderId
  if (pkg && pkg.status !== PackageStatus.CLOSED && pkg.status !== PackageStatus.CANCELLED) {
    await tx.package.update({
      where: { id: pkg.id },
      data: { status: PackageStatus.CANCELLED, version: { increment: 1 } },
    })
  }

  const seen = new Set<string>()
  for (const assignment of activeAssignments(order)) {
    await tx.rentalUnitAssignment.update({
      where: { id: assignment.id },
      data: { status: RentalUnitAssignmentStatus.CLOSED, closedAt: now, version: { increment: 1 } },
    })
    const unit = assignment.equipmentUnit
    if (seen.has(unit.id)) continue
    seen.add(unit.id)
    const atPrimary = primaryLocationId !== null && unit.currentInventoryLocationId === primaryLocationId
    const undamaged = unit.condition !== EquipmentCondition.DAMAGED && unit.condition !== EquipmentCondition.LOST
    const releasable = RELEASABLE_UNIT_STATUSES.includes(unit.status)
    if (atPrimary && undamaged && releasable) {
      await tx.equipmentUnit.update({
        where: { id: unit.id },
        data: { status: EquipmentUnitStatus.AVAILABLE, version: { increment: 1 } },
      })
      releasedUnitIds.push(unit.id)
    } else {
      unsafeUnits.push({
        unitId: unit.id,
        reason: !atPrimary
          ? 'UNIT_NOT_AT_PRIMARY_LOCATION'
          : !undamaged
            ? `UNIT_CONDITION_${unit.condition}`
            : `UNIT_STATUS_INELIGIBLE_${unit.status}`,
      })
    }
  }

  const task = order.inventoryTaskViaOrderId
  if (task && task.status !== InventoryTaskStatus.CLOSED && task.status !== InventoryTaskStatus.CANCELLED) {
    await tx.inventoryTask.update({
      where: { id: task.id },
      data: {
        status: unsafeUnits.length > 0 ? InventoryTaskStatus.BLOCKED : options.closedTaskStatus,
        version: { increment: 1 },
      },
    })
  }
  for (const deliveryTask of order.deliveryTasksViaOrderId) {
    if (deliveryTask.status === DeliveryTaskStatus.CANCELLED) continue
    await tx.deliveryTask.update({
      where: { id: deliveryTask.id },
      data: { status: DeliveryTaskStatus.CANCELLED, version: { increment: 1 } },
    })
  }
  // Lượt chuyển giao kho → nhân viên giao đang chờ nhận phải đóng, để không ai nhận kiện của đơn đã huỷ.
  await tx.custodyTransfer.updateMany({
    where: { orderId: order.id, status: CustodyTransferStatus.PENDING_RECEIPT },
    data: { status: CustodyTransferStatus.CANCELLED, cancelledAt: now, version: { increment: 1 } },
  })

  return { releasedUnitIds, unsafeUnits }
}
