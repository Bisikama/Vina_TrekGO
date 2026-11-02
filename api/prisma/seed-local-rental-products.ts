import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { seedCategories } from './seeds/category.seed'
import { seedInventoryLocations } from './seeds/inventory-location.seed'
import { seedRentalProducts } from './seeds/rental-product.seed'
import { seedEquipmentUnits } from './seeds/equipment-unit.seed'

const url = process.env.DIRECT_URL || process.env.DATABASE_URL
let host = ''
try { host = new URL(url ?? '').hostname.toLowerCase() } catch { /* Report below. */ }
if (!['localhost', '127.0.0.1', '[::1]'].includes(host)) {
  throw new Error('Seed này chỉ được chạy với database local (localhost, 127.0.0.1 hoặc ::1).')
}
const prisma = new PrismaClient({ datasources: { db: { url } } })

async function main() {
  await seedCategories(prisma)
  await seedInventoryLocations(prisma)
  await seedRentalProducts(prisma)
  await seedEquipmentUnits(prisma)
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
