import {
  EquipmentCondition,
  EquipmentUnitStatus,
  RentalUnitAssignmentStatus,
  ReservationStatus,
} from '@prisma/client';
import { PrismaRentalAvailabilityAdapter } from './prisma-rental-availability.adapter';

describe('PrismaRentalAvailabilityAdapter', () => {
  let adapter: PrismaRentalAvailabilityAdapter;

  let prismaMock: {
    equipmentUnit: {
      count: jest.Mock;
    };
    rentalQuantityReservation: {
      findMany: jest.Mock;
    };
  };

  const now = new Date('2026-09-25T10:00:00Z');

  const query = {
    productId: 'prod-1',
    occupiedFrom: new Date('2026-10-01T00:00:00Z'),
    occupiedUntil: new Date('2026-10-03T00:00:00Z'),
    now,
  };

  beforeEach(() => {
    prismaMock = {
      equipmentUnit: {
        count: jest.fn(),
      },
      rentalQuantityReservation: {
        findMany: jest.fn(),
      },
    };

    adapter = new PrismaRentalAvailabilityAdapter(
      prismaMock as never,
    );
  });

  it('không có reservation và không có unit bị chặn thì trả toàn bộ sức chứa', async () => {
    prismaMock.equipmentUnit.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(0);

    prismaMock.rentalQuantityReservation.findMany.mockResolvedValue([]);

    const result = await adapter.getAvailableCount(query);

    expect(result).toBe(10);
  });

  it('loại unit MAINTENANCE, DAMAGED, LOST, RETIRED và condition không an toàn khỏi sức chứa cơ sở', async () => {
    prismaMock.equipmentUnit.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(0);

    prismaMock.rentalQuantityReservation.findMany.mockResolvedValue([]);

    await adapter.getAvailableCount(query);

    expect(prismaMock.equipmentUnit.count).toHaveBeenNthCalledWith(
      1,
      {
        where: {
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
            notIn: [
              EquipmentCondition.DAMAGED,
              EquipmentCondition.LOST,
            ],
          },
        },
      },
    );
  });

  it('trừ HELD còn TTL và CONFIRMED đang overlap', async () => {
    prismaMock.equipmentUnit.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(0);

    prismaMock.rentalQuantityReservation.findMany.mockResolvedValue([
      { quantity: 2 },
      { quantity: 1 },
    ]);

    const result = await adapter.getAvailableCount(query);

    expect(result).toBe(7);

    expect(
      prismaMock.rentalQuantityReservation.findMany,
    ).toHaveBeenCalledWith({
      where: {
        productId: query.productId,

        occupiedFrom: {
          lt: query.occupiedUntil,
        },

        occupiedUntil: {
          gt: query.occupiedFrom,
        },

        OR: [
          {
            status: ReservationStatus.CONFIRMED,
          },
          {
            status: ReservationStatus.HELD,
            holdExpiresAt: {
              gt: query.now,
            },
          },
        ],
      },

      select: {
        quantity: true,
      },
    });
  });

  it('reservation quantity 3 đã pick một phần vẫn chỉ trừ quantity 3', async () => {
    prismaMock.equipmentUnit.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(0);

    prismaMock.rentalQuantityReservation.findMany.mockResolvedValue([
      { quantity: 3 },
    ]);

    const result = await adapter.getAvailableCount(query);

    expect(result).toBe(7);
  });

  it('reservation quantity 2 và đã pick đủ 2 unit không bị trừ hai lần', async () => {
    prismaMock.equipmentUnit.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(0);

    prismaMock.rentalQuantityReservation.findMany.mockResolvedValue([
      { quantity: 2 },
    ]);

    const result = await adapter.getAvailableCount(query);

    expect(result).toBe(8);
  });

  it('unit trả trễ không còn reservation overlap vẫn bị chặn bổ sung', async () => {
    prismaMock.equipmentUnit.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(1);

    prismaMock.rentalQuantityReservation.findMany.mockResolvedValue([]);

    const result = await adapter.getAvailableCount(query);

    expect(result).toBe(9);
  });

  it('unit CLEANING được reservation CONFIRMED overlap đại diện thì không bị trừ hai lần', async () => {
    prismaMock.equipmentUnit.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(0);

    prismaMock.rentalQuantityReservation.findMany.mockResolvedValue([
      { quantity: 1 },
    ]);

    const result = await adapter.getAvailableCount(query);

    expect(result).toBe(9);
  });

  it('unit CLEANING không còn reservation overlap vẫn bị chặn', async () => {
    prismaMock.equipmentUnit.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(1);

    prismaMock.rentalQuantityReservation.findMany.mockResolvedValue([]);

    const result = await adapter.getAvailableCount(query);

    expect(result).toBe(9);
  });

  it('REPLACED và UNASSIGNED không được dùng để chứng minh unit đã được reservation đại diện', async () => {
    prismaMock.equipmentUnit.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(1);

    prismaMock.rentalQuantityReservation.findMany.mockResolvedValue([]);

    await adapter.getAvailableCount(query);

    expect(prismaMock.equipmentUnit.count).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          rentalUnitAssignmentsViaEquipmentUnitId: {
            none: expect.objectContaining({
              status: {
                in: [
                  RentalUnitAssignmentStatus.ASSIGNED,
                  RentalUnitAssignmentStatus.PACKED,
                  RentalUnitAssignmentStatus.HANDED_OVER,
                  RentalUnitAssignmentStatus.RETURNED,
                  RentalUnitAssignmentStatus.CLOSED,
                ],
              },
            }),
          },
        }),
      }),
    );
  });

  it('HELD không được dùng làm bằng chứng rằng exact unit đã được reservation đại diện', async () => {
    prismaMock.equipmentUnit.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(0);

    prismaMock.rentalQuantityReservation.findMany.mockResolvedValue([]);

    await adapter.getAvailableCount(query);

    expect(prismaMock.equipmentUnit.count).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          rentalUnitAssignmentsViaEquipmentUnitId: {
            none: expect.objectContaining({
              orderLine: expect.objectContaining({
                rentalQuantityReservationsViaOrderLineId: {
                  some: expect.objectContaining({
                    status: ReservationStatus.CONFIRMED,
                  }),
                },
              }),
            }),
          },
        }),
      }),
    );
  });

  it('bước chặn bổ sung cũng phải loại condition DAMAGED và LOST để tránh trừ hai lần', async () => {
    prismaMock.equipmentUnit.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(0);

    prismaMock.rentalQuantityReservation.findMany.mockResolvedValue([]);

    await adapter.getAvailableCount(query);

    expect(prismaMock.equipmentUnit.count).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          condition: {
            notIn: [
              EquipmentCondition.DAMAGED,
              EquipmentCondition.LOST,
            ],
          },
        }),
      }),
    );
  });

  it('đếm current assignment đang hoạt động như một nguồn chặn vật lý', async () => {
    prismaMock.equipmentUnit.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(1);

    prismaMock.rentalQuantityReservation.findMany.mockResolvedValue([]);

    await adapter.getAvailableCount(query);

    expect(prismaMock.equipmentUnit.count).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            {
              rentalUnitAssignmentsViaEquipmentUnitId: {
                some: {
                  status: {
                    in: [
                      RentalUnitAssignmentStatus.ASSIGNED,
                      RentalUnitAssignmentStatus.PACKED,
                      RentalUnitAssignmentStatus.HANDED_OVER,
                    ],
                  },
                },
              },
            },
          ]),
        }),
      }),
    );
  });

  it('không trả availableCount âm', async () => {
    prismaMock.equipmentUnit.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(2);

    prismaMock.rentalQuantityReservation.findMany.mockResolvedValue([
      { quantity: 15 },
    ]);

    const result = await adapter.getAvailableCount(query);

    expect(result).toBe(0);
  });

  it('dùng biên thời gian nửa mở để hai window chỉ chạm nhau không bị overlap', async () => {
    prismaMock.equipmentUnit.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(0);

    prismaMock.rentalQuantityReservation.findMany.mockResolvedValue([]);

    await adapter.getAvailableCount(query);

    expect(
      prismaMock.rentalQuantityReservation.findMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          occupiedFrom: {
            lt: query.occupiedUntil,
          },
          occupiedUntil: {
            gt: query.occupiedFrom,
          },
        }),
      }),
    );
  });
});