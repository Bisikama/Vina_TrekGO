import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { RentalOrderStatus, RentalUnitAssignmentStatus, UserRole } from '@prisma/client'
import { createHash } from 'node:crypto'
import request from 'supertest'
import { REQUEST_USER_KEY } from 'src/shared/constants/auth.constant'
import { ROLES_KEY } from 'src/shared/decorators/roles.decorator'
import { GlobalErrorFilter } from 'src/shared/errors'
import { hasActualProductHandover, isReviewableOrderStatus } from './application/rental-review-eligibility'
import { CreateRentalReviewUseCase } from './application/use-cases/create-rental-review.use-case'
import { GetOrderReviewableUseCase } from './application/use-cases/get-order-reviewable.use-case'
import { ListProductReviewsUseCase } from './application/use-cases/list-product-reviews.use-case'
import { PrismaRentalReviewAdapter } from './infrastructure/adapters/prisma-rental-review.adapter'
import { RentalReviewController } from './presentation/controllers/rental-review.controller'
import {
  CreateRentalReviewBodySchema,
  ListProductReviewsQuerySchema,
} from './presentation/dtos/rental-review.dto'

const orderId = '11111111-1111-4111-8111-111111111111'
const productId = '22222222-2222-4222-8222-222222222222'
const userId = '33333333-3333-4333-8333-333333333333'
const reviewId = '44444444-4444-4444-8444-444444444444'

describe('Rental product reviews', () => {
  describe('strict request contracts and eligibility', () => {
    it('normalizes comments and rejects coercion, fractional rating, extra fields and invalid queries', () => {
      expect(
        CreateRentalReviewBodySchema.parse({ productId, rating: 5, comment: '  chắc chắn  ' }),
      ).toEqual({ productId, rating: 5, comment: 'chắc chắn' })
      expect(CreateRentalReviewBodySchema.parse({ productId, rating: 5, comment: '   ' }).comment).toBeNull()
      for (const rating of [0, 6, 3.5, '5', null, Number.NaN]) {
        expect(CreateRentalReviewBodySchema.safeParse({ productId, rating }).success).toBe(false)
      }
      expect(CreateRentalReviewBodySchema.safeParse({ productId, rating: 5, extra: true }).success).toBe(false)
      expect(ListProductReviewsQuerySchema.safeParse({ page: '1', pageSize: '51' }).success).toBe(false)
      expect(ListProductReviewsQuerySchema.safeParse({ page: '1', unexpected: 'x' }).success).toBe(false)
    })

    it('requires both an order handover and matching handed-over or terminal assignment evidence', () => {
      const assignment = { status: RentalUnitAssignmentStatus.HANDED_OVER, handedOverAt: new Date() }
      expect(hasActualProductHandover(true, [assignment])).toBe(true)
      expect(hasActualProductHandover(false, [assignment])).toBe(false)
      expect(
        hasActualProductHandover(true, [
          { status: RentalUnitAssignmentStatus.PACKED, handedOverAt: null },
        ]),
      ).toBe(false)
      for (const status of [
        RentalOrderStatus.ACTIVE,
        RentalOrderStatus.RETURN_PENDING,
        RentalOrderStatus.RETURN_PROCESSING,
        RentalOrderStatus.COMPLETED,
      ]) {
        expect(isReviewableOrderStatus(status)).toBe(true)
      }
      for (const status of [
        RentalOrderStatus.PENDING_PAYMENT,
        RentalOrderStatus.PAID,
        RentalOrderStatus.PREPARING,
        RentalOrderStatus.READY_FOR_HANDOVER,
        RentalOrderStatus.CANCELLED,
        RentalOrderStatus.EXPIRED,
      ]) {
        expect(isReviewableOrderStatus(status)).toBe(false)
      }
    })
  })

  describe('Prisma adapter', () => {
    it('replays the committed review for the same key and rejects the key for a different payload', async () => {
      const cached = {
        requestHash: 'placeholder',
        responseBody: {
          id: reviewId,
          rentalOrderId: orderId,
          productId,
          rating: 5,
          comment: null,
          verifiedUsage: true,
          createdAt: '2026-10-24T10:00:00.000Z',
        },
      }
      const prisma = { idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(cached) } }
      const adapter = new PrismaRentalReviewAdapter(prisma as never)
      const command = {
        orderId,
        userId,
        productId,
        rating: 5,
        comment: null,
        idempotencyKey: 'review-key-replay',
      }

      await expect(adapter.createReview(command)).rejects.toMatchObject({
        code: 'RENTAL_REVIEW_IDEMPOTENCY_KEY_REUSED',
      })
      cached.requestHash = createHash('sha256')
        .update(JSON.stringify({ orderId, productId, rating: 5, comment: null }))
        .digest('hex')
      await expect(adapter.createReview(command)).resolves.toEqual(cached.responseBody)
      await expect(adapter.createReview({ ...command, rating: 4 })).rejects.toMatchObject({
        code: 'RENTAL_REVIEW_IDEMPOTENCY_KEY_REUSED',
      })
    })

    it('creates one verified review from server-side handover evidence and stores the replay result', async () => {
      const createdAt = new Date('2026-10-24T10:00:00.000Z')
      const tx = {
        idempotencyRecord: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({}),
          update: jest.fn().mockResolvedValue({}),
        },
        $queryRaw: jest.fn().mockResolvedValue([]),
        rentalOrder: {
          findFirst: jest.fn().mockResolvedValue({
            status: RentalOrderStatus.ACTIVE,
            rentalHandoverViaOrderId: { id: 'handover-1' },
            rentalOrderLinesViaOrderId: [
              {
                id: 'line-1',
                rentalUnitAssignmentsViaOrderLineId: [
                  { status: RentalUnitAssignmentStatus.HANDED_OVER, handedOverAt: createdAt },
                ],
              },
            ],
          }),
        },
        rentalReview: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: reviewId,
            rentalOrderId: orderId,
            productId,
            rating: 5,
            comment: 'Tốt',
            verifiedUsage: true,
            createdAt,
          }),
        },
      }
      const prisma = {
        idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null) },
        $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      }
      const adapter = new PrismaRentalReviewAdapter(prisma as never)

      await expect(
        adapter.createReview({
          orderId,
          userId,
          productId,
          rating: 5,
          comment: 'Tốt',
          idempotencyKey: 'review-key-001',
        }),
      ).resolves.toEqual({
        id: reviewId,
        rentalOrderId: orderId,
        productId,
        rating: 5,
        comment: 'Tốt',
        verifiedUsage: true,
        createdAt: createdAt.toISOString(),
      })
      expect(tx.rentalReview.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ verifiedUsage: true, userId }) }),
      )
      expect(tx.idempotencyRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ responseStatus: 201 }) }),
      )
    })

    it('keeps summary independent from the rating list filter and never exposes user PII', async () => {
      const tx = {
        rentalReview: {
          groupBy: jest.fn().mockResolvedValue([
            { rating: 4, _count: { rating: 1 } },
            { rating: 5, _count: { rating: 2 } },
          ]),
          aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 4.67 }, _count: { _all: 3 } }),
          count: jest.fn().mockResolvedValue(2),
          findMany: jest.fn().mockResolvedValue([
            {
              id: reviewId,
              rating: 5,
              comment: '<script>alert(1)</script>',
              verifiedUsage: true,
              createdAt: new Date('2026-10-24T10:00:00.000Z'),
            },
          ]),
        },
      }
      const prisma = {
        rentalProduct: { findFirst: jest.fn().mockResolvedValue({ id: productId }) },
        $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      }
      const adapter = new PrismaRentalReviewAdapter(prisma as never)
      const result = await adapter.listProductReviews({ productId, page: 1, pageSize: 10, rating: 5 })

      expect(result.summary).toEqual({
        averageRating: 4.67,
        totalReviews: 3,
        ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 1, '5': 2 },
      })
      expect(result.pagination.totalItems).toBe(2)
      expect(result.reviews[0]).toEqual(
        expect.objectContaining({ userName: 'Người thuê đã xác minh', comment: '<script>alert(1)</script>' }),
      )
      expect(result.reviews[0]).not.toHaveProperty('userId')
      expect(result.reviews[0]).not.toHaveProperty('email')
    })

    it('returns independent reviewable states without leaking assigned unit identifiers', async () => {
      const prisma = {
        rentalOrder: {
          findFirst: jest.fn().mockResolvedValue({
            status: RentalOrderStatus.ACTIVE,
            rentalHandoverViaOrderId: { id: 'handover-1' },
            rentalOrderLinesViaOrderId: [
              {
                productId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                quantity: 1,
                product: { id: 'a', sku: 'A', name: 'A', images: null },
                rentalUnitAssignmentsViaOrderLineId: [],
              },
              {
                productId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                quantity: 2,
                product: { id: 'b', sku: 'B', name: 'B', images: [] },
                rentalUnitAssignmentsViaOrderLineId: [
                  { status: RentalUnitAssignmentStatus.HANDED_OVER, handedOverAt: new Date() },
                ],
              },
              {
                productId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
                quantity: 1,
                product: { id: 'c', sku: 'C', name: 'C', images: null },
                rentalUnitAssignmentsViaOrderLineId: [
                  { status: RentalUnitAssignmentStatus.CLOSED, handedOverAt: new Date() },
                ],
              },
            ],
            rentalReviewsViaRentalOrderId: [
              { id: reviewId, productId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', rating: 4 },
            ],
          }),
        },
      }
      const adapter = new PrismaRentalReviewAdapter(prisma as never)
      const result = await adapter.getOrderReviewableItems({ orderId, userId })

      expect(result.items.map((item) => [item.canReview, item.ineligibleReason])).toEqual([
        [false, 'PRODUCT_NOT_HANDED_OVER'],
        [true, null],
        [false, 'ALREADY_REVIEWED'],
      ])
      expect(JSON.stringify(result)).not.toContain('unitId')
      expect(JSON.stringify(result)).not.toContain('assetCode')
    })

    it('uses the same 404 for missing and foreign-owned orders', async () => {
      const tx = {
        idempotencyRecord: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({}),
        },
        $queryRaw: jest.fn().mockResolvedValue([]),
        rentalOrder: { findFirst: jest.fn().mockResolvedValue(null) },
      }
      const prisma = {
        idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null) },
        $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
        rentalOrder: { findFirst: jest.fn().mockResolvedValue(null) },
      }
      const adapter = new PrismaRentalReviewAdapter(prisma as never)
      const command = {
        orderId,
        userId,
        productId,
        rating: 5,
        comment: null,
        idempotencyKey: 'review-key-owner',
      }
      await expect(adapter.createReview(command)).rejects.toMatchObject({
        code: 'RENTAL_REVIEW_ORDER_NOT_FOUND',
      })
      await expect(adapter.getOrderReviewableItems({ orderId, userId })).rejects.toMatchObject({
        code: 'RENTAL_REVIEW_ORDER_NOT_FOUND',
      })
    })
  })

  describe('HTTP contract and global error filter', () => {
    let app: INestApplication
    const createExecute = jest.fn().mockResolvedValue({ id: reviewId })
    const listExecute = jest.fn().mockResolvedValue({
      summary: { averageRating: null, totalReviews: 0, ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } },
      reviews: [],
      pagination: { page: 1, pageSize: 10, totalPages: 0, totalItems: 0 },
    })
    const reviewableExecute = jest.fn().mockResolvedValue({ items: [] })

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        controllers: [RentalReviewController],
        providers: [
          { provide: CreateRentalReviewUseCase, useValue: { execute: createExecute } },
          { provide: ListProductReviewsUseCase, useValue: { execute: listExecute } },
          { provide: GetOrderReviewableUseCase, useValue: { execute: reviewableExecute } },
        ],
      }).compile()
      app = moduleRef.createNestApplication()
      app.setGlobalPrefix('api/v1')
      app.useGlobalFilters(new GlobalErrorFilter())
      app.use((req: Record<string, unknown>, _res: unknown, next: () => void) => {
        req[REQUEST_USER_KEY] = { id: userId, role: UserRole.USER, status: 'ACTIVE' }
        next()
      })
      await app.init()
    })

    afterAll(async () => app.close())

    it('registers USER and LEADER on both private methods', () => {
      for (const methodName of ['createReview', 'getOrderReviewableItems']) {
        const method = Object.getOwnPropertyDescriptor(RentalReviewController.prototype, methodName)?.value
        expect(Reflect.getMetadata(ROLES_KEY, method)).toEqual([UserRole.USER, UserRole.LEADER])
      }
    })

    it('serves all three routes with the intended success statuses', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/rental-orders/${orderId}/reviews`)
        .set('Idempotency-Key', 'review-key-001')
        .send({ productId, rating: 5, comment: 'Tốt' })
        .expect(201)
      await request(app.getHttpServer())
        .get(`/api/v1/rental-products/${productId}/reviews?page=1&pageSize=10`)
        .expect(200)
      await request(app.getHttpServer())
        .get(`/api/v1/rental-orders/${orderId}/reviewable-items`)
        .expect(200)
    })

    it('publishes all three operations in OpenAPI without changing the global prefix', () => {
      const document = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().setTitle('Rental review test').setVersion('1').build(),
      )
      expect(document.paths['/api/v1/rental-orders/{orderId}/reviews']?.post?.operationId).toBe(
        'createRentalProductReview',
      )
      expect(document.paths['/api/v1/rental-products/{productId}/reviews']?.get?.operationId).toBe(
        'listRentalProductReviews',
      )
      expect(document.paths['/api/v1/rental-orders/{orderId}/reviewable-items']?.get?.operationId).toBe(
        'getRentalOrderReviewableItems',
      )
    })

    it('formats validation failures through the shared global envelope', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/rental-orders/${orderId}/reviews`)
        .set('Idempotency-Key', 'review-key-002')
        .send({ productId, rating: '5', extra: true })
        .expect(400)
      expect(response.body).toMatchObject({
        error: { code: 'VALIDATION_ERROR', retryable: false },
        meta: { contractVersion: '0.2.0-final-flow' },
      })
      expect(response.body.meta.requestId).toEqual(expect.any(String))
      expect(response.body.meta.serverTime).toEqual(expect.any(String))
    })

    it('requires an 8 to 200 character Idempotency-Key through the shared envelope', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/rental-orders/${orderId}/reviews`)
        .send({ productId, rating: 5 })
        .expect(400)
      expect(response.body.error).toMatchObject({
        code: 'RENTAL_REVIEW_IDEMPOTENCY_KEY_REQUIRED',
        retryable: false,
      })
    })
  })
})
