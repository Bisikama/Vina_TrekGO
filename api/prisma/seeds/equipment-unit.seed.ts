import {
  EquipmentCondition,
  EquipmentUnitStatus,
  Prisma,
  PrismaClient,
  RecordStatus,
  RentalProductStatus,
} from '@prisma/client'
import { RENTAL_PRODUCT_SEEDS } from './rental-product.seed'

export const PRIMARY_RENTAL_LOCATION_CODE = 'INV-HCM-01'
export const DEFAULT_UNITS_PER_RENTAL_PRODUCT = 5

type SeedRentalProduct = {
  id: string
  sku: string
}

export function buildEquipmentUnitSeedData(
  products: readonly SeedRentalProduct[],
  inventoryLocationId: string,
  unitsPerProduct = DEFAULT_UNITS_PER_RENTAL_PRODUCT,
): Prisma.EquipmentUnitCreateManyInput[] {
  return products.flatMap((product) =>
    Array.from({ length: unitsPerProduct }, (_, index) => {
      const sequence = String(index + 1).padStart(3, '0')
      const assetCode = `SEED-${product.sku}-${sequence}`

      return {
        productId: product.id,
        homeInventoryLocationId: inventoryLocationId,
        currentInventoryLocationId: inventoryLocationId,
        assetCode,
        qrCode: `TREKGO:UNIT:${assetCode}`,
        status: EquipmentUnitStatus.AVAILABLE,
        condition: EquipmentCondition.GOOD,
      }
    }),
  )
}

export async function seedEquipmentUnits(prisma: PrismaClient) {
  console.log('Seeding Rental Equipment Units...')

  const inventoryLocation = await prisma.inventoryLocation.findUnique({
    where: { code: PRIMARY_RENTAL_LOCATION_CODE },
    select: { id: true, status: true },
  })

  if (!inventoryLocation || inventoryLocation.status !== RecordStatus.ACTIVE) {
    throw new Error(`Primary rental inventory location ${PRIMARY_RENTAL_LOCATION_CODE} is missing or inactive`)
  }

  const expectedSkus = RENTAL_PRODUCT_SEEDS.map((product) => product.sku)
  const products = await prisma.rentalProduct.findMany({
    where: {
      sku: { in: expectedSkus },
      status: RentalProductStatus.ACTIVE,
    },
    select: { id: true, sku: true },
  })
  const productBySku = new Map(products.map((product) => [product.sku, product]))
  const missingSkus = expectedSkus.filter((sku) => !productBySku.has(sku))

  if (missingSkus.length > 0) {
    throw new Error(`Missing ACTIVE rental products for equipment unit seed: ${missingSkus.join(', ')}`)
  }

  const orderedProducts = expectedSkus.map((sku) => productBySku.get(sku)!)
  const equipmentUnits = buildEquipmentUnitSeedData(orderedProducts, inventoryLocation.id)
  const result = await prisma.equipmentUnit.createMany({
    data: equipmentUnits,
    skipDuplicates: true,
  })

  console.log(`Ensured ${equipmentUnits.length} rental equipment units; created ${result.count} missing units.`)
}
