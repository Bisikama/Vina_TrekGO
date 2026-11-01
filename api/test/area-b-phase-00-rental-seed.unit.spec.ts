import { EquipmentCondition, EquipmentUnitStatus, PrismaClient } from '@prisma/client'
import {
  DEFAULT_UNITS_PER_RENTAL_PRODUCT,
  PRIMARY_RENTAL_LOCATION_CODE,
  seedEquipmentUnits,
} from '../prisma/seeds/equipment-unit.seed'
import { RENTAL_PRODUCT_SEEDS, assertGradeSeedPairs } from '../prisma/seeds/rental-product.seed'

describe('Rental product grade seed', () => {
  const graded = RENTAL_PRODUCT_SEEDS.filter((p) => p.gradeGroupId)

  it('seeds complete LIKE_NEW / GOOD_USED pairs that satisfy the catalog grade rules', () => {
    expect(graded.length).toBeGreaterThanOrEqual(2)
    expect(() => assertGradeSeedPairs()).not.toThrow()
  })

  it('rejects a pair where LIKE_NEW is not strictly more expensive', () => {
    const broken = graded.map((p) => (p.grade === 'GOOD_USED' ? { ...p, depositValue: 10_000_000 } : p))
    expect(() => assertGradeSeedPairs(broken)).toThrow('LIKE_NEW phải có giá ngày và cọc lớn hơn hẳn')
  })

  it('rejects a group with a missing grade or different replacement values', () => {
    const lonely = graded.filter((p) => p.grade === 'LIKE_NEW')
    expect(() => assertGradeSeedPairs(lonely)).toThrow('đúng một LIKE_NEW và một GOOD_USED')
    const drift = graded.map((p) => (p.grade === 'GOOD_USED' ? { ...p, replacementValue: p.replacementValue + 1 } : p))
    expect(() => assertGradeSeedPairs(drift)).toThrow('replacementValue hai hạng phải bằng nhau')
  })
})

describe('Rental equipment unit seed', () => {
  const locationId = '11111111-1111-4111-8111-111111111111'

  function createPrismaMock() {
    return {
      inventoryLocation: {
        findUnique: jest.fn().mockResolvedValue({ id: locationId, status: 'ACTIVE' }),
      },
      rentalProduct: {
        findMany: jest.fn().mockResolvedValue(
          RENTAL_PRODUCT_SEEDS.map((product, index) => ({
            id: `product-${index + 1}`,
            sku: product.sku,
          })),
        ),
      },
      equipmentUnit: {
        createMany: jest.fn().mockResolvedValue({
          count: RENTAL_PRODUCT_SEEDS.length * DEFAULT_UNITS_PER_RENTAL_PRODUCT,
        }),
      },
    }
  }

  it('creates deterministic AVAILABLE units at the primary location for every seeded product', async () => {
    const prisma = createPrismaMock()

    await seedEquipmentUnits(prisma as unknown as PrismaClient)

    expect(prisma.inventoryLocation.findUnique).toHaveBeenCalledWith({
      where: { code: PRIMARY_RENTAL_LOCATION_CODE },
      select: { id: true, status: true },
    })
    expect(prisma.equipmentUnit.createMany).toHaveBeenCalledTimes(1)

    const input = prisma.equipmentUnit.createMany.mock.calls[0][0]
    expect(input.skipDuplicates).toBe(true)
    expect(input.data).toHaveLength(RENTAL_PRODUCT_SEEDS.length * DEFAULT_UNITS_PER_RENTAL_PRODUCT)
    expect(input.data[0]).toEqual(
      expect.objectContaining({
        assetCode: `SEED-${RENTAL_PRODUCT_SEEDS[0].sku}-001`,
        qrCode: `TREKGO:UNIT:SEED-${RENTAL_PRODUCT_SEEDS[0].sku}-001`,
        homeInventoryLocationId: locationId,
        currentInventoryLocationId: locationId,
        status: EquipmentUnitStatus.AVAILABLE,
        condition: EquipmentCondition.GOOD,
      }),
    )
  })

  it('fails before inserting units when an expected ACTIVE product is missing', async () => {
    const prisma = createPrismaMock()
    prisma.rentalProduct.findMany.mockResolvedValueOnce([])

    await expect(seedEquipmentUnits(prisma as unknown as PrismaClient)).rejects.toThrow(
      'Missing ACTIVE rental products for equipment unit seed',
    )
    expect(prisma.equipmentUnit.createMany).not.toHaveBeenCalled()
  })
})
