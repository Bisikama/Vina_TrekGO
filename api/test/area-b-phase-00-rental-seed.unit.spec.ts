import { EquipmentCondition, EquipmentUnitStatus, PrismaClient } from '@prisma/client'
import {
  DEFAULT_UNITS_PER_RENTAL_PRODUCT,
  PRIMARY_RENTAL_LOCATION_CODE,
  seedEquipmentUnits,
} from '../prisma/seeds/equipment-unit.seed'
import { RENTAL_PRODUCT_SEEDS, assertGradeSeedPairs, rentalSeedImage, seedRentalProducts } from '../prisma/seeds/rental-product.seed'

describe('Local rental catalog replacement', () => {
  const originalDirectUrl = process.env.DIRECT_URL
  const originalDatabaseUrl = process.env.DATABASE_URL
  afterEach(() => {
    if (originalDirectUrl === undefined) delete process.env.DIRECT_URL; else process.env.DIRECT_URL = originalDirectUrl
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = originalDatabaseUrl
  })

  it('replaces only non-seed products locally and writes a suitable image for every seed SKU', async () => {
    process.env.DIRECT_URL = 'postgresql://localhost/test'
    const tx = { rentalProduct: { updateMany: jest.fn().mockResolvedValue({ count: 2 }), upsert: jest.fn().mockResolvedValue({}) } }
    const prisma = {
      rentalCategory: { findMany: jest.fn().mockResolvedValue([...new Set(RENTAL_PRODUCT_SEEDS.map(p => p.categorySlug))].map(slug => ({ id: slug, slug }))) },
      $transaction: jest.fn(async (callback) => callback(tx)),
    }
    await seedRentalProducts(prisma as unknown as PrismaClient)
    expect(tx.rentalProduct.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ sku: { notIn: RENTAL_PRODUCT_SEEDS.map(p => p.sku) } }),
      data: expect.objectContaining({ status: 'INACTIVE' }),
    }))
    expect(tx.rentalProduct.upsert).toHaveBeenCalledTimes(RENTAL_PRODUCT_SEEDS.length)
    for (const product of RENTAL_PRODUCT_SEEDS) expect(rentalSeedImage(product.sku)).toMatch(/^https:\/\//)
  })

  it('never deactivates the existing catalog for a non-local database', async () => {
    process.env.DIRECT_URL = 'postgresql://example.com/test'
    const tx = { rentalProduct: { updateMany: jest.fn(), upsert: jest.fn().mockResolvedValue({}) } }
    const prisma = {
      rentalCategory: { findMany: jest.fn().mockResolvedValue([...new Set(RENTAL_PRODUCT_SEEDS.map(p => p.categorySlug))].map(slug => ({ id: slug, slug }))) },
      $transaction: jest.fn(async (callback) => callback(tx)),
    }
    await seedRentalProducts(prisma as unknown as PrismaClient)
    expect(tx.rentalProduct.updateMany).not.toHaveBeenCalled()
  })
})

describe('Rental product grade seed', () => {
  const graded = RENTAL_PRODUCT_SEEDS.filter((p) => p.gradeGroupId)

  it('seeds complete LIKE_NEW / GOOD_USED pairs that satisfy the catalog grade rules', () => {
    expect(graded).toHaveLength(RENTAL_PRODUCT_SEEDS.length)
    expect(new Set(graded.map((product) => product.sku)).size).toBe(graded.length)
    expect(() => assertGradeSeedPairs()).not.toThrow()
    const groups = new Map<string, typeof graded>()
    for (const product of graded) groups.set(product.gradeGroupId!, [...(groups.get(product.gradeGroupId!) ?? []), product])
    for (const pair of groups.values()) {
      expect(pair).toHaveLength(2)
      expect(rentalSeedImage(pair[0].sku)).toBe(rentalSeedImage(pair[1].sku))
    }
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
