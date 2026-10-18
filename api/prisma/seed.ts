import { PrismaClient } from '@prisma/client'
import { seedCategories } from './seeds/category.seed'
import { seedInventoryLocations } from './seeds/inventory-location.seed'
import { seedRentalProducts } from './seeds/rental-product.seed'
import { seedEquipmentUnits } from './seeds/equipment-unit.seed'
import { seedRentalPolicy } from './seeds/rental-policy.seed'
import { seedBookingPolicies } from './seeds/booking-policy.seed'

const prisma = new PrismaClient()

async function main() {
  console.log('Start seeding database...')

  await seedCategories(prisma)
  await seedInventoryLocations(prisma)
  await seedRentalProducts(prisma)
  await seedEquipmentUnits(prisma)
  await seedRentalPolicy(prisma)
  await seedBookingPolicies(prisma)

  console.log('All seeding finished.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
