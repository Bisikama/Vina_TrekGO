import { PrismaClient } from '@prisma/client';
import { seedCategories } from './seeds/category.seed';
import { seedInventoryLocations } from './seeds/inventory-location.seed';
import { seedNavigationPhase1 } from './seeds/navigation-phase1.seed';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding database...');
  
  await seedCategories(prisma);
  await seedInventoryLocations(prisma);
  await seedNavigationPhase1(prisma);
  
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
