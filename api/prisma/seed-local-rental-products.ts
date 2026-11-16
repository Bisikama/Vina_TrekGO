import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { seedCategories } from './seeds/category.seed'
import { seedInventoryLocations } from './seeds/inventory-location.seed'
import { seedRentalProducts } from './seeds/rental-product.seed'
import { seedEquipmentUnits } from './seeds/equipment-unit.seed'
import { seedProductTechnicalProfiles } from './seeds/product-technical-profile.seed'

const url = process.env.DIRECT_URL || process.env.DATABASE_URL
const prisma = new PrismaClient({ datasources: { db: { url } } })

async function main() {
  await seedCategories(prisma)
  await seedInventoryLocations(prisma)
  await seedRentalProducts(prisma)
  await seedEquipmentUnits(prisma)
  await seedProductTechnicalProfiles(prisma)
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
