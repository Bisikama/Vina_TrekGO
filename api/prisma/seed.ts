import { PrismaClient } from '@prisma/client';
import { seedCategories } from './seeds/category.seed';
import { seedInventoryLocations } from './seeds/inventory-location.seed';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding database...');
  
  await seedCategories(prisma);
  await seedInventoryLocations(prisma);
  
  // Có thể thêm các seeders khác ở đây trong tương lai. Ví dụ:
  // await seedRentalProducts(prisma);
  // await seedUsers(prisma);
  
  console.log('All seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
