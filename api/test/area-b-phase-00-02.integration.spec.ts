import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaEquipmentUnitAdapter } from '../src/modules/rental/inventory/infrastructure/adapters/prisma-equipment-unit.adapter';
import { PrismaRentalAvailabilityAdapter } from '../src/modules/rental/ordering/infrastructure/adapters/prisma-rental-availability.adapter';
import type { PrismaService } from '../src/shared/services/prisma.service';

const url = process.env.AREAB_TEST_DATABASE_URL || process.env.DATABASE_URL;

if (url) {
  const parsed = new URL(url);
  if (!parsed.pathname.includes('areab_test') && !parsed.pathname.includes('areab_migration_test')) {
    throw new Error(
      'AREAB integration tests require an isolated areab_test database.',
    );
  }
}

const suite = url ? describe : describe.skip;

suite('Area B Phase 00-02 PostgreSQL Integration', () => {
  const db = new PrismaClient({
    datasourceUrl: url || 'postgresql://unused:unused@127.0.0.1:1/areab_test',
  });

  const equipmentAdapter = new PrismaEquipmentUnitAdapter(
    db as unknown as PrismaService,
  );
  const availabilityAdapter = new PrismaRentalAvailabilityAdapter(
    db as unknown as PrismaService,
  );

  beforeAll(async () => {
    await db.$connect();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  describe('Inventory - Equipment Unit Constraint & Locking', () => {
    let locationId: string;
    let productId: string;

    beforeAll(async () => {
      const cat = await db.rentalCategory.create({
        data: { name: 'Tents', slug: `tents-${randomUUID().slice(0, 8)}` },
      });
      const prod = await db.rentalProduct.create({
        data: {
          categoryId: cat.id,
          sku: `TENT-${randomUUID().slice(0, 8)}`,
          name: '2-person Tent',
          dailyPrice: 100000,
          replacementValue: 2000000,
          depositValue: 500000,
          status: 'ACTIVE',
        },
      });
      productId = prod.id;

      const loc = await db.inventoryLocation.create({
        data: {
          code: `WH-${randomUUID().slice(0, 8)}`,
          name: 'Main Warehouse',
          address: '123 Main St',
          status: 'ACTIVE',
        },
      });
      locationId = loc.id;
    });

    it('should enforce unique assetCode (EQUIPMENT_ASSET_CODE_EXISTS)', async () => {
      const assetCode = `TENT-01-UNIQUE-${randomUUID()}`;

      await equipmentAdapter.createUnit({
        productId,
        homeInventoryLocationId: locationId,
        currentInventoryLocationId: locationId,
        assetCode,
        qrCode: `QR-${assetCode}`,
        status: 'AVAILABLE',
        condition: 'GOOD',
      });

      // Attempt to create another with same assetCode
      await expect(
        equipmentAdapter.createUnit({
          productId,
          homeInventoryLocationId: locationId,
          currentInventoryLocationId: locationId,
          assetCode,
          qrCode: `QR-OTHER-${randomUUID()}`,
          status: 'AVAILABLE',
          condition: 'GOOD',
        }),
      ).rejects.toThrow(/EQUIPMENT_ASSET_CODE_EXISTS/);
    });

    it('should handle optimistic locking during maintenance start (VERSION_CONFLICT)', async () => {
      const unit = await equipmentAdapter.createUnit({
        productId,
        homeInventoryLocationId: locationId,
        currentInventoryLocationId: locationId,
        assetCode: `TENT-MAINT-${randomUUID()}`,
        qrCode: `QR-MAINT-${randomUUID()}`,
        status: 'AVAILABLE',
        condition: 'GOOD',
      });

      // Simulate a concurrent update by directly modifying the database
      await db.equipmentUnit.update({
        where: { id: unit.id },
        data: { version: { increment: 1 } },
      });

      // Start maintenance with old version
      await expect(
        equipmentAdapter.startMaintenance({
          unitId: unit.id,
          inventoryLocationId: locationId,
          staffId: randomUUID(),
          reason: 'Routine check',
          expectedVersion: 1, // original version
        }),
      ).rejects.toThrow(/VERSION_CONFLICT/);
    });
  });

  describe('Inventory Availability (Capacity Check)', () => {
    let locationId: string;
    let productId: string;
    let testOrderLineId: string;

    beforeAll(async () => {
      const cat = await db.rentalCategory.create({
        data: { name: 'Bags', slug: `bags-${randomUUID().slice(0, 8)}` },
      });
      const prod = await db.rentalProduct.create({
        data: {
          categoryId: cat.id,
          sku: `BAG-${randomUUID().slice(0, 8)}`,
          name: 'Sleeping Bag',
          dailyPrice: 50000,
          replacementValue: 500000,
          depositValue: 100000,
          status: 'ACTIVE',
        },
      });
      productId = prod.id;

      const loc = await db.inventoryLocation.create({
        data: {
          code: `WH-${randomUUID().slice(0, 8)}`,
          name: 'Main Warehouse',
          address: '123 Main St',
          status: 'ACTIVE',
        },
      });
      locationId = loc.id;

      // Create 5 units
      for (let i = 0; i < 5; i++) {
        await equipmentAdapter.createUnit({
          productId,
          homeInventoryLocationId: locationId,
          currentInventoryLocationId: locationId,
          assetCode: `BAG-${i}-${randomUUID()}`,
          qrCode: `QR-BAG-${i}-${randomUUID()}`,
          status: 'AVAILABLE',
          condition: 'GOOD',
        });
      }

      // Create parent chain for reservations (user -> trip -> policy -> quote -> order -> order line)
      const testUserId = randomUUID();
      const testUser = await db.user.create({
        data: {
          id: testUserId,
          authUserId: testUserId,
          email: `avail-${randomUUID().slice(0, 8)}@example.com`,
          fullName: 'Avail User',
          role: 'USER',
          status: 'ACTIVE',
        },
      });
      const dest = await db.destination.create({
        data: { id: randomUUID(), name: 'Avail Dest', region: 'VN' },
      });
      const pPoint = await db.pickupPoint.create({
        data: {
          id: randomUUID(),
          code: `PUP-${randomUUID().slice(0, 8)}`,
          name: 'PUP Point',
          address: '123 Point',
          latitude: 10.0,
          longitude: 106.0,
          createdBy: testUser.id,
        },
      });
      const trip = await db.trip.create({
        data: {
          id: randomUUID(),
          title: 'Avail Trip',
          destinationId: dest.id,
          leaderId: testUser.id,
          creatorId: testUser.id,
          pickupPointId: pPoint.id,
          status: 'OPEN',
          tripType: 'PUBLIC',
          maxPax: 10,
          startAt: new Date('2026-11-01T00:00:00Z'),
          endAt: new Date('2026-11-10T00:00:00Z'),
        },
      });
      const pol = await db.rentalPolicy.create({
        data: {
          id: randomUUID(),
          policyCode: `POL-${randomUUID().slice(0, 8)}`,
          versionNo: 1,
          currency: 'VND',
          dayCountMode: 'CEIL_24H',
          quoteTtlMinutes: 60,
          paymentHoldMinutes: 15,
          freeCancellationHours: 24,
          cutoffHoursBeforeTrip: 48,
          prepBufferMinutes: 0,
          returnBufferMinutes: 1440,
          cleaningBufferMinutes: 1440,
          deepInspectionBufferMinutes: 2880,
          cancellationRules: [],
          effectiveFrom: new Date('2020-01-01'),
          isActive: true,
        },
      });
      const quote = await db.rentalQuote.create({
        data: {
          id: randomUUID(),
          userId: testUser.id,
          tripId: trip.id,
          rentalPolicyId: pol.id,
          contextVersion: 1,
          rentalStartAt: new Date('2026-11-01T00:00:00Z'),
          rentalEndAt: new Date('2026-11-05T00:00:00Z'),
          plannedHandoverAt: new Date('2026-11-01T00:00:00Z'),
          plannedReturnAt: new Date('2026-11-05T00:00:00Z'),
          occupiedStartAt: new Date('2026-11-01T00:00:00Z'),
          occupiedEndAt: new Date('2026-11-05T00:00:00Z'),
          recipientSnapshot: {},
          rentalFee: 100000,
          totalDeposit: 500000,
          totalAmount: 600000,
          currency: 'VND',
          policySnapshot: {},
          expiresAt: new Date('2026-11-01T01:00:00Z'),
        },
      });
      const order = await db.rentalOrder.create({
        data: {
          id: randomUUID(),
          quoteId: quote.id,
          userId: testUser.id,
          tripId: trip.id,
          rentalPolicyId: pol.id,
          pickupPointId: pPoint.id,
          returnPointId: pPoint.id,
          contextVersionSnapshot: 1,
          rentalStartAt: new Date('2026-11-01T00:00:00Z'),
          rentalEndAt: new Date('2026-11-05T00:00:00Z'),
          plannedHandoverAt: new Date('2026-11-01T00:00:00Z'),
          plannedReturnAt: new Date('2026-11-05T00:00:00Z'),
          occupiedStartAt: new Date('2026-11-01T00:00:00Z'),
          occupiedEndAt: new Date('2026-11-05T00:00:00Z'),
          recipientSnapshot: {},
          rentalFee: 100000,
          totalDeposit: 500000,
          totalAmount: 600000,
          currency: 'VND',
          policySnapshot: {},
          paymentExpiresAt: new Date('2026-11-01T01:00:00Z'),
          rentalOrderLinesViaOrderId: {
            create: {
              productId,
              quantity: 5,
              dailyPriceSnapshot: 50000,
              depositPerUnitSnapshot: 100000,
              replacementValueSnapshot: 500000,
              chargedDays: 2,
              lineRentalFee: 100000,
              lineDeposit: 500000,
            },
          },
        },
        include: { rentalOrderLinesViaOrderId: true },
      });
      testOrderLineId = order.rentalOrderLinesViaOrderId[0].id;
    });

    afterEach(async () => {
      await db.rentalQuantityReservation.deleteMany({ where: { productId } });
    });

    it('should return full capacity when no reservations', async () => {
      const count = await availabilityAdapter.getAvailableCount({
        productId,
        occupiedFrom: new Date('2026-11-01T10:00:00Z'),
        occupiedUntil: new Date('2026-11-03T10:00:00Z'),
        now: new Date('2026-10-09T10:00:00Z'),
      });
      expect(count).toBe(5);
    });

    it('should reduce capacity for overlapping CONFIRMED reservations', async () => {
      // Reservation from Nov 1 to Nov 5
      await db.rentalQuantityReservation.create({
        data: {
          orderLineId: testOrderLineId,
          productId,
          quantity: 2,
          occupiedFrom: new Date('2026-11-01T00:00:00Z'),
          occupiedUntil: new Date('2026-11-05T00:00:00Z'),
          status: 'CONFIRMED',
          version: 1,
        },
      });

      // Query from Nov 2 to Nov 3 (Overlaps!)
      const count = await availabilityAdapter.getAvailableCount({
        productId,
        occupiedFrom: new Date('2026-11-02T10:00:00Z'),
        occupiedUntil: new Date('2026-11-03T10:00:00Z'),
        now: new Date('2026-10-09T10:00:00Z'),
      });
      expect(count).toBe(3); // 5 - 2 = 3
    });

    it('should NOT reduce capacity if reservations do not overlap', async () => {
      // Reservation from Nov 1 to Nov 5
      await db.rentalQuantityReservation.create({
        data: {
          orderLineId: testOrderLineId,
          productId,
          quantity: 3,
          occupiedFrom: new Date('2026-11-01T00:00:00Z'),
          occupiedUntil: new Date('2026-11-05T00:00:00Z'),
          status: 'CONFIRMED',
          version: 1,
        },
      });

      // Query from Nov 6 to Nov 8 (Does not overlap)
      const count = await availabilityAdapter.getAvailableCount({
        productId,
        occupiedFrom: new Date('2026-11-06T10:00:00Z'),
        occupiedUntil: new Date('2026-11-08T10:00:00Z'),
        now: new Date('2026-10-09T10:00:00Z'),
      });
      expect(count).toBe(5); // Still 5 available
    });
  });
});

