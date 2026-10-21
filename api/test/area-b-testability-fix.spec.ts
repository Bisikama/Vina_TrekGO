import { DamageDeductionType, DamageSeverity, PrismaClient, RentalOrderExceptionStatus, RentalOrderStatus } from '@prisma/client'
import { UserRole } from 'src/shared/constants/enum.constant'
import { AppError, RENTAL_ERROR_CODES } from 'src/shared/errors'
import { RENTAL_ORDERING_ERROR_CODES } from 'src/shared/errors/codes/rental-ordering.error-codes'
import { RentalPolicyAdminService } from 'src/modules/rental/catalog/application/services/rental-policy-admin.service'
import { StaffDamageAssessmentRuleController } from 'src/modules/rental/returns/presentation/controllers/staff-damage-assessment-rule.controller'
import { StaffRentalProductController } from 'src/modules/rental/catalog/presentation/controllers/staff-rental-product.controller'
import { GetRentalProductUseCase } from 'src/modules/rental/catalog/application/use-cases/get-rental-product.use-case'
import { AdminRentalOrderController } from 'src/modules/rental/ordering/presentation/controllers/admin-rental-order.controller'
import {
  buildDamageAssessmentRuleSeedData,
  seedDamageAssessmentRules,
} from '../prisma/seeds/damage-assessment-rule.seed'
import { RENTAL_PRODUCT_SEEDS } from '../prisma/seeds/rental-product.seed'

describe('AREA_B_TESTABILITY_FIX: Damage Rules, Staff Product Details & Admin Orders', () => {
  const dummyProductId = 'aaaaaa11-1111-1111-1111-111111111111'
  const dummyProductId2 = 'bbbbbb22-2222-2222-2222-222222222222'
  const dummyOrderId = '550e8400-e29b-41d4-a716-446655440103'

  describe('Part 1C: GET /api/v1/admin/rental-policy contains damageRules section', () => {
    it('returns rental policy augmented with damageRules array from database', async () => {
      const mockPolicy = {
        id: 'policy-1',
        policyCode: 'DEFAULT',
        versionNo: 1,
        dayCountMode: 'CEIL_24H',
        cutoffHoursBeforeTrip: 24,
        freeCancellationHours: 24,
        quoteTtlMinutes: 10,
        paymentHoldMinutes: 15,
        pickupCodeTtlMinutes: 15,
        pickupVerificationTtlMinutes: 10,
        prepBufferMinutes: 0,
        returnBufferMinutes: 1440,
        cleaningBufferMinutes: 1440,
        deepInspectionBufferMinutes: 2880,
        returnInspectionSlaHours: 72,
        deepInspectionSlaHours: 24,
        returnToInventoryAllowanceHours: 8,
        postInspectionCleaningAllowanceHours: 8,
        currency: 'VND',
        effectiveFrom: new Date('2024-01-01T00:00:00Z'),
        effectiveTo: null,
        isActive: true,
        createdBy: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
      }

      const mockRules = [
        {
          id: 'rule-1',
          ruleCode: 'SHELTER_DIRT_STAIN',
          productId: dummyProductId,
          severity: DamageSeverity.MINOR,
          deductionType: DamageDeductionType.FIXED,
          deductionValue: 50000,
          description: 'Vết bẩn bùn đất',
        },
        {
          id: 'rule-2',
          ruleCode: 'SHELTER_TOTAL_LOSS',
          productId: dummyProductId,
          severity: DamageSeverity.TOTAL_LOSS,
          deductionType: DamageDeductionType.PERCENT_DEPOSIT,
          deductionValue: 100,
          description: 'Mất lều',
        },
      ]

      const prismaMock = {
        rentalPolicy: {
          findMany: jest.fn().mockResolvedValue([mockPolicy]),
        },
        damageAssessmentRule: {
          findMany: jest.fn().mockResolvedValue(mockRules),
        },
      }

      const service = new RentalPolicyAdminService(prismaMock as any)
      const result = await service.getCurrent(new Date('2026-10-21T00:00:00Z'))

      expect(result).toHaveProperty('damageRules')
      expect(result.damageRules).toHaveLength(2)
      expect(result.damageRules[0]).toEqual({
        id: 'rule-1',
        ruleCode: 'SHELTER_DIRT_STAIN',
        productId: dummyProductId,
        severity: DamageSeverity.MINOR,
        formulaType: DamageDeductionType.FIXED,
        value: 50000,
        description: 'Vết bẩn bùn đất',
      })
      expect(result.damageRules[1]).toEqual({
        id: 'rule-2',
        ruleCode: 'SHELTER_TOTAL_LOSS',
        productId: dummyProductId,
        severity: DamageSeverity.TOTAL_LOSS,
        formulaType: DamageDeductionType.PERCENT_DEPOSIT,
        value: 100,
        description: 'Mất lều',
      })
    })
  })

  describe('Part 1C: GET /api/v1/staff/damage-assessment-rules', () => {
    it('returns all active damage rules when no productId query is passed', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          ruleCode: 'R1',
          productId: dummyProductId,
          name: 'Rule 1',
          description: 'Desc 1',
          severity: DamageSeverity.MINOR,
          deductionType: DamageDeductionType.FIXED,
          deductionValue: 50000,
          requiresApproval: false,
          versionNo: 1,
          isActive: true,
        },
        {
          id: 'rule-2',
          ruleCode: 'R2',
          productId: dummyProductId2,
          name: 'Rule 2',
          description: 'Desc 2',
          severity: DamageSeverity.SEVERE,
          deductionType: DamageDeductionType.PERCENT_DEPOSIT,
          deductionValue: 40,
          requiresApproval: true,
          versionNo: 1,
          isActive: true,
        },
      ]

      const prismaMock = {
        damageAssessmentRule: {
          findMany: jest.fn().mockResolvedValue(mockRules),
        },
      }

      const controller = new StaffDamageAssessmentRuleController(prismaMock as any)
      const res = await controller.listRules()

      expect(prismaMock.damageAssessmentRule.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: [{ severity: 'asc' }, { ruleCode: 'asc' }],
      })
      expect(res.items).toHaveLength(2)
      expect(res.items[0].formulaType).toBe(DamageDeductionType.FIXED)
    })

    it('filters damage rules strictly by productId when query parameter is supplied', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          ruleCode: 'R1',
          productId: dummyProductId,
          name: 'Rule 1',
          description: 'Desc 1',
          severity: DamageSeverity.MINOR,
          deductionType: DamageDeductionType.FIXED,
          deductionValue: 50000,
          requiresApproval: false,
          versionNo: 1,
          isActive: true,
        },
      ]

      const prismaMock = {
        damageAssessmentRule: {
          findMany: jest.fn().mockResolvedValue(mockRules),
        },
      }

      const controller = new StaffDamageAssessmentRuleController(prismaMock as any)
      const res = await controller.listRules(dummyProductId)

      expect(prismaMock.damageAssessmentRule.findMany).toHaveBeenCalledWith({
        where: { isActive: true, productId: dummyProductId },
        orderBy: [{ severity: 'asc' }, { ruleCode: 'asc' }],
      })
      expect(res.items).toHaveLength(1)
      expect(res.items[0].productId).toBe(dummyProductId)
    })
  })

  describe('Part 2: GET /api/v1/staff/rental-products/:id', () => {
    const inactiveProduct = {
      id: dummyProductId,
      sku: 'TENT-INACTIVE',
      name: 'Lều bảo trì',
      status: 'INACTIVE',
      version: 1,
      category: { id: 'cat-1', name: 'Lều', status: 'ACTIVE' },
      dailyPrice: 100000,
      depositPolicy: { type: 'FIXED', value: 500000 },
      currency: 'VND',
      replacementValue: 2000000,
    }

    it('allows STAFF_INVENTORY to view INACTIVE product details', async () => {
      const mockPort = {
        getProductById: jest.fn().mockResolvedValue(inactiveProduct),
      }
      const useCase = new GetRentalProductUseCase(mockPort as any)
      const controller = new StaffRentalProductController(
        {} as any,
        useCase,
        {} as any,
        {} as any,
        {} as any,
      )

      const result = await controller.getProduct(dummyProductId, {
        id: 'staff-1',
        role: UserRole.STAFF_INVENTORY,
      } as any)

      expect(result).toBeDefined()
      expect(result.id).toBe(dummyProductId)
      expect(result.status).toBe('INACTIVE')
    })

    it('blocks regular USER from viewing INACTIVE product with 404 RENTAL_PRODUCT_NOT_FOUND', async () => {
      const mockPort = {
        getProductById: jest.fn().mockResolvedValue(inactiveProduct),
      }
      const useCase = new GetRentalProductUseCase(mockPort as any)

      await expect(
        useCase.execute(dummyProductId, UserRole.USER),
      ).rejects.toMatchObject({
        code: RENTAL_ERROR_CODES.RENTAL_PRODUCT_NOT_FOUND,
      })
    })

    it('throws 404 RENTAL_PRODUCT_NOT_FOUND when product does not exist in DB', async () => {
      const mockPort = {
        getProductById: jest.fn().mockResolvedValue(null),
      }
      const useCase = new GetRentalProductUseCase(mockPort as any)
      const controller = new StaffRentalProductController(
        {} as any,
        useCase,
        {} as any,
        {} as any,
        {} as any,
      )

      await expect(
        controller.getProduct('non-existent-uuid', {
          id: 'staff-1',
          role: UserRole.STAFF_INVENTORY,
        } as any),
      ).rejects.toMatchObject({
        code: RENTAL_ERROR_CODES.RENTAL_PRODUCT_NOT_FOUND,
      })
    })
  })

  describe('Part 3: Admin Rental Orders (Team Extension)', () => {
    const mockOrderRow = {
      id: dummyOrderId,
      quoteId: 'quote-1',
      userId: 'user-1',
      tripId: 'trip-1',
      bookingId: 'booking-1',
      status: RentalOrderStatus.ACTIVE,
      financialStatus: 'PAID',
      exceptionStatus: RentalOrderExceptionStatus.OVERDUE,
      rentalFee: 150000,
      totalDeposit: 500000,
      totalAmount: 650000,
      currency: 'VND',
      rentalStartAt: new Date('2026-10-01T00:00:00Z'),
      rentalEndAt: new Date('2026-10-05T00:00:00Z'),
      paymentExpiresAt: new Date('2026-10-01T01:00:00Z'),
      paidAt: new Date('2026-10-01T00:30:00Z'),
      cancelledAt: null,
      completedAt: null,
      version: 2,
      createdAt: new Date('2026-10-01T00:00:00Z'),
      updatedAt: new Date('2026-10-01T00:30:00Z'),
      rentalOrderLinesViaOrderId: [{ id: 'line-1' }],
    }

    it('filters orders by exceptionStatus (OVERDUE) and returns items with pagination', async () => {
      const prismaMock = {
        rentalOrder: {
          count: jest.fn().mockResolvedValue(1),
          findMany: jest.fn().mockResolvedValue([mockOrderRow]),
        },
      }

      const controller = new AdminRentalOrderController(prismaMock as any)
      const res = await controller.listOrders({
        exceptionStatus: RentalOrderExceptionStatus.OVERDUE,
        page: 1,
        pageSize: 20,
      })

      expect(prismaMock.rentalOrder.count).toHaveBeenCalledWith({
        where: { exceptionStatus: RentalOrderExceptionStatus.OVERDUE },
      })
      expect(prismaMock.rentalOrder.findMany).toHaveBeenCalledWith({
        where: { exceptionStatus: RentalOrderExceptionStatus.OVERDUE },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
        include: { rentalOrderLinesViaOrderId: { select: { id: true } } },
      })

      expect(res.items).toHaveLength(1)
      expect(res.items[0].exceptionStatus).toBe(RentalOrderExceptionStatus.OVERDUE)
      expect(res.pagination.totalItems).toBe(1)
      expect(res.pagination.page).toBe(1)
    })

    it('returns full order + packages + tasks + financialSummary on GET /:orderId', async () => {
      const fullOrder = {
        ...mockOrderRow,
        user: { id: 'user-1', email: 'test@example.com', fullName: 'Tester', phone: '0901234567' },
        pickupPoint: { id: 'pp-1', name: 'Điểm lấy đồ', address: '123 Đ. ABC' },
        returnPoint: { id: 'rp-1', name: 'Điểm trả đồ', address: '123 Đ. ABC' },
        rentalPolicy: { id: 'pol-1', policyCode: 'DEFAULT', versionNo: 1 },
        rentalOrderLinesViaOrderId: [
          {
            id: 'line-1',
            productId: dummyProductId,
            product: { id: dummyProductId, sku: 'TENT-001', name: 'Lều 4 người', usageGroup: 'SHELTER', dailyPrice: 120000, replacementValue: 2500000 },
            quantity: 1,
            dailyPriceSnapshot: 120000,
            depositPerUnitSnapshot: 750000,
            replacementValueSnapshot: 2500000,
            lineRentalFee: 120000,
            lineDeposit: 750000,
            rentalQuantityReservationsViaOrderLineId: [],
            rentalUnitAssignmentsViaOrderLineId: [],
          },
        ],
        packageViaOrderId: {
          id: 'pkg-1',
          packageCode: 'PKG-001',
          status: 'SEALED',
          sealedAt: new Date('2026-10-01T02:00:00Z'),
          packageItemsViaPackageId: [],
        },
        inventoryTaskViaOrderId: {
          id: 'it-1',
          inventoryLocationId: 'loc-1',
          status: 'COMPLETED',
          staffId: 'staff-1',
          deadline: null,
          startedAt: null,
          completedAt: null,
        },
        deliveryTasksViaOrderId: [],
        rentalHandoverViaOrderId: null,
        returnInspectionsViaOrderId: [],
        depositSettlementViaOrderId: null,
        invoicesViaRentalOrderId: [],
        refundsViaRentalOrderId: [],
      }

      const prismaMock = {
        rentalOrder: {
          findUnique: jest.fn().mockResolvedValue(fullOrder),
        },
      }

      const controller = new AdminRentalOrderController(prismaMock as any)
      const res = await controller.getOrderDetail({ orderId: dummyOrderId })

      expect(res).toHaveProperty('order')
      expect(res).toHaveProperty('packages')
      expect(res).toHaveProperty('tasks')
      expect(res).toHaveProperty('financialSummary')
      expect(res.order.id).toBe(dummyOrderId)
      expect(res.packages?.packageCode).toBe('PKG-001')
      expect(res.tasks.inventoryTask?.id).toBe('it-1')
    })

    it('throws 404 RENTAL_ORDER_NOT_FOUND when order does not exist', async () => {
      const prismaMock = {
        rentalOrder: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      }

      const controller = new AdminRentalOrderController(prismaMock as any)
      await expect(
        controller.getOrderDetail({ orderId: 'non-existent-order-id' }),
      ).rejects.toMatchObject({
        code: RENTAL_ORDERING_ERROR_CODES.RENTAL_ORDER_NOT_FOUND,
      })
    })
  })

  describe('Part 1B: Seed Idempotency verification', () => {
    it('running seedDamageAssessmentRules twice maintains idempotent record counts without duplicating', async () => {
      const mockProducts = RENTAL_PRODUCT_SEEDS.map((product, index) => ({
        id: `00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
        sku: product.sku,
        usageGroup: product.usageGroup,
      }))

      const existingStore = new Map<string, any>()

      const prismaMock = {
        rentalProduct: {
          findMany: jest.fn().mockResolvedValue(mockProducts),
        },
        damageAssessmentRule: {
          findUnique: jest.fn(async ({ where }) => {
            const key = `${where.productId_ruleCode_versionNo.productId}:${where.productId_ruleCode_versionNo.ruleCode}:${where.productId_ruleCode_versionNo.versionNo}`
            return existingStore.get(key) ?? null
          }),
          upsert: jest.fn(async ({ where, create, update }) => {
            const key = `${where.productId_ruleCode_versionNo.productId}:${where.productId_ruleCode_versionNo.ruleCode}:${where.productId_ruleCode_versionNo.versionNo}`
            const existing = existingStore.get(key)
            if (existing) {
              const updated = { ...existing, ...update }
              existingStore.set(key, updated)
              return updated
            } else {
              const created = { ...create }
              existingStore.set(key, created)
              return created
            }
          }),
        },
      }

      // Run 1st time
      await seedDamageAssessmentRules(prismaMock as unknown as PrismaClient)
      const countAfterFirstRun = existingStore.size
      expect(countAfterFirstRun).toBe(mockProducts.length * 4) // 28 * 4 = 112

      // Run 2nd time
      await seedDamageAssessmentRules(prismaMock as unknown as PrismaClient)
      const countAfterSecondRun = existingStore.size
      expect(countAfterSecondRun).toBe(countAfterFirstRun)
    })
  })
})

