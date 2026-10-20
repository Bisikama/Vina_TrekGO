import { DeliveryTaskStatus, DeliveryTaskType, Prisma, RentalOrderStatus } from '@prisma/client';
import { ensureReturnTaskWithTx } from './rental-return-task';
import { RentalOverdueService } from './rental-overdue.service';

describe('ReturnTask baseline 1.3.2 (pure mock)', () => {
  const due = new Date('2026-10-20T10:00:00.000Z');
  const order = {
    id: 'order-1', tripId: 'trip-1', returnPointId: 'point-1',
    status: RentalOrderStatus.ACTIVE,
    packageViaOrderId: { id: 'package-1' },
    rentalHandoverViaOrderId: { id: 'handover-1' },
  };

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

  it('sự kiện sớm dùng lại task đã có và chỉ đưa lịch về sớm hơn', async () => {
    const tx = {
      rentalOrder: { findUnique: jest.fn().mockResolvedValue(order) },
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
