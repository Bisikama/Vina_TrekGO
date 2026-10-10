import { PrismaClient } from '@prisma/client';
import { seedCategories } from './seeds/category.seed';
import { seedInventoryLocations } from './seeds/inventory-location.seed';
import { seedRentalProducts } from './seeds/rental-product.seed';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding database...');
  
  await seedCategories(prisma);
  await seedInventoryLocations(prisma);
  await seedRentalProducts(prisma);
  
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
