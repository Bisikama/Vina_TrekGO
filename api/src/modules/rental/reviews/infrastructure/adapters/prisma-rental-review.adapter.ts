import { Injectable } from '@nestjs/common'
import {
  Prisma,
  RecordStatus,
  RentalOrderStatus,
  RentalProductStatus,
  type RentalUnitAssignmentStatus,
} from '@prisma/client'
import { createHash } from 'node:crypto'
import { AppError } from 'src/shared/errors/app-error'
import { RENTAL_ERROR_CODES } from 'src/shared/errors/codes/rental.error-codes'
import { RENTAL_REVIEW_ERROR_CODES as RV } from 'src/shared/errors/codes/rental-review.error-codes'
import { PrismaService } from 'src/shared/services/prisma.service'
import { hasActualProductHandover, isReviewableOrderStatus } from '../../application/rental-review-eligibility'
import type {
  CreateRentalReviewCommand,
  ListProductReviewsQuery,
  OrderReviewableItemsQuery,
  OrderReviewableItemsResult,
  ProductReviewListResult,
  RentalReviewPort,
  RentalReviewResult,
  ReviewIneligibleReason,
} from '../../application/ports/rental-review.port'

const IDEMPOTENCY_SCOPE = 'RENTAL_PRODUCT_REVIEW_CREATE'
const VERIFIED_RENTER_LABEL = 'Người thuê đã xác minh'

@Injectable()
export class PrismaRentalReviewAdapter implements RentalReviewPort {
  constructor(private readonly prisma: PrismaService) {}

  async createReview(command: CreateRentalReviewCommand): Promise<RentalReviewResult> {
    const requestHash = hashRequest(command)
    const replay = await this.readReplay(this.prisma, command, requestHash)
    if (replay) return replay

    try {
      return await this.prisma.$transaction(async (tx) => {
        const cached = await tx.idempotencyRecord.findUnique({
          where: {
            scope_userId_idempotencyKey: {
              scope: IDEMPOTENCY_SCOPE,
              userId: command.userId,
              idempotencyKey: command.idempotencyKey,
            },
          },
        })
        if (cached) return replayFromRecord(cached, requestHash)

        await tx.idempotencyRecord.create({
          data: {
            scope: IDEMPOTENCY_SCOPE,
            userId: command.userId,
            idempotencyKey: command.idempotencyKey,
            requestHash,
          },
        })

        await tx.$queryRaw`
          SELECT id
          FROM rental_orders
          WHERE id = ${command.orderId}::uuid AND user_id = ${command.userId}::uuid
          FOR UPDATE
        `
        const order = await tx.rentalOrder.findFirst({
          where: { id: command.orderId, userId: command.userId },
          select: {
            status: true,
            rentalHandoverViaOrderId: { select: { id: true } },
            rentalOrderLinesViaOrderId: {
              where: { productId: command.productId },
              select: {
                id: true,
                rentalUnitAssignmentsViaOrderLineId: {
                  select: { status: true, handedOverAt: true },
                },
              },
            },
          },
        })
        if (!order) throw AppError.fromCode(RV.RENTAL_ORDER_NOT_FOUND)
        const line = order.rentalOrderLinesViaOrderId[0]
        if (!line) throw AppError.fromCode(RV.PRODUCT_NOT_IN_RENTAL_ORDER)
        if (!isReviewableOrderStatus(order.status)) {
          throw AppError.fromCode(RV.RENTAL_ORDER_NOT_ELIGIBLE_FOR_REVIEW, {
            details: { orderStatus: order.status },
          })
        }
        if (
          !hasActualProductHandover(
            order.rentalHandoverViaOrderId !== null,
            line.rentalUnitAssignmentsViaOrderLineId,
          )
        ) {
          throw AppError.fromCode(RV.RENTAL_REVIEW_PRODUCT_NOT_HANDED_OVER)
        }

        const existing = await tx.rentalReview.findUnique({
          where: {
            rentalOrderId_productId_userId: {
              rentalOrderId: command.orderId,
              productId: command.productId,
              userId: command.userId,
            },
          },
          select: { id: true },
        })
        if (existing) throw AppError.fromCode(RV.RENTAL_REVIEW_ALREADY_EXISTS)

        const created = await tx.rentalReview.create({
          data: {
            rentalOrderId: command.orderId,
            userId: command.userId,
            productId: command.productId,
            rating: command.rating,
            comment: command.comment,
            verifiedUsage: true,
          },
        })
        const result = mapCreatedReview(created)
        await tx.idempotencyRecord.update({
          where: {
            scope_userId_idempotencyKey: {
              scope: IDEMPOTENCY_SCOPE,
              userId: command.userId,
              idempotencyKey: command.idempotencyKey,
            },
          },
          data: {
            responseStatus: 201,
            responseBody: result as unknown as Prisma.InputJsonValue,
            completedAt: new Date(),
          },
        })
        return result
      })
    } catch (error) {
      if (error instanceof AppError) throw error
      if (isUniqueConstraintError(error)) {
        const concurrentReplay = await this.readReplay(this.prisma, command, requestHash)
        if (concurrentReplay) return concurrentReplay
        throw AppError.fromCode(RV.RENTAL_REVIEW_ALREADY_EXISTS)
      }
      throw error
    }
  }

  async listProductReviews(query: ListProductReviewsQuery): Promise<ProductReviewListResult> {
    const product = await this.prisma.rentalProduct.findFirst({
      where: {
        id: query.productId,
        status: RentalProductStatus.ACTIVE,
        category: { status: RecordStatus.ACTIVE },
      },
      select: { id: true },
    })
    if (!product) throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_PRODUCT_NOT_FOUND)

    const publicWhere: Prisma.RentalReviewWhereInput = {
      productId: query.productId,
      verifiedUsage: true,
    }
    const filteredWhere: Prisma.RentalReviewWhereInput = {
      ...publicWhere,
      ...(query.rating === undefined ? {} : { rating: query.rating }),
    }
    const { groups, aggregate, totalItems, reviews } = await this.prisma.$transaction(
      async (tx) => {
        const groups = await tx.rentalReview.groupBy({
          by: ['rating'],
          where: publicWhere,
          orderBy: { rating: 'asc' },
          _count: { rating: true },
        })
        const aggregate = await tx.rentalReview.aggregate({
          where: publicWhere,
          _avg: { rating: true },
          _count: { _all: true },
        })
        const totalItems = await tx.rentalReview.count({ where: filteredWhere })
        const reviews = await tx.rentalReview.findMany({
          where: filteredWhere,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: { id: true, rating: true, comment: true, verifiedUsage: true, createdAt: true },
        })
        return { groups, aggregate, totalItems, reviews }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    )
    const ratingBreakdown = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
    for (const group of groups) {
      ratingBreakdown[String(group.rating) as keyof typeof ratingBreakdown] = group._count.rating
    }

    return {
      summary: {
        averageRating:
          aggregate._avg.rating === null ? null : Math.round(aggregate._avg.rating * 100) / 100,
        totalReviews: aggregate._count._all,
        ratingBreakdown,
      },
      reviews: reviews.map((review) => ({
        id: review.id,
        userName: VERIFIED_RENTER_LABEL,
        rating: review.rating,
        comment: review.comment,
        verifiedUsage: true,
        createdAt: review.createdAt.toISOString(),
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalPages: Math.ceil(totalItems / query.pageSize),
        totalItems,
      },
    }
  }

  async getOrderReviewableItems(query: OrderReviewableItemsQuery): Promise<OrderReviewableItemsResult> {
    const order = await this.prisma.rentalOrder.findFirst({
      where: { id: query.orderId, userId: query.userId },
      select: {
        status: true,
        rentalHandoverViaOrderId: { select: { id: true } },
        rentalOrderLinesViaOrderId: {
          orderBy: { createdAt: 'asc' },
          select: {
            productId: true,
            quantity: true,
            product: { select: { id: true, sku: true, name: true, images: true } },
            rentalUnitAssignmentsViaOrderLineId: {
              select: { status: true, handedOverAt: true },
            },
          },
        },
        rentalReviewsViaRentalOrderId: {
          where: { userId: query.userId },
          select: { id: true, productId: true, rating: true },
        },
      },
    })
    if (!order) throw AppError.fromCode(RV.RENTAL_ORDER_NOT_FOUND)

    const reviewsByProduct = new Map(
      order.rentalReviewsViaRentalOrderId.map((review) => [review.productId, review]),
    )
    const orderEligible = isReviewableOrderStatus(order.status)
    const hasOrderHandover = order.rentalHandoverViaOrderId !== null
    return {
      items: order.rentalOrderLinesViaOrderId.map((line) => {
        const review = reviewsByProduct.get(line.productId)
        const hasBeenHandedOver = hasActualProductHandover(
          hasOrderHandover,
          line.rentalUnitAssignmentsViaOrderLineId,
        )
        let ineligibleReason: ReviewIneligibleReason | null = null
        if (review) ineligibleReason = 'ALREADY_REVIEWED'
        else if (!orderEligible) ineligibleReason = 'ORDER_NOT_ELIGIBLE_FOR_REVIEW'
        else if (!hasBeenHandedOver) ineligibleReason = 'PRODUCT_NOT_HANDED_OVER'
        return {
          productId: line.productId,
          product: line.product,
          quantity: line.quantity,
          hasBeenHandedOver,
          isReviewed: Boolean(review),
          reviewId: review?.id ?? null,
          rating: review?.rating ?? null,
          canReview: ineligibleReason === null,
          ineligibleReason,
        }
      }),
    }
  }

  private async readReplay(
    client: Pick<PrismaService, 'idempotencyRecord'>,
    command: CreateRentalReviewCommand,
    requestHash: string,
  ): Promise<RentalReviewResult | null> {
    const cached = await client.idempotencyRecord.findUnique({
      where: {
        scope_userId_idempotencyKey: {
          scope: IDEMPOTENCY_SCOPE,
          userId: command.userId,
          idempotencyKey: command.idempotencyKey,
        },
      },
    })
    if (!cached) return null
    return replayFromRecord(cached, requestHash)
  }
}

function hashRequest(command: CreateRentalReviewCommand): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        orderId: command.orderId,
        productId: command.productId,
        rating: command.rating,
        comment: command.comment,
      }),
    )
    .digest('hex')
}

function replayFromRecord(
  record: { requestHash: string; responseBody: Prisma.JsonValue | null },
  requestHash: string,
): RentalReviewResult {
  if (record.requestHash !== requestHash) throw AppError.fromCode(RV.RENTAL_REVIEW_IDEMPOTENCY_KEY_REUSED)
  if (!record.responseBody) throw AppError.fromCode(RV.RENTAL_REVIEW_OPERATION_IN_PROGRESS)
  return record.responseBody as unknown as RentalReviewResult
}

function mapCreatedReview(review: {
  id: string
  rentalOrderId: string
  productId: string
  rating: number
  comment: string | null
  verifiedUsage: boolean
  createdAt: Date
}): RentalReviewResult {
  return {
    id: review.id,
    rentalOrderId: review.rentalOrderId,
    productId: review.productId,
    rating: review.rating,
    comment: review.comment,
    verifiedUsage: true,
    createdAt: review.createdAt.toISOString(),
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}
