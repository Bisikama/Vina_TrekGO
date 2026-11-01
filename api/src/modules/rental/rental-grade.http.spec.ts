/**
 * HTTP contract cho phần thuê đồ theo hạng: guard, ZodValidationPipe và GlobalErrorFilter chạy thật;
 * use-case và adapter cũng thật, chỉ Prisma là giả. Kiểm `response.body.error.code` + HTTP status.
 */
import { ExecutionContext, INestApplication, UnauthorizedException } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { Prisma } from '@prisma/client'

jest.mock('@nestjs/schedule', () => ({
  Cron: jest.fn(() => () => {}),
  CronExpression: {},
  Interval: jest.fn(() => () => {}),
}))
jest.mock('./shared/primary-inventory-location', () => ({
  resolveActivePrimaryRentalLocation: jest.fn().mockResolvedValue('00000000-0000-4000-8000-0000000000aa'),
  primaryRentalInventoryLocationId: jest.fn(() => '00000000-0000-4000-8000-0000000000aa'),
}))

import { REQUEST_USER_KEY } from 'src/shared/constants/auth.constant'
import { UserRole } from 'src/shared/constants/enum.constant'
import { GlobalErrorFilter } from 'src/shared/errors'
import { AccessTokenGuard } from 'src/shared/guards/access-token.guard'
import { ApiKeyGuard } from 'src/shared/guards/api-key.guard'
import { AuthenticationGuard } from 'src/shared/guards/authentication.guard'
import { RolesGuard } from 'src/shared/guards/roles.guard'
import { PrismaService } from 'src/shared/services/prisma.service'

import { StaffRentalProductController } from './catalog/presentation/controllers/staff-rental-product.controller'
import { ListStaffRentalProductsUseCase } from './catalog/application/use-cases/list-staff-rental-products.use-case'
import { GetRentalProductUseCase } from './catalog/application/use-cases/get-rental-product.use-case'
import { ChangeRentalProductStatusUseCase } from './catalog/application/use-cases/change-rental-product-status.use-case'
import { CreateRentalProductUseCase } from './catalog/application/use-cases/create-rental-product.use-case'
import { UpdateRentalProductUseCase } from './catalog/application/use-cases/update-rental-product.use-case'
import { RENTAL_PRODUCT_PORT } from './catalog/application/ports/rental-product.port'
import { RENTAL_CATEGORY_PORT } from './catalog/application/ports/rental-category.port'

import { StaffReturnController } from './returns/presentation/controllers/staff-return.controller'
import { ReceiveReturnUseCase } from './returns/application/use-cases/receive-return.use-case'
import { FinalInspectionUseCase } from './returns/application/use-cases/final-inspection.use-case'
import { FinalizeReturnUseCase } from './returns/application/use-cases/finalize-return.use-case'
import { MarkReturnedUnitReadyUseCase } from './returns/application/use-cases/mark-returned-unit-ready.use-case'
import { ListReturnsUseCase } from './returns/application/use-cases/list-returns.use-case'
import { GetReturnUseCase } from './returns/application/use-cases/get-return.use-case'
import { RENTAL_RETURN_PORT } from './returns/application/ports/rental-return.port'
import { PrismaRentalReturnAdapter } from './returns/infrastructure/adapters/prisma-rental-return.adapter'

import { EquipmentUnitController } from './inventory/presentation/controllers/equipment-unit.controller'
import { ListEquipmentUnitsUseCase } from './inventory/application/use-cases/list-equipment-units.use-case'
import { CreateEquipmentUnitUseCase } from './inventory/application/use-cases/create-equipment-unit.use-case'
import { GetEquipmentUnitUseCase } from './inventory/application/use-cases/get-equipment-unit.use-case'
import { UpdateEquipmentUnitUseCase } from './inventory/application/use-cases/update-equipment-unit.use-case'
import { BatchCreateEquipmentUnitsUseCase } from './inventory/application/use-cases/batch-create-equipment-units.use-case'
import { GenerateEquipmentLabelsUseCase } from './inventory/application/use-cases/generate-equipment-labels.use-case'
import { ChangeEquipmentMaintenanceUseCase } from './inventory/application/use-cases/change-equipment-maintenance.use-case'
import { DowngradeEquipmentGradeUseCase } from './inventory/application/use-cases/downgrade-equipment-grade.use-case'
import { EQUIPMENT_UNIT_PORT } from './inventory/application/ports/equipment-unit.port'
import { PrismaEquipmentUnitAdapter } from './inventory/infrastructure/adapters/prisma-equipment-unit.adapter'

import { AdminRentalOrderController } from './ordering/presentation/controllers/admin-rental-order.controller'
import { CancelRentalOrderSystemFaultUseCase } from './ordering/application/use-cases/cancel-rental-order-system-fault.use-case'
import { RENTAL_SYSTEM_FAULT_CANCELLATION_PORT } from './ordering/application/ports/rental-system-fault-cancellation.port'
import { PrismaRentalSystemFaultCancellationAdapter } from './ordering/infrastructure/adapters/prisma-rental-system-fault-cancellation.adapter'

const ACTOR_ID = '11111111-1111-4111-8111-111111111111'
const UNIT_ID = '22222222-2222-4222-8222-222222222222'
const ORDER_ID = '33333333-3333-4333-8333-333333333333'
const CATEGORY_ID = '44444444-4444-4444-8444-444444444444'
const LIKE_NEW = { id: 'p-like', gradeGroupId: 'g-1', grade: 'LIKE_NEW' as const }

/** Prisma giả dùng chung cho mọi adapter; mỗi test gán `db.tx` theo kịch bản. */
const db: { tx: any } = { tx: {} }
const fakePrisma: any = {
  $transaction: jest.fn((cb: any) => cb(db.tx)),
}
function baseTx(extra: Record<string, any>) {
  return {
    idempotencyRecord: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ now: new Date('2026-11-01T00:00:00Z') }]),
    equipmentUnit: { findUnique: jest.fn(), update: jest.fn() },
    rentalOrder: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
    ...extra,
  }
}

describe('Rental grade HTTP contract (guards + GlobalErrorFilter)', () => {
  let app: INestApplication
  const productPort = { createProduct: jest.fn(), updateProduct: jest.fn() }
  const categoryPort = {
    getCategoryById: jest.fn().mockResolvedValue({ id: CATEGORY_ID, status: 'ACTIVE' }),
  }

  beforeAll(async () => {
    // Bearer giả chỉ cấp danh tính theo header `Bearer <ROLE>`; RolesGuard và pipe chạy thật.
    const bearer = {
      canActivate: jest.fn((context: ExecutionContext) => {
        const req = context.switchToHttp().getRequest()
        const role = String(req.headers.authorization ?? '').replace(/^Bearer /, '')
        if (!Object.values(UserRole).includes(role as UserRole)) throw new UnauthorizedException()
        req[REQUEST_USER_KEY] = { id: ACTOR_ID, role }
        return true
      }),
    }
    const unused = (token: any) => ({ provide: token, useValue: {} })
    const moduleRef = await Test.createTestingModule({
      controllers: [
        StaffRentalProductController,
        StaffReturnController,
        EquipmentUnitController,
        AdminRentalOrderController,
      ],
      providers: [
        { provide: AccessTokenGuard, useValue: bearer },
        { provide: ApiKeyGuard, useValue: { canActivate: () => false } },
        { provide: APP_GUARD, useClass: AuthenticationGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: PrismaService, useValue: fakePrisma },
        // Catalog
        CreateRentalProductUseCase,
        UpdateRentalProductUseCase,
        { provide: RENTAL_PRODUCT_PORT, useValue: productPort },
        { provide: RENTAL_CATEGORY_PORT, useValue: categoryPort },
        unused(ListStaffRentalProductsUseCase),
        unused(GetRentalProductUseCase),
        unused(ChangeRentalProductStatusUseCase),
        // Returns
        MarkReturnedUnitReadyUseCase,
        { provide: RENTAL_RETURN_PORT, useValue: new PrismaRentalReturnAdapter(fakePrisma) },
        unused(ReceiveReturnUseCase),
        unused(FinalInspectionUseCase),
        unused(FinalizeReturnUseCase),
        unused(ListReturnsUseCase),
        unused(GetReturnUseCase),
        // Inventory
        DowngradeEquipmentGradeUseCase,
        { provide: EQUIPMENT_UNIT_PORT, useValue: new PrismaEquipmentUnitAdapter(fakePrisma) },
        unused(ListEquipmentUnitsUseCase),
        unused(CreateEquipmentUnitUseCase),
        unused(GetEquipmentUnitUseCase),
        unused(UpdateEquipmentUnitUseCase),
        unused(BatchCreateEquipmentUnitsUseCase),
        unused(GenerateEquipmentLabelsUseCase),
        unused(ChangeEquipmentMaintenanceUseCase),
        // Ordering (admin)
        CancelRentalOrderSystemFaultUseCase,
        {
          provide: RENTAL_SYSTEM_FAULT_CANCELLATION_PORT,
          useValue: new PrismaRentalSystemFaultCancellationAdapter(fakePrisma),
        },
      ],
    }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api/v1')
    app.useGlobalFilters(new GlobalErrorFilter())
    await app.init()
  })

  afterEach(() => jest.clearAllMocks())
  afterAll(async () => {
    await app.close()
  })

  const http = () => request(app.getHttpServer())
  const expectEnvelope = (body: any, code: string) => {
    expect(body.error.code).toBe(code)
    expect(body.meta.requestId).toEqual(expect.any(String))
  }

  describe('Catalog: POST /staff/rental-products', () => {
    const body = {
      categoryId: CATEGORY_ID,
      sku: 'TENT-HTTP',
      name: 'Lều test',
      dailyPrice: 100_000,
      replacementValue: 2_000_000,
      depositPolicy: { type: 'FIXED', amount: 600_000 },
    }

    it('STAFF_INVENTORY gửi cọc/giá trị thay thế → 403 RENTAL_PRODUCT_FINANCIAL_FIELDS_ADMIN_ONLY', async () => {
      const res = await http()
        .post('/api/v1/staff/rental-products')
        .set('Authorization', 'Bearer STAFF_INVENTORY')
        .send(body)
        .expect(403)
      expectEnvelope(res.body, 'RENTAL_PRODUCT_FINANCIAL_FIELDS_ADMIN_ONLY')
      expect(productPort.createProduct).not.toHaveBeenCalled()
    })

    it('ADMIN gửi đủ cọc và giá trị thay thế → tới port', async () => {
      productPort.createProduct.mockResolvedValue({ id: 'p-new', status: 'ACTIVE' })
      await http().post('/api/v1/staff/rental-products').set('Authorization', 'Bearer ADMIN').send(body).expect(201)
      expect(productPort.createProduct).toHaveBeenCalledWith(expect.objectContaining({ actorRole: 'ADMIN' }))
    })
  })

  describe('Returns: POST /staff/equipment-units/:id/ready', () => {
    function readyTx() {
      return baseTx({
        user: { findFirst: jest.fn().mockResolvedValue({ id: ACTOR_ID, role: 'STAFF_INVENTORY' }) },
        equipmentUnit: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ id: UNIT_ID, productId: LIKE_NEW.id, status: 'CLEANING', version: 3 }),
          update: jest.fn(),
        },
        rentalUnitAssignment: { findFirst: jest.fn().mockResolvedValue({ id: 'as-1', orderLineId: 'line-1' }) },
        returnInspection: { findUnique: jest.fn().mockResolvedValue({ id: 'ins-1', outcome: 'NORMAL' }) },
        returnInspectionTask: { findUnique: jest.fn().mockResolvedValue({ status: 'COMPLETED' }) },
        rentalProduct: { findUnique: jest.fn().mockResolvedValue(LIKE_NEW) },
      })
    }

    it('thiết bị có hạng mà thiếu gradeDecision → 422 RENTAL_GRADE_DECISION_REQUIRED, không đổi unit', async () => {
      db.tx = readyTx()
      const res = await http()
        .post(`/api/v1/staff/equipment-units/${UNIT_ID}/ready`)
        .set('Authorization', 'Bearer STAFF_INVENTORY')
        .set('Idempotency-Key', 'ready-http-0001')
        .send({ accessoriesChecked: true, expectedVersion: 3 })
        .expect(422)
      expectEnvelope(res.body, 'RENTAL_GRADE_DECISION_REQUIRED')
      expect(db.tx.equipmentUnit.update).not.toHaveBeenCalled()
    })

    it('DOWNGRADE thiếu reason → 400 VALIDATION_ERROR trước khi vào adapter', async () => {
      db.tx = readyTx()
      const res = await http()
        .post(`/api/v1/staff/equipment-units/${UNIT_ID}/ready`)
        .set('Authorization', 'Bearer STAFF_INVENTORY')
        .set('Idempotency-Key', 'ready-http-0002')
        .send({ accessoriesChecked: true, expectedVersion: 3, gradeDecision: { decision: 'DOWNGRADE' } })
        .expect(400)
      expectEnvelope(res.body, 'VALIDATION_ERROR')
      expect(fakePrisma.$transaction).not.toHaveBeenCalled()
    })
  })

  describe('Inventory: POST /staff/equipment-units/:id/grade-downgrade', () => {
    const body = { reason: 'Vải lều bạc màu', expectedVersion: 5 }

    it('thiếu Idempotency-Key → 400 IDEMPOTENCY_KEY_REQUIRED', async () => {
      const res = await http()
        .post(`/api/v1/staff/equipment-units/${UNIT_ID}/grade-downgrade`)
        .set('Authorization', 'Bearer STAFF_INVENTORY')
        .send(body)
        .expect(400)
      expectEnvelope(res.body, 'IDEMPOTENCY_KEY_REQUIRED')
    })

    it('unit đang gán cho đơn → 409 EQUIPMENT_UNIT_NOT_REGRADABLE (OPEN_ASSIGNMENT)', async () => {
      db.tx = baseTx({
        equipmentUnit: {
          findUnique: jest.fn().mockResolvedValue({
            id: UNIT_ID,
            status: 'AVAILABLE',
            version: 5,
            productId: LIKE_NEW.id,
            product: LIKE_NEW,
          }),
          update: jest.fn(),
        },
        rentalUnitAssignment: { findFirst: jest.fn().mockResolvedValue({ id: 'as-open', status: 'ASSIGNED' }) },
        rentalReadinessCommitment: { findUnique: jest.fn().mockResolvedValue(null) },
      })
      const res = await http()
        .post(`/api/v1/staff/equipment-units/${UNIT_ID}/grade-downgrade`)
        .set('Authorization', 'Bearer ADMIN')
        .set('Idempotency-Key', 'grade-down-http-1')
        .send(body)
        .expect(409)
      expectEnvelope(res.body, 'EQUIPMENT_UNIT_NOT_REGRADABLE')
      expect(res.body.error.details.reason).toBe('OPEN_ASSIGNMENT')
      expect(db.tx.equipmentUnit.update).not.toHaveBeenCalled()
    })

    it('STAFF_DELIVERY → 403 FORBIDDEN', async () => {
      const res = await http()
        .post(`/api/v1/staff/equipment-units/${UNIT_ID}/grade-downgrade`)
        .set('Authorization', 'Bearer STAFF_DELIVERY')
        .set('Idempotency-Key', 'grade-down-http-2')
        .send(body)
        .expect(403)
      expectEnvelope(res.body, 'FORBIDDEN')
    })
  })

  describe('Ordering: POST /admin/rental-orders/:orderId/system-fault-cancellation', () => {
    const url = `/api/v1/admin/rental-orders/${ORDER_ID}/system-fault-cancellation`
    const body = {
      reasonCode: 'GRADE_DOWNGRADE_CAPACITY_SHORTAGE',
      note: 'Không còn lều hạng Rất mới',
      expectedVersion: 3,
    }
    function orderTx(over: Record<string, any>) {
      const order = {
        id: ORDER_ID,
        tripId: 't-1',
        status: 'READY_FOR_HANDOVER',
        financialStatus: 'PAID',
        version: 3,
        currency: 'VND',
        rentalFee: new Prisma.Decimal(600_000),
        totalDeposit: new Prisma.Decimal(1_200_000),
        rentalHandoverViaOrderId: null,
        inventoryTaskViaOrderId: { id: 'it-1', status: 'READY' },
        packageViaOrderId: { id: 'pkg-1', status: 'READY' },
        deliveryTasksViaOrderId: [],
        rentalOrderLinesViaOrderId: [],
        ...over,
      }
      return baseTx({
        trip: { findUnique: jest.fn().mockResolvedValue({ status: 'OPEN' }) },
        rentalOrder: {
          findUnique: jest.fn().mockResolvedValue({ tripId: order.tripId }),
          findUniqueOrThrow: jest.fn().mockResolvedValue(order),
          update: jest.fn(),
        },
      })
    }

    it('STAFF_INVENTORY → 403 FORBIDDEN (route chỉ ADMIN, ghi đè @Roles của controller)', async () => {
      const res = await http()
        .post(url)
        .set('Authorization', 'Bearer STAFF_INVENTORY')
        .set('Idempotency-Key', 'sysfault-http-1')
        .send(body)
        .expect(403)
      expectEnvelope(res.body, 'FORBIDDEN')
      expect(fakePrisma.$transaction).not.toHaveBeenCalled()
    })

    it('kiện đang ở chỗ nhân viên giao → 409 CANCELLATION_REQUIRES_CUSTODY_RETURN (không còn 500)', async () => {
      db.tx = orderTx({ packageViaOrderId: { id: 'pkg-1', status: 'TRANSFERRED_TO_DELIVERY' } })
      const res = await http()
        .post(url)
        .set('Authorization', 'Bearer ADMIN')
        .set('Idempotency-Key', 'sysfault-http-2')
        .send(body)
        .expect(409)
      expectEnvelope(res.body, 'CANCELLATION_REQUIRES_CUSTODY_RETURN')
      expect(db.tx.rentalOrder.update).not.toHaveBeenCalled()
    })

    it('đơn ACTIVE → 409 RENTAL_SYSTEM_FAULT_CANCELLATION_NOT_ALLOWED', async () => {
      db.tx = orderTx({ status: 'ACTIVE' })
      const res = await http()
        .post(url)
        .set('Authorization', 'Bearer ADMIN')
        .set('Idempotency-Key', 'sysfault-http-3')
        .send(body)
        .expect(409)
      expectEnvelope(res.body, 'RENTAL_SYSTEM_FAULT_CANCELLATION_NOT_ALLOWED')
    })

    it('body có field lạ → 400 VALIDATION_ERROR', async () => {
      const res = await http()
        .post(url)
        .set('Authorization', 'Bearer ADMIN')
        .set('Idempotency-Key', 'sysfault-http-4')
        .send({ ...body, refundAmount: 1 })
        .expect(400)
      expectEnvelope(res.body, 'VALIDATION_ERROR')
      expect(fakePrisma.$transaction).not.toHaveBeenCalled()
    })
  })
})
