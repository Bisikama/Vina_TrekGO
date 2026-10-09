import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaEquipmentUnitAdapter } from '../src/modules/rental/inventory/infrastructure/adapters/prisma-equipment-unit.adapter';
import { PrismaRentalAvailabilityAdapter } from '../src/modules/rental/ordering/infrastructure/adapters/prisma-rental-availability.adapter';
import type { PrismaService } from '../src/shared/services/prisma.service';

const url = process.env.AREAB_TEST_DATABASE_URL;

if (url) {
  const parsed = new URL(url);
  if (
    !['localhost', '127.0.0.1'].includes(parsed.hostname) ||
    !parsed.pathname.startsWith('/areab_test')
  ) {
    throw new Error(
      'AREAB integration tests require an isolated localhost areab_test database.',
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
    // Clean up test data before running
    await db.rentalQuantityReservation.deleteMany();
    await db.maintenanceRecord.deleteMany();
    await db.equipmentUnit.deleteMany();
    await db.rentalProduct.deleteMany();
    await db.inventoryLocation.deleteMany();
    await db.rentalCategory.deleteMany();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  describe('Inventory - Equipment Unit Constraint & Locking', () => {
    let locationId: string;
    let productId: string;

    beforeAll(async () => {
      const cat = await db.rentalCategory.create({
        data: { name: 'Tents', slug: 'tents' },
      });
      const prod = await db.rentalProduct.create({
        data: {
          categoryId: cat.id,
          sku: 'TENT-01',
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
          code: 'WH-01',
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

    beforeAll(async () => {
      const cat = await db.rentalCategory.create({
        data: { name: 'Bags', slug: 'bags' },
      });
      const prod = await db.rentalProduct.create({
        data: {
          categoryId: cat.id,
          sku: 'BAG-01',
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
          code: 'WH-01',
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
    });

    afterEach(async () => {
      await db.rentalQuantityReservation.deleteMany();
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
          orderLineId: randomUUID(),
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
          orderLineId: randomUUID(),
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

