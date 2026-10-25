import { DeliveryTaskStatus, DeliveryTaskType, Prisma, RentalOrderStatus } from '@prisma/client';

/** The dispatch appointment is distinct from the contractual overdue clock. */
export function returnTaskScheduleAt(snapshot: unknown, effectiveDue: Date): Date {
  if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
    const slotAt = (snapshot as Record<string, unknown>).slotAt;
    if (typeof slotAt === 'string') {
      const parsed = new Date(slotAt);
      if (Number.isFinite(parsed.getTime())) return parsed;
    }
  }
  return effectiveDue;
}

/**
 * Baseline 1.3.2: mở task thu hồi khi đến hạn hoặc có sự kiện kết thúc sớm.
 * Caller khóa rental_orders trước khi gọi; unique(orderId, taskType) chặn tạo trùng.
 * Task chỉ phân công người thực hiện, không chuyển quyền giữ thiết bị.
 */
export async function ensureReturnTaskWithTx(
  tx: Prisma.TransactionClient,
  orderId: string,
  scheduledAt: Date,
  reason: 'DUE' | 'TRIP_ENDED_EARLY' | 'BOOKING_CANCELLED_AFTER_HANDOVER',
): Promise<string | null> {
  const order = await tx.rentalOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true, tripId: true, returnPointId: true, status: true,
      packageViaOrderId: { select: { id: true } },
      rentalHandoverViaOrderId: { select: { id: true } },
    },
  });
  if (!order || !order.packageViaOrderId || !order.rentalHandoverViaOrderId ||
      (order.status !== RentalOrderStatus.ACTIVE &&
       order.status !== RentalOrderStatus.RETURN_PENDING &&
       order.status !== RentalOrderStatus.RETURN_PROCESSING))
    return null;

  const where = { orderId_taskType: { orderId, taskType: DeliveryTaskType.RETURN } } as const;
  const existing = await tx.deliveryTask.findUnique({ where });
  if (existing) {
    // Sự kiện kết thúc sớm đưa task đã lên lịch về mốc sớm hơn, không thay assignee/custody.
    if (reason !== 'DUE' && existing.status === DeliveryTaskStatus.SCHEDULED &&
        (!existing.scheduledAt || scheduledAt < existing.scheduledAt)) {
      await tx.deliveryTask.update({
        where: { id: existing.id },
        data: { scheduledAt, version: { increment: 1 } },
      });
    }
    return existing.id;
  }

  const task = await tx.deliveryTask.create({
    data: {
      orderId, packageId: order.packageViaOrderId.id, tripId: order.tripId,
      servicePointId: order.returnPointId, taskType: DeliveryTaskType.RETURN,
      status: DeliveryTaskStatus.SCHEDULED, scheduledAt,
    },
  });
  await tx.rentalOutboxEvent.upsert({
    where: { deduplicationKey: `return-task-opened:${orderId}` }, update: {},
    create: {
      deduplicationKey: `return-task-opened:${orderId}`,
      eventType: 'RENTAL_RETURN_REQUESTED', aggregateType: 'RentalOrder', aggregateId: orderId,
      payload: { orderId, tripId: order.tripId, returnTaskId: task.id,
        returnPointId: order.returnPointId, scheduledAt: scheduledAt.toISOString(), reason },
    },
  });
  return task.id;
}
