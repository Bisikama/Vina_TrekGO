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

/** Lý do mở task theo lịch (không phải sự kiện kết thúc sớm): không thay thế yêu cầu trả sớm, không dời lịch. */
const SCHEDULED_REASONS = new Set<string>(['HANDOVER', 'DUE']);

/**
 * Mở task thu hồi ngay khi bàn giao cho khách (HANDOVER), hoặc job dự phòng (DUE),
 * hoặc khi có sự kiện kết thúc sớm. Không có giới hạn giờ thu hồi: nhân viên được quét bất cứ lúc nào.
 * Caller khóa rental_orders trước khi gọi; unique(orderId, taskType) chặn tạo trùng.
 * Task chỉ phân công người thực hiện, không chuyển quyền giữ thiết bị.
 */
export async function ensureReturnTaskWithTx(
  tx: Prisma.TransactionClient,
  orderId: string,
  scheduledAt: Date,
  reason:
    | 'HANDOVER'
    | 'DUE'
    | 'TRIP_ENDED_EARLY'
    | 'BOOKING_CANCELLED_AFTER_HANDOVER'
    | 'MEMBERSHIP_REVOKED_AFTER_HANDOVER'
    | 'USER_EARLY_RETURN',
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

  if (!SCHEDULED_REASONS.has(reason) && reason !== 'USER_EARLY_RETURN') {
    // A real lifecycle event is an independent reason to collect, even if the
    // customer cancels or has not confirmed a voluntary early appointment.
    const superseded = await tx.rentalEarlyReturnRequest.updateMany({
      where: { orderId, status: { in: ['PENDING', 'CONFIRMED'] } },
      data: { status: 'SUPERSEDED', supersededAt: scheduledAt, version: { increment: 1 } },
    });
    await tx.rentalEarlyReturnRequest.updateMany({
      where: { orderId, status: 'CANCELLED', taskId: { not: null }, supersededAt: null },
      data: { supersededAt: scheduledAt, version: { increment: 1 } },
    });
    if (superseded.count) await tx.auditLog.create({ data: {
      action: 'RENTAL_EARLY_RETURN_SUPERSEDED', entityType: 'RentalOrder', entityId: orderId,
      newValues: { reason, scheduledAt: scheduledAt.toISOString(), count: superseded.count },
    } });
  }

  const where = { orderId_taskType: { orderId, taskType: DeliveryTaskType.RETURN } } as const;
  const existing = await tx.deliveryTask.findUnique({ where });
  if (existing) {
    // Sự kiện kết thúc sớm đưa task đã lên lịch về mốc sớm hơn, không thay assignee/custody.
    if (!SCHEDULED_REASONS.has(reason) && existing.status === DeliveryTaskStatus.SCHEDULED &&
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
