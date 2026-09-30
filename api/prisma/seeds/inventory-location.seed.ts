import type { PrismaClient } from '@prisma/client';

export async function seedInventoryLocations(prisma: PrismaClient) {
  console.log('Seeding Inventory Locations...');

  // Upsert a test/development inventory location
  await prisma.inventoryLocation.upsert({
    where: { code: 'INV-HCM-01' },
    update: {},
    create: {
      code: 'INV-HCM-01',
      name: '[TEST] Kho Trung Tâm HCM',
      address: 'Phường Đa Kao, Quận 1, TP. Hồ Chí Minh (DEV/TEST ONLY)',
      latitude: 10.7923,
      longitude: 106.6990,
      status: 'ACTIVE',
    },
  });

  console.log('Inventory Locations seeded successfully.');
}
