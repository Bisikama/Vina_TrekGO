import {
  EquipmentCondition,
  EquipmentUnitStatus,
  ReservationStatus,
} from '@prisma/client';
import { PrismaRentalAvailabilityAdapter } from './prisma-rental-availability.adapter';

describe('PrismaRentalAvailabilityAdapter', () => {
  let adapter: PrismaRentalAvailabilityAdapter;

  let prismaMock: {
    equipmentUnit: {
      findMany: jest.Mock;
    };
    rentalQuantityReservation: {
      findMany: jest.Mock;
    };
    rentalCapacityAlert: {
      upsert: jest.Mock;
    };
  };

  const now = new Date('2026-09-25T10:00:00Z');

  const query = {
    productId: 'prod-1',
    occupiedFrom: new Date('2026-10-01T00:00:00Z'),
    occupiedUntil: new Date('2026-10-03T00:00:00Z'),
    now,
  };

  function createUnits(count: number, loc = 'loc-1') {
    return Array.from({ length: count }, (_, i) => ({
      id: `unit-${i + 1}`,
      status: EquipmentUnitStatus.AVAILABLE,
      homeInventoryLocationId: loc,
      currentInventoryLocationId: loc,
      readinessCommitmentsViaUnitId: [],
      returnInspectionTasks: [],
    }));
  }

  beforeEach(() => {
    prismaMock = {
      equipmentUnit: {
        findMany: jest.fn(),
      },
      rentalQuantityReservation: {
        findMany: jest.fn(),
      },
      rentalCapacityAlert: {
        upsert: jest.fn().mockResolvedValue({}),
      },
    };

    adapter = new PrismaRentalAvailabilityAdapter(prismaMock as never);
  });

  it('không có reservation và không có unit bị chặn thì trả toàn bộ sức chứa', async () => {
    prismaMock.equipmentUnit.findMany.mockResolvedValue(createUnits(10));
    prismaMock.rentalQuantityReservation.findMany.mockResolvedValue([]);

    const result = await adapter.getAvailableCount(query);

    expect(result).toBe(10);
  });

  it('loại unit MAINTENANCE, DAMAGED, LOST, RETIRED khỏi truy vấn sức chứa cơ sở', async () => {
    prismaMock.equipmentUnit.findMany.mockResolvedValue(createUnits(10));
    prismaMock.rentalQuantityReservation.findMany.mockResolvedValue([]);

    await adapter.getAvailableCount(query);

    expect(prismaMock.equipmentUnit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          productId: query.productId,
          status: {
            notIn: [
              EquipmentUnitStatus.MAINTENANCE,
              EquipmentUnitStatus.DAMAGED,
              EquipmentUnitStatus.LOST,
              EquipmentUnitStatus.RETIRED,
            ],
          },
          condition: {
            notIn: [EquipmentCondition.DAMAGED, EquipmentCondition.LOST],
          },
        }),
      }),
    );
  });

  it('trừ HELD còn TTL và CONFIRMED đang overlap', async () => {
    prismaMock.equipmentUnit.findMany.mockResolvedValue(createUnits(10));
    prismaMock.rentalQuantityReservation.findMany.mockResolvedValue([
      { id: 'res-1', quantity: 2, occupiedFrom: query.occupiedFrom, occupiedUntil: query.occupiedUntil },
      { id: 'res-2', quantity: 1, occupiedFrom: query.occupiedFrom, occupiedUntil: query.occupiedUntil },
    ]);

    const result = await adapter.getAvailableCount(query);

    expect(result).toBe(7);

    expect(prismaMock.rentalQuantityReservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          productId: query.productId,
          occupiedFrom: { lt: query.occupiedUntil },
          occupiedUntil: { gt: query.occupiedFrom },
          OR: [
            { status: ReservationStatus.CONFIRMED },
            { status: ReservationStatus.HELD, holdExpiresAt: { gt: query.now } },
          ],
        }),
      }),
    );
  });

  it('reservation quantity 3 đã pick một phần vẫn chỉ trừ quantity 3', async () => {
    prismaMock.equipmentUnit.findMany.mockResolvedValue(createUnits(10));
    prismaMock.rentalQuantityReservation.findMany.mockResolvedValue([
      { id: 'res-1', quantity: 3, occupiedFrom: query.occupiedFrom, occupiedUntil: query.occupiedUntil },
    ]);

    const result = await adapter.getAvailableCount(query);

    expect(result).toBe(7);
  });

  it('reservation quantity 2 và đã pick đủ 2 unit không bị trừ hai lần', async () => {
    prismaMock.equipmentUnit.findMany.mockResolvedValue(createUnits(10));
    prismaMock.rentalQuantityReservation.findMany.mockResolvedValue([
      { id: 'res-1', quantity: 2, occupiedFrom: query.occupiedFrom, occupiedUntil: query.occupiedUntil },
    ]);

    const result = await adapter.getAvailableCount(query);

    expect(result).toBe(8);
  });

  it('unit có inspection task chưa completed không được tính là ready', async () => {
    const units = createUnits(10);
    units[0].returnInspectionTasks = [{ status: 'PENDING' }] as never[];
    prismaMock.equipmentUnit.findMany.mockResolvedValue(units);
    prismaMock.rentalQuantityReservation.findMany.mockResolvedValue([]);

    const result = await adapter.getAvailableCount(query);

    expect(result).toBe(9);
  });

  it('unit không có currentInventoryLocationId không được tính là ready', async () => {
    const units = createUnits(10);
    units[0].currentInventoryLocationId = null as never;
    prismaMock.equipmentUnit.findMany.mockResolvedValue(units);
    prismaMock.rentalQuantityReservation.findMany.mockResolvedValue([]);

    const result = await adapter.getAvailableCount(query);

    expect(result).toBe(9);
  });

  it('không trả availableCount âm khi reservation vượt số lượng', async () => {
    prismaMock.equipmentUnit.findMany.mockResolvedValue(createUnits(10));
    prismaMock.rentalQuantityReservation.findMany.mockResolvedValue([
      { id: 'res-1', quantity: 15, occupiedFrom: query.occupiedFrom, occupiedUntil: query.occupiedUntil },
    ]);

    const result = await adapter.getAvailableCount(query);

    expect(result).toBe(0);
  });

  it('dùng biên thời gian nửa mở để hai window chỉ chạm nhau không bị overlap', async () => {
    prismaMock.equipmentUnit.findMany.mockResolvedValue(createUnits(10));
    prismaMock.rentalQuantityReservation.findMany.mockResolvedValue([]);

    await adapter.getAvailableCount(query);

    expect(prismaMock.rentalQuantityReservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          occupiedFrom: { lt: query.occupiedUntil },
          occupiedUntil: { gt: query.occupiedFrom },
        }),
      }),
    );
  });

  it('ném lỗi khi window không hợp lệ (occupiedFrom >= occupiedUntil)', async () => {
    const invalidQuery = {
      ...query,
      occupiedFrom: query.occupiedUntil,
      occupiedUntil: query.occupiedFrom,
    };

    await expect(adapter.getAvailableCount(invalidQuery)).rejects.toThrow('INVALID_OCCUPIED_WINDOW');
  });

  it('ghi nhận alert khi xảy ra shortage', async () => {
    prismaMock.equipmentUnit.findMany.mockResolvedValue(createUnits(2));
    prismaMock.rentalQuantityReservation.findMany.mockResolvedValue([]);

    const result = await adapter.getAvailableCount({
      ...query,
      requestedQuantity: 5,
    });

    expect(result).toBe(2);
    expect(prismaMock.rentalCapacityAlert.upsert).toHaveBeenCalled();
  });
});