import { PrismaRentalAvailabilityAdapter } from './prisma-rental-availability.adapter';

describe('PrismaRentalAvailabilityAdapter', () => {
  it('chỉ trừ HELD còn TTL và CONFIRMED overlap', async () => {
    const prisma = {
      equipmentUnit: {
        count: jest.fn().mockResolvedValue(10),
      },
      rentalQuantityReservation: {
        findMany: jest.fn().mockResolvedValue([
          { quantity: 2 },
          { quantity: 1 },
        ]),
      },
    };

    const adapter = new PrismaRentalAvailabilityAdapter(prisma as never);
    const now = new Date('2026-09-25T10:00:00Z');

    const result = await adapter.getAvailableCount({
      productId: 'product-1',
      occupiedFrom: new Date('2026-10-01T00:00:00Z'),
      occupiedUntil: new Date('2026-10-03T00:00:00Z'),
      now,
    });

    expect(result).toBe(7);
    expect(prisma.rentalQuantityReservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { status: 'CONFIRMED' },
            {
              status: 'HELD',
              holdExpiresAt: { gt: now },
            },
          ],
        }),
      }),
    );
  });
});
