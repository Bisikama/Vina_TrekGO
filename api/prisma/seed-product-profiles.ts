import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { seedProductTechnicalProfiles } from './seeds/product-technical-profile.seed'

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL
const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
})

async function main() {
  await seedProductTechnicalProfiles(prisma)
}

main()
  .catch((e) => {
    console.error('❌ Lỗi:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
