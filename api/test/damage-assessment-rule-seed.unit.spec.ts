import { DamageDeductionType, DamageSeverity, PrismaClient } from '@prisma/client'
import {
  buildDamageAssessmentRuleSeedData,
  buildDeterministicRuleId,
  PRIMARY_GPS_DAMAGE_RULES,
  PRIMARY_TENT_DAMAGE_RULES,
  seedDamageAssessmentRules,
  USAGE_GROUP_DAMAGE_RULES,
} from '../prisma/seeds/damage-assessment-rule.seed'
import { RENTAL_PRODUCT_SEEDS } from '../prisma/seeds/rental-product.seed'

describe('Damage assessment rule seed', () => {
  const mockProducts = RENTAL_PRODUCT_SEEDS.map((product, index) => ({
    id: `00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
    sku: product.sku,
    usageGroup: product.usageGroup,
  }))

  function createPrismaMock() {
    return {
      rentalProduct: {
        findMany: jest.fn().mockResolvedValue(mockProducts),
      },
      damageAssessmentRule: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({ id: 'rule-id' }),
      },
    }
  }

  describe('buildDamageAssessmentRuleSeedData & constraint compliance', () => {
    it('generates rules for every seeded product adhering to Postgres CHECK constraints', () => {
      const rules = buildDamageAssessmentRuleSeedData(mockProducts)

      expect(rules.length).toBeGreaterThan(0)
      expect(rules.length).toBe(
        mockProducts.reduce(
          (acc, p) => acc + (USAGE_GROUP_DAMAGE_RULES[p.usageGroup]?.length ?? 4),
          0,
        ),
      )

      for (const rule of rules) {
        // ck_damage_assessment_rules_deduction_value_nonnegative
        expect(rule.deductionValue).toBeGreaterThanOrEqual(0)

        // ck_damage_assessment_rules_percentage_range
        if (
          rule.deductionType === DamageDeductionType.PERCENT_DEPOSIT ||
          rule.deductionType === DamageDeductionType.PERCENT_REPLACEMENT_VALUE
        ) {
          expect(rule.deductionValue).toBeGreaterThanOrEqual(0)
          expect(rule.deductionValue).toBeLessThanOrEqual(100)
        }

        // ck_damage_assessment_rules_version_positive
        expect(rule.versionNo).toBeGreaterThan(0)

        // ck_damage_assessment_rules_effective_window
        if (rule.effectiveTo !== null) {
          expect(rule.effectiveTo.getTime()).toBeGreaterThan(rule.effectiveFrom.getTime())
        }

        expect(rule.isActive).toBe(true)
        expect(rule.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
      }
    })

    it('matches deterministic UUIDs for primary tent and GPS test items', () => {
      const tentRules = buildDamageAssessmentRuleSeedData([mockProducts[0]])
      expect(tentRules[0].id).toBe(PRIMARY_TENT_DAMAGE_RULES.DIRT_STAIN)
      expect(tentRules[1].id).toBe(PRIMARY_TENT_DAMAGE_RULES.POLE_BENT)
      expect(tentRules[2].id).toBe(PRIMARY_TENT_DAMAGE_RULES.FABRIC_BURN)
      expect(tentRules[3].id).toBe(PRIMARY_TENT_DAMAGE_RULES.TOTAL_LOSS)

      const gpsIndex = mockProducts.findIndex((p) => p.sku === 'GPS-001')
      expect(gpsIndex).toBeGreaterThan(-1)

      const gpsRuleId = buildDeterministicRuleId(gpsIndex + 1, 1)
      expect(gpsRuleId).toBe(PRIMARY_GPS_DAMAGE_RULES.SCRATCH_CASING)
    })
  })

  describe('seedDamageAssessmentRules database interaction', () => {
    it('upserts all rules into database successfully', async () => {
      const prisma = createPrismaMock()

      await seedDamageAssessmentRules(prisma as unknown as PrismaClient)

      expect(prisma.rentalProduct.findMany).toHaveBeenCalledWith({
        where: {
          status: 'ACTIVE',
        },
        select: { id: true, sku: true, usageGroup: true },
        orderBy: { sku: 'asc' },
      })

      const expectedCount = mockProducts.reduce(
        (acc, p) => acc + (USAGE_GROUP_DAMAGE_RULES[p.usageGroup]?.length ?? 4),
        0,
      )
      expect(prisma.damageAssessmentRule.upsert).toHaveBeenCalledTimes(expectedCount)

      // First upsert call verify
      const firstCall = prisma.damageAssessmentRule.upsert.mock.calls[0][0]
      expect(firstCall.where.productId_ruleCode_versionNo).toBeDefined()
      expect(firstCall.create.id).toBe(PRIMARY_TENT_DAMAGE_RULES.DIRT_STAIN)
      expect(firstCall.create.severity).toBe(DamageSeverity.MINOR)
    })

    it('throws error when active rental products are missing in database', async () => {
      const prisma = createPrismaMock()
      prisma.rentalProduct.findMany.mockResolvedValueOnce([])

      await expect(
        seedDamageAssessmentRules(prisma as unknown as PrismaClient),
      ).rejects.toThrow('Missing ACTIVE rental products for damage assessment rules seed')

      expect(prisma.damageAssessmentRule.upsert).not.toHaveBeenCalled()
    })
  })
})

