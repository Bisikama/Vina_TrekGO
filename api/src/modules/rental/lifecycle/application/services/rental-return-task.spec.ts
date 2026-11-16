import { DeliveryTaskStatus, DeliveryTaskType, Prisma, RentalOrderStatus } from '@prisma/client';
import { ensureReturnTaskWithTx, returnTaskScheduleAt } from './rental-return-task';
import { RentalOverdueService } from './rental-overdue.service';

describe('ReturnTask baseline 1.3.2 (pure mock)', () => {
  const due = new Date('2026-10-20T10:00:00.000Z');
  const order = {
    id: 'order-1', tripId: 'trip-1', returnPointId: 'point-1',
    status: RentalOrderStatus.ACTIVE,
    packageViaOrderId: { id: 'package-1' },
    rentalHandoverViaOrderId: { id: 'handover-1' },
  };

  it('uses confirmed return slot for dispatch while overdue due remains separate', () => {
    const slot = '2026-10-20T08:00:00.000Z';
    expect(returnTaskScheduleAt({ slotAt: slot }, due).toISOString()).toBe(slot);
    expect(returnTaskScheduleAt({ pointId: 'point-1' }, due)).toEqual(due);
  });

  it('tạo một task RETURN khi đến hạn và không chuyển custody', async () => {
    const tx = {
      rentalOrder: { findUnique: jest.fn().mockResolvedValue(order) },
      deliveryTask: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'task-1' }),
        update: jest.fn(),
      },
      rentalOutboxEvent: { upsert: jest.fn() },
    };
    const id = await ensureReturnTaskWithTx(tx as unknown as Prisma.TransactionClient, order.id, due, 'DUE');
    expect(id).toBe('task-1');
    expect(tx.deliveryTask.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      orderId: order.id, taskType: DeliveryTaskType.RETURN,
      status: DeliveryTaskStatus.SCHEDULED, scheduledAt: due,
    }) });
    expect(tx.rentalOutboxEvent.upsert).toHaveBeenCalledTimes(1);
  });

  it('mở task ngay lúc bàn giao, không đụng tới yêu cầu trả sớm và không dời lịch task có sẵn', async () => {
    const tx = {
      rentalOrder: { findUnique: jest.fn().mockResolvedValue(order) },
      rentalEarlyReturnRequest: { updateMany: jest.fn() },
      deliveryTask: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'task-1' }),
        update: jest.fn(),
      },
      rentalOutboxEvent: { upsert: jest.fn() },
    };
    const id = await ensureReturnTaskWithTx(tx as unknown as Prisma.TransactionClient, order.id, due, 'HANDOVER');
    expect(id).toBe('task-1');
    expect(tx.deliveryTask.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      taskType: DeliveryTaskType.RETURN, status: DeliveryTaskStatus.SCHEDULED, scheduledAt: due,
    }) });
    expect(tx.rentalEarlyReturnRequest.updateMany).not.toHaveBeenCalled();
    expect(tx.rentalOutboxEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ payload: expect.objectContaining({ reason: 'HANDOVER' }) }),
    }));

    // Gọi lại khi task đã có (ví dụ job dự phòng chạy sau): giữ nguyên lịch.
    tx.deliveryTask.findUnique.mockResolvedValue({ id: 'task-1', status: DeliveryTaskStatus.SCHEDULED, scheduledAt: due });
    const earlier = new Date(due.getTime() - 3_600_000);
    expect(await ensureReturnTaskWithTx(tx as unknown as Prisma.TransactionClient, order.id, earlier, 'HANDOVER')).toBe('task-1');
    expect(tx.deliveryTask.update).not.toHaveBeenCalled();
  });

  it('job dự phòng mở task cho đơn ACTIVE chưa có task, kể cả khi chưa đến hạn trả', async () => {
    const notDueYet = new Date(due.getTime() - 3 * 86_400_000);
    const tx = {
      $queryRaw: jest.fn(),
      rentalOrder: { findUnique: jest.fn()
        .mockResolvedValueOnce({ status: RentalOrderStatus.ACTIVE, rentalEndAt: due, operationalReturnDueAt: null })
        .mockResolvedValueOnce(order) },
      deliveryTask: { findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'task-1' }) },
      rentalOutboxEvent: { upsert: jest.fn() },
    };
    const prisma = {
      rentalOrder: { findMany: jest.fn().mockResolvedValue([{ id: order.id }]) },
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new RentalOverdueService(prisma as never);
    expect(await service.openDueReturnTasks(notDueYet)).toBe(1);
    const where = prisma.rentalOrder.findMany.mock.calls[0][0].where;
    expect(where).not.toHaveProperty('rentalEndAt');
    expect(where).toMatchObject({ status: RentalOrderStatus.ACTIVE, deliveryTasksViaOrderId: { none: { taskType: 'RETURN' } } });
    // Lịch hẹn vẫn là hạn trả, không phải lúc job chạy.
    expect(tx.deliveryTask.create).toHaveBeenCalledWith({ data: expect.objectContaining({ scheduledAt: due }) });
  });

  it('sự kiện sớm dùng lại task đã có và chỉ đưa lịch về sớm hơn', async () => {
    const tx = {
      rentalOrder: { findUnique: jest.fn().mockResolvedValue(order) },
      rentalEarlyReturnRequest: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      deliveryTask: {
        findUnique: jest.fn().mockResolvedValue({ id: 'task-1', status: DeliveryTaskStatus.SCHEDULED,
          scheduledAt: new Date('2026-10-21T10:00:00.000Z') }),
        create: jest.fn(), update: jest.fn(),
      },
      rentalOutboxEvent: { upsert: jest.fn() },
    };
    const id = await ensureReturnTaskWithTx(tx as unknown as Prisma.TransactionClient,
      order.id, due, 'TRIP_ENDED_EARLY');
    expect(id).toBe('task-1');
    expect(tx.deliveryTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' }, data: { scheduledAt: due, version: { increment: 1 } },
    });
    expect(tx.deliveryTask.create).not.toHaveBeenCalled();
    expect(tx.rentalOutboxEvent.upsert).not.toHaveBeenCalled();
  });

  it('job đến hạn đọc lại order dưới khóa và mở task', async () => {
    const tx = {
      $queryRaw: jest.fn(),
      rentalOrder: { findUnique: jest.fn()
        .mockResolvedValueOnce({ status: RentalOrderStatus.ACTIVE, rentalEndAt: due, operationalReturnDueAt: null })
        .mockResolvedValueOnce(order) },
      deliveryTask: { findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'task-1' }) },
      rentalOutboxEvent: { upsert: jest.fn() },
    };
    const prisma = {
      rentalOrder: { findMany: jest.fn().mockResolvedValue([{ id: order.id }]) },
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new RentalOverdueService(prisma as never);
    expect(await service.openDueReturnTasks(due)).toBe(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.deliveryTask.create).toHaveBeenCalledTimes(1);
  });
});
