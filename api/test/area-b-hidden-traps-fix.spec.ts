jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => {},
  Interval: () => () => {},
  Timeout: () => () => {},
  SchedulerRegistry: jest.fn(),
}))

import { BadRequestException, ExecutionContext, ParseUUIDPipe } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { DamageDeductionType, DamageSeverity, Prisma } from '@prisma/client'
import { AuthType, REQUEST_USER_KEY } from 'src/shared/constants/auth.constant'
import { UserRole } from 'src/shared/constants/enum.constant'
import { AppError, RENTAL_ERROR_CODES } from 'src/shared/errors'
import { AuthenticationGuard } from 'src/shared/guards/authentication.guard'
import { RentalProductController } from 'src/modules/rental/catalog/presentation/controllers/rental-product.controller'
import { GetRentalProductUseCase } from 'src/modules/rental/catalog/application/use-cases/get-rental-product.use-case'
import { CreateRentalProductUseCase } from 'src/modules/rental/catalog/application/use-cases/create-rental-product.use-case'
import { UpdateRentalProductUseCase } from 'src/modules/rental/catalog/application/use-cases/update-rental-product.use-case'
import { CreateRentalProductSchema } from 'src/modules/rental/catalog/presentation/dtos/create-rental-product.dto'
import { UpdateRentalProductSchema } from 'src/modules/rental/catalog/presentation/dtos/update-rental-product.dto'
import { PrismaRentalProductAdapter } from 'src/modules/rental/catalog/infrastructure/adapters/prisma-rental-product.adapter'
import { RentalOrderController } from 'src/modules/rental/ordering/presentation/controllers/rental-order.controller'
import { StaffRentalProductController } from 'src/modules/rental/catalog/presentation/controllers/staff-rental-product.controller'
import { InternalRentalEvidenceAccessController } from 'src/modules/rental/returns/presentation/controllers/internal-rental-evidence-access.controller'
import { RentalPaymentsController } from 'src/modules/rental/payments/rental-payments.controller'
import { USAGE_GROUP_DAMAGE_RULES } from '../prisma/seeds/damage-assessment-rule.seed'
import type { RentalProductPort, RentalProductView } from 'src/modules/rental/catalog/application/ports/rental-product.port'

describe('AREA_B_HIDDEN_TRAPS_FIX: Verification Suite (Mục 0 - 7)', () => {
  const dummyActiveProductId = '11111111-1111-4111-8111-111111111111'
  const dummyInactiveProductId = '22222222-2222-4222-8222-222222222222'
  const dummyCategoryId = '550e8400-e29b-41d4-a716-446655440010'

  // =========================================================================
  // MỤC 0: Verification of Seed Damage Rules for NAVIGATION and SURVIVAL
  // =========================================================================
  describe('MỤC 0: Damage Rules TOTAL_LOSS aligned to PERCENT_DEPOSIT 100%', () => {
    it('uses PERCENT_DEPOSIT 100% for NAVIGATION TOTAL_LOSS rule', () => {
      const navRules = USAGE_GROUP_DAMAGE_RULES['NAVIGATION']
      const totalLossRule = navRules.find((r) => r.severity === DamageSeverity.TOTAL_LOSS)
      expect(totalLossRule).toBeDefined()
      expect(totalLossRule?.ruleCode).toBe('NAV_TOTAL_LOSS')
      expect(totalLossRule?.deductionType).toBe(DamageDeductionType.PERCENT_DEPOSIT)
      expect(totalLossRule?.deductionValue).toBe(100)
      expect(totalLossRule?.description).not.toContain('giá trị thay thế')
      expect(totalLossRule?.description).toContain('100% cọc')
    })

    it('uses PERCENT_DEPOSIT 100% for SURVIVAL TOTAL_LOSS rule', () => {
      const survivalRules = USAGE_GROUP_DAMAGE_RULES['SURVIVAL']
      const totalLossRule = survivalRules.find((r) => r.severity === DamageSeverity.TOTAL_LOSS)
      expect(totalLossRule).toBeDefined()
      expect(totalLossRule?.ruleCode).toBe('SURVIVAL_TOTAL_LOSS')
      expect(totalLossRule?.deductionType).toBe(DamageDeductionType.PERCENT_DEPOSIT)
      expect(totalLossRule?.deductionValue).toBe(100)
      expect(totalLossRule?.description).not.toContain('giá trị thay thế')
      expect(totalLossRule?.description).toContain('100% cọc')
    })

    it('ensures no usage group uses PERCENT_REPLACEMENT_VALUE for TOTAL_LOSS', () => {
      for (const [group, rules] of Object.entries(USAGE_GROUP_DAMAGE_RULES)) {
        const totalLoss = rules.find((r) => r.severity === DamageSeverity.TOTAL_LOSS)
        expect(totalLoss?.deductionType).toBe(DamageDeductionType.PERCENT_DEPOSIT)
      }
    })
  })

  // =========================================================================
  // MỤC 1: GET /api/v1/rental-products/:id (Public route with optional auth & UUID validation)
  // =========================================================================
  describe('MỤC 1: GET /api/v1/rental-products/:id role authorization & UUID validation', () => {
    const activeProduct: RentalProductView = {
      id: dummyActiveProductId,
      sku: 'TENT-ACT',
      name: 'Lều Active',
      category: { id: dummyCategoryId, name: 'Lều', status: 'ACTIVE' },
      description: 'Mô tả',
      dailyPrice: 100000,
      depositPolicy: { type: 'FIXED', amount: 500000 },
      currency: 'VND',
      replacementValue: 1500000,
      status: 'ACTIVE',
      version: 1,
      imageMediaIds: [],
      spec: {},
      recommendationTags: [],
      requiresDeepInspectionAfterReturn: false,
    }

    const inactiveProduct: RentalProductView = {
      ...activeProduct,
      id: dummyInactiveProductId,
      sku: 'TENT-INACT',
      name: 'Lều Inactive',
      status: 'INACTIVE',
    }

    let mockPort: jest.Mocked<RentalProductPort>
    let useCase: GetRentalProductUseCase
    let controller: RentalProductController

    beforeEach(() => {
      mockPort = {
        listActiveProducts: jest.fn(),
        getProductById: jest.fn().mockImplementation(async (id: string) => {
          if (id === dummyActiveProductId) return activeProduct
          if (id === dummyInactiveProductId) return inactiveProduct
          return null
        }),
        listStaffProducts: jest.fn(),
        changeStatus: jest.fn(),
        createProduct: jest.fn(),
        updateProduct: jest.fn(),
      }
      useCase = new GetRentalProductUseCase(mockPort)
      controller = new RentalProductController({} as any, useCase)
    })

    // Case (a): Anonymous user views ACTIVE product -> 200 OK
    it('Case (a): anonymous caller views ACTIVE product -> 200 OK', async () => {
      const result = await controller.getProduct(dummyActiveProductId, undefined)
      expect(result).toBeDefined()
      expect(result.id).toBe(dummyActiveProductId)
      expect(result.status).toBe('ACTIVE')
    })

    // Case (b): Anonymous user views INACTIVE product -> 404 RENTAL_PRODUCT_NOT_FOUND
    it('Case (b): anonymous caller views INACTIVE product -> 404 RENTAL_PRODUCT_NOT_FOUND', async () => {
      await expect(controller.getProduct(dummyInactiveProductId, undefined)).rejects.toThrow(
        expect.objectContaining({
          code: RENTAL_ERROR_CODES.RENTAL_PRODUCT_NOT_FOUND,
        }),
      )
    })

    // Case (c): Token STAFF_INVENTORY views INACTIVE product via public route -> 200 OK
    it('Case (c): STAFF_INVENTORY caller views INACTIVE product via public route -> 200 OK', async () => {
      const staffUser = { id: 'staff-uuid', role: UserRole.STAFF_INVENTORY, authUserId: 'auth-1' } as any
      const result = await controller.getProduct(dummyInactiveProductId, staffUser)
      expect(result).toBeDefined()
      expect(result.id).toBe(dummyInactiveProductId)
      expect(result.status).toBe('INACTIVE')
    })

    // Case (c-extra): Regular USER caller views INACTIVE product -> 404 RENTAL_PRODUCT_NOT_FOUND
    it('Case (c-extra): regular USER caller views INACTIVE product -> 404 RENTAL_PRODUCT_NOT_FOUND', async () => {
      const normalUser = { id: 'user-uuid', role: UserRole.USER, authUserId: 'auth-2' } as any
      await expect(controller.getProduct(dummyInactiveProductId, normalUser)).rejects.toThrow(
        expect.objectContaining({
          code: RENTAL_ERROR_CODES.RENTAL_PRODUCT_NOT_FOUND,
        }),
      )
    })

    // Case (d): Non-UUID parameter (e.g. "abc") -> ParseUUIDPipe throws 400 BadRequestException
    it('Case (d): non-UUID parameter "abc" throws 400 BadRequestException via ParseUUIDPipe', async () => {
      const pipe = new ParseUUIDPipe({ errorHttpStatusCode: 400 })
      await expect(pipe.transform('abc', { type: 'param', metatype: String, data: 'id' })).rejects.toThrow(
        BadRequestException,
      )
    })

    // AuthenticationGuard with AuthType.Optional verification
    it('AuthenticationGuard with AuthType.Optional passes anonymous caller and populates token caller', async () => {
      const reflector = new Reflector()
      const mockAccessTokenGuard = {
        canActivate: jest.fn().mockImplementation((ctx: ExecutionContext) => {
          const req = ctx.switchToHttp().getRequest()
          req[REQUEST_USER_KEY] = { id: 'staff-1', role: UserRole.STAFF_INVENTORY }
          return true
        }),
      } as any
      const mockApiKeyGuard = { canActivate: jest.fn() } as any

      const guard = new AuthenticationGuard(reflector, mockAccessTokenGuard, mockApiKeyGuard)

      // Test with Optional auth metadata
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
        authTypes: [AuthType.Optional],
        options: { condition: 'And' },
      })

      // 1. Anonymous request (no Authorization header)
      const anonymousRequest = { headers: {} }
      const anonymousContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({ getRequest: () => anonymousRequest }),
      } as any

      const anonResult = await guard.canActivate(anonymousContext)
      expect(anonResult).toBe(true)
      expect(anonymousRequest[REQUEST_USER_KEY]).toBeUndefined()
      expect(mockAccessTokenGuard.canActivate).not.toHaveBeenCalled()

      // 2. Authenticated request (Bearer token present)
      const authRequest = { headers: { authorization: 'Bearer valid.staff.jwt' } }
      const authContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({ getRequest: () => authRequest }),
      } as any

      const authResult = await guard.canActivate(authContext)
      expect(authResult).toBe(true)
      expect(mockAccessTokenGuard.canActivate).toHaveBeenCalledWith(authContext)
      expect(authRequest[REQUEST_USER_KEY]).toEqual({ id: 'staff-1', role: UserRole.STAFF_INVENTORY })
    })
  })

  // =========================================================================
  // MỤC 2: requiresDeepInspectionAfterReturn in DTOs, Port & Adapter
  // =========================================================================
  describe('MỤC 2: requiresDeepInspectionAfterReturn in Create/Update Product', () => {
    // Adapter ghi trong transaction (khoá dòng, lấy giờ DB, ghi lịch sử giá): bổ sung các phần đó cho mock tối giản.
    const withTxSupport = (mock: any) => {
      mock.$transaction = jest.fn((cb: (tx: unknown) => unknown) => cb(mock))
      mock.$queryRaw = jest.fn((strings: TemplateStringsArray) =>
        Promise.resolve(
          strings.join('?').includes('clock_timestamp')
            ? [{ now: new Date('2026-10-30T00:00:00Z') }]
            : [{ grade_group_id: null }],
        ),
      )
      mock.rentalProductPriceHistory = {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
      }
      return mock
    }
    const admin = { actorUserId: 'admin-1', actorRole: 'ADMIN' }

    it('CreateRentalProductSchema accepts and validates requiresDeepInspectionAfterReturn', () => {
      const validWithDeep = CreateRentalProductSchema.parse({
        categoryId: dummyCategoryId,
        sku: 'TEST-DEEP-01',
        name: 'Bếp dã ngoại cần kiểm tra kỹ',
        dailyPrice: 100000,
        currency: 'VND',
        replacementValue: 1500000,
        depositPolicy: { type: 'FIXED', amount: 500000 },
        requiresDeepInspectionAfterReturn: true,
      })
      expect(validWithDeep.requiresDeepInspectionAfterReturn).toBe(true)

      const validWithoutDeep = CreateRentalProductSchema.parse({
        categoryId: dummyCategoryId,
        sku: 'TEST-DEEP-02',
        name: 'Đèn pin thường',
        dailyPrice: 50000,
        currency: 'VND',
        replacementValue: 300000,
        depositPolicy: { type: 'FIXED', amount: 100000 },
      })
      expect(validWithoutDeep.requiresDeepInspectionAfterReturn).toBeUndefined()
    })

    it('UpdateRentalProductSchema accepts and validates requiresDeepInspectionAfterReturn', () => {
      const updateData = UpdateRentalProductSchema.parse({
        expectedVersion: 1,
        requiresDeepInspectionAfterReturn: true,
      })
      expect(updateData.requiresDeepInspectionAfterReturn).toBe(true)
    })

    it('PrismaRentalProductAdapter creates product with requiresDeepInspectionAfterReturn = true', async () => {
      let createdData: any = null
      const mockPrisma = {
        rentalProduct: {
          create: jest.fn().mockImplementation(({ data }) => {
            createdData = data
            return {
              id: 'new-prod-id',
              ...data,
              dailyPrice: { toNumber: () => data.dailyPrice },
              replacementValue: { toNumber: () => data.replacementValue },
              depositValue: { toNumber: () => data.depositValue },
              category: { id: data.categoryId, name: 'Lều', status: 'ACTIVE' },
              images: [],
              specifications: data.specifications ?? {},
              recommendationTags: data.recommendationTags ?? [],
              requiresDeepReturnInspection: data.requiresDeepReturnInspection,
            }
          }),
        },
        mediaAsset: { findMany: jest.fn().mockResolvedValue([]) },
      } as any

      const adapter = new PrismaRentalProductAdapter(withTxSupport(mockPrisma))
      const result = await adapter.createProduct({
        ...admin,
        categoryId: dummyCategoryId,
        sku: 'TEST-DEEP-TRUE',
        name: 'Sản phẩm kiểm tra sâu',
        dailyPrice: 120000,
        currency: 'VND',
        replacementValue: 2000000,
        depositPolicy: { type: 'FIXED', amount: 600000 },
        requiresDeepInspectionAfterReturn: true,
      })

      expect(createdData.requiresDeepReturnInspection).toBe(true)
      expect(result.requiresDeepInspectionAfterReturn).toBe(true)
    })

    it('PrismaRentalProductAdapter defaults requiresDeepReturnInspection to false when not passed', async () => {
      let createdData: any = null
      const mockPrisma = {
        rentalProduct: {
          create: jest.fn().mockImplementation(({ data }) => {
            createdData = data
            return {
              id: 'new-prod-id-2',
              ...data,
              dailyPrice: { toNumber: () => data.dailyPrice },
              replacementValue: { toNumber: () => data.replacementValue },
              depositValue: { toNumber: () => data.depositValue },
              category: { id: data.categoryId, name: 'Lều', status: 'ACTIVE' },
              images: [],
              specifications: data.specifications ?? {},
              recommendationTags: data.recommendationTags ?? [],
              requiresDeepReturnInspection: data.requiresDeepReturnInspection,
            }
          }),
        },
        mediaAsset: { findMany: jest.fn().mockResolvedValue([]) },
      } as any

      const adapter = new PrismaRentalProductAdapter(withTxSupport(mockPrisma))
      const result = await adapter.createProduct({
        ...admin,
        categoryId: dummyCategoryId,
        sku: 'TEST-DEEP-FALSE',
        name: 'Sản phẩm không kiểm tra sâu',
        dailyPrice: 80000,
        currency: 'VND',
        replacementValue: 1000000,
        depositPolicy: { type: 'FIXED', amount: 300000 },
      })

      expect(createdData.requiresDeepReturnInspection).toBe(false)
      expect(result.requiresDeepInspectionAfterReturn).toBe(false)
    })

    it('PrismaRentalProductAdapter updates requiresDeepReturnInspection on updateProduct', async () => {
      let updatePayload: any = null
      const productRow = {
        id: dummyActiveProductId,
        sku: 'TEST-DEEP-UPD',
        name: 'Sản phẩm cập nhật',
        dailyPrice: new Prisma.Decimal(100000),
        replacementValue: new Prisma.Decimal(1500000),
        depositValue: new Prisma.Decimal(500000),
        depositPolicyType: 'FIXED',
        currency: 'VND',
        status: 'ACTIVE',
        category: { id: dummyCategoryId, name: 'Lều', status: 'ACTIVE' },
        images: [],
        specifications: {},
        recommendationTags: [],
        gradeGroupId: null,
        grade: null,
      }
      const mockPrisma = {
        rentalProduct: {
          updateMany: jest.fn().mockImplementation(({ data }) => {
            updatePayload = data
            return { count: 1 }
          }),
          // Lần đọc đầu (dưới khoá) là bản ghi trước khi sửa: version 1. Các lần sau là bản đã sửa: version 2.
          findUnique: jest
            .fn()
            .mockResolvedValueOnce({ ...productRow, version: 1, requiresDeepReturnInspection: false })
            .mockResolvedValue({ ...productRow, version: 2, requiresDeepReturnInspection: true }),
        },
        mediaAsset: { findMany: jest.fn().mockResolvedValue([]) },
      } as any

      const adapter = new PrismaRentalProductAdapter(withTxSupport(mockPrisma))
      const result = await adapter.updateProduct({
        ...admin,
        id: dummyActiveProductId,
        expectedVersion: 1,
        requiresDeepInspectionAfterReturn: true,
      })

      expect(updatePayload.requiresDeepReturnInspection).toBe(true)
      expect(result.requiresDeepInspectionAfterReturn).toBe(true)
    })
  })

  // =========================================================================
  // MỤC 3: Swagger POST /api/v1/staff/rental-products reflects ACTIVE
  // =========================================================================
  describe('MỤC 3: Swagger documentation for staff product creation status', () => {
    // Trước đây sản phẩm tạo ra luôn ACTIVE. Từ tính năng thuê theo hạng, trạng thái ban đầu theo người tạo
    // (Policy: "ADMIN duyệt giá trước khi active catalog"): ADMIN tạo -> ACTIVE, STAFF_INVENTORY tạo -> INACTIVE.
    it('documents the initial status per creator role (ADMIN -> ACTIVE, STAFF_INVENTORY -> INACTIVE)', () => {
      const apiOpMetadata = Reflect.getMetadata('swagger/apiOperation', StaffRentalProductController.prototype.createProduct)
      const description: string = apiOpMetadata?.description ?? ''
      expect(description).toMatch(/ADMIN tạo:[^\n]*ACTIVE/)
      expect(description).toMatch(/STAFF_INVENTORY tạo:[^\n]*\n?[^\n]*INACTIVE/)
      expect(description).not.toContain('Khởi tạo mặc định ở trạng thái INACTIVE')
    })
  })

  // =========================================================================
  // MỤC 4: Swagger GET /api/v1/rental-orders status query enum values
  // =========================================================================
  describe('MỤC 4: Swagger documentation for rental-orders status enum', () => {
    it('documents valid Prisma RentalOrderStatus values and clarifies financialStatus separation', () => {
      const apiQueryMetadata = Reflect.getMetadata('swagger/apiParameters', RentalOrderController.prototype.listOrders)
      const statusParam = apiQueryMetadata?.find((p: any) => p.name === 'status')
      expect(statusParam).toBeDefined()
      expect(statusParam.description).toContain('PENDING_PAYMENT')
      expect(statusParam.description).toContain('RETURN_PROCESSING')
      expect(statusParam.description).toContain('financialStatus')
      expect(statusParam.description).not.toContain('RENTING')
      expect(statusParam.description).not.toContain('RETURNED')
    })
  })

  // =========================================================================
  // MỤC 6: Swagger InternalRentalEvidenceAccessController contract
  // =========================================================================
  describe('MỤC 6: Swagger documentation for InternalRentalEvidenceAccessController', () => {
    it('documents correct HMAC attestation payload matching service contract', () => {
      const apiParams = Reflect.getMetadata('swagger/apiParameters', InternalRentalEvidenceAccessController.prototype.confirm)
      const bodyParam = apiParams?.find((p: any) => p.in === 'body')
      const schema = bodyParam?.schema
      expect(schema?.required).toEqual(expect.arrayContaining(['userId', 'publishedAt', 'mediaIds', 'requestId']))
      expect(schema?.properties?.userId).toBeDefined()
      expect(schema?.properties?.mediaIds).toBeDefined()
      expect(schema?.properties?.mediaId).toBeUndefined()
      expect(schema?.properties?.purpose).toBeUndefined()

      const headerParam = apiParams?.find((p: any) => p.in === 'header' && p.name === 'x-rental-media-attestation')
      expect(headerParam?.description).toContain('HMAC-SHA256')
    })
  })

  // =========================================================================
  // MỤC 7: Swagger POST /api/v1/rental-orders/:id/payments gateway note
  // =========================================================================
  describe('MỤC 7: Swagger documentation for rental-orders payment gateway', () => {
    it('documents gateway field guidance for PAYMENT_PROVIDER=mock', () => {
      const apiOpMetadata = Reflect.getMetadata('swagger/apiOperation', RentalPaymentsController.prototype.create)
      expect(apiOpMetadata?.description).toContain('PAYMENT_PROVIDER=mock')
      expect(apiOpMetadata?.description).toContain('BẮT BUỘC ĐỂ TRỐNG')

      const apiParams = Reflect.getMetadata('swagger/apiParameters', RentalPaymentsController.prototype.create)
      const bodyParam = apiParams?.find((p: any) => p.in === 'body')
      expect(bodyParam?.schema?.properties?.gateway?.description).toContain('PAYMENT_PROVIDER=mock')
    })
  })
})