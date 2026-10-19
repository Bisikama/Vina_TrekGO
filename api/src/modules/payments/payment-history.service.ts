import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../shared/services/prisma.service'
import { AppError, RENTAL_ORDERING_ERROR_CODES as RO } from '../../shared/errors'
import type {
  RentalOrderPaymentHistoryItemDto,
  RentalOrderPaymentHistoryQueryDto,
  RentalOrderPaymentHistoryResponseDto,
} from './dtos/rental-order-payment-history.dto'
import type {
  FinancialEffect,
  TransactionKind,
  TransactionSource,
  UserTransactionItemDto,
  UserTransactionsQueryDto,
  UserTransactionsResponseDto,
} from './dtos/user-transactions.dto'

interface RawTimelineRow {
  id: string
  kind: TransactionKind
  source: TransactionSource
  sourceId: string | null
  paymentId: string
  refundId: string | null
  invoiceId: string
  amount: string
  currency: string
  status: string
  financialEffect: FinancialEffect
  paymentMethod: string | null
  createdAt: Date
  completedAt: Date | null
  invoiceNo: string | null
  revisionNo: number | null
  refundPurpose: string | null
  isExtension: boolean
}

@Injectable()
export class PaymentHistoryService {
  constructor(private readonly db: PrismaService) {}

  /**
   * API 1 — Rental Order Payment History
   * Method: GET /api/v1/rental-orders/:id/payments
   *
   * Retrieves all payment attempts and related refunds for a specific RentalOrder.
   * Enforces that the actor is the owner of the RentalOrder.
   */
  async getRentalOrderPaymentHistory(input: {
    rentalOrderId: string
    actorUserId: string
    query: RentalOrderPaymentHistoryQueryDto
  }): Promise<RentalOrderPaymentHistoryResponseDto> {
    const { rentalOrderId, actorUserId, query } = input
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20

    // 1. Verify existence and ownership of RentalOrder
    const order = await this.db.rentalOrder.findUnique({
      where: { id: rentalOrderId },
      select: { id: true, userId: true },
    })

    if (!order) {
      throw AppError.fromCode(RO.RENTAL_ORDER_NOT_FOUND)
    }

    if (order.userId !== actorUserId) {
      throw AppError.fromCode('FORBIDDEN')
    }

    // 2. Find all Invoices belonging to this RentalOrder (including extensions & revisions)
    const invoices = await this.db.invoice.findMany({
      where: { rentalOrderId },
      select: { id: true, invoiceNo: true, revisionNo: true },
    })

    const invoiceIds = invoices.map((i) => i.id)
    if (invoiceIds.length === 0) {
      return {
        orderId: rentalOrderId,
        items: [],
        pagination: {
          page,
          pageSize,
          total: 0,
          totalPages: 0,
        },
      }
    }

    // Identify extension invoices grounded in RentalExtensionRequest records
    const extensionRequests = await this.db.rentalExtensionRequest.findMany({
      where: { orderId: rentalOrderId, invoiceId: { not: null } },
      select: { invoiceId: true },
    })
    const extensionInvoiceIds = new Set(
      extensionRequests.map((r) => r.invoiceId).filter((id): id is string => Boolean(id)),
    )

    // 3. Build where condition for Payments
    const where: Prisma.PaymentWhereInput = {
      invoiceId: { in: invoiceIds },
    }

    if (query.status) {
      where.status = query.status
    }

    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      }
    }

    // 4. Query total count and paginated items
    const total = await this.db.payment.count({ where })

    const payments = await this.db.payment.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        application: {
          select: { status: true, reasonCode: true, appliedAt: true },
        },
        refundsViaPaymentId: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: {
            id: true,
            amount: true,
            status: true,
            purpose: true,
            createdAt: true,
            refundedAt: true,
          },
        },
        invoice: {
          select: { id: true, invoiceNo: true, revisionNo: true },
        },
      },
    })

    // 5. Serialize items accurately
    const items: RentalOrderPaymentHistoryItemDto[] = payments.map((payment) => {
      // Ground extension classification in actual extension requests or explicit extension invoice prefix
      const isExtension =
        (payment.invoice?.invoiceNo?.startsWith('RENTAL-EXT-') ?? false) ||
        extensionInvoiceIds.has(payment.invoiceId)
      const purpose = isExtension ? 'RENTAL_EXTENSION' : 'RENTAL_PAYMENT'

      return {
        paymentId: payment.id,
        paymentRef: payment.transactionRef ?? payment.merchantRequestRef ?? payment.id,
        invoiceId: payment.invoiceId,
        purpose,
        amount: new Prisma.Decimal(payment.amount).toFixed(2),
        currency: payment.currency,
        status: payment.status,
        applicationStatus: payment.application?.status ?? null,
        paymentMethod: payment.paymentMethod ?? null,
        paymentGateway: payment.paymentGateway,
        createdAt: payment.createdAt.toISOString(),
        paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
        refunds: payment.refundsViaPaymentId.map((refund) => ({
          refundId: refund.id,
          amount: new Prisma.Decimal(refund.amount).toFixed(2),
          status: refund.status,
          purpose: refund.purpose,
          createdAt: refund.createdAt.toISOString(),
          refundedAt: refund.refundedAt ? refund.refundedAt.toISOString() : null,
        })),
      }
    })

    return {
      orderId: rentalOrderId,
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
    }
  }

  /**
   * API 2 — My Transaction History Across Modules
   * Method: GET /api/v1/user/transactions
   *
   * Retrieves unified timeline of payments and refunds across all modules (Rental, Booking, Trail Access)
   * for the authenticated principal. Applies pagination on the combined dataset.
   */
  async getUserTransactions(input: {
    actorUserId: string
    query: UserTransactionsQueryDto
  }): Promise<UserTransactionsResponseDto> {
    const { actorUserId, query } = input
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const offset = (page - 1) * pageSize

    const validRefundStatuses = ['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED']

    // Build conditions for Payment
    const paymentConditions: Prisma.Sql[] = [Prisma.sql`i.user_id = ${actorUserId}::uuid`]
    if (query.source) {
      paymentConditions.push(Prisma.sql`i.invoice_type::text = ${query.source}`)
    }
    if (query.status) {
      paymentConditions.push(Prisma.sql`p.status::text = ${query.status}`)
    }
    if (query.from) {
      paymentConditions.push(Prisma.sql`p.created_at >= ${new Date(query.from)}`)
    }
    if (query.to) {
      paymentConditions.push(Prisma.sql`p.created_at <= ${new Date(query.to)}`)
    }

    // Build conditions for Refund
    const refundConditions: Prisma.Sql[] = [Prisma.sql`i.user_id = ${actorUserId}::uuid`]
    if (query.source) {
      refundConditions.push(Prisma.sql`i.invoice_type::text = ${query.source}`)
    }
    if (query.status) {
      if (validRefundStatuses.includes(query.status)) {
        refundConditions.push(Prisma.sql`r.status::text = ${query.status}`)
      } else {
        // e.g. status === 'EXPIRED', which can never match a refund
        refundConditions.push(Prisma.sql`1 = 0`)
      }
    }
    if (query.from) {
      refundConditions.push(Prisma.sql`r.created_at >= ${new Date(query.from)}`)
    }
    if (query.to) {
      refundConditions.push(Prisma.sql`r.created_at <= ${new Date(query.to)}`)
    }

    const paymentWhereClause = Prisma.join(paymentConditions, ' AND ')
    const refundWhereClause = Prisma.join(refundConditions, ' AND ')

    const paymentSelect = Prisma.sql`
      SELECT
        p.id::text AS id,
        'PAYMENT' AS kind,
        i.invoice_type::text AS source,
        CASE i.invoice_type::text
          WHEN 'RENTAL' THEN i.rental_order_id::text
          WHEN 'BOOKING' THEN i.booking_id::text
          WHEN 'TRAIL_ACCESS' THEN i.trail_access_id::text
          ELSE NULL
        END AS "sourceId",
        p.id::text AS "paymentId",
        NULL::text AS "refundId",
        i.id::text AS "invoiceId",
        p.amount::text AS amount,
        p.currency AS currency,
        p.status::text AS status,
        CASE WHEN p.status = 'SUCCEEDED' THEN 'DEBIT' ELSE 'NONE' END AS "financialEffect",
        p.payment_method AS "paymentMethod",
        p.created_at AS "createdAt",
        p.paid_at AS "completedAt",
        i.invoice_no AS "invoiceNo",
        i.revision_no AS "revisionNo",
        NULL::text AS "refundPurpose",
        CASE
          WHEN i.invoice_type::text = 'RENTAL' AND (
            i.invoice_no LIKE 'RENTAL-EXT-%' OR
            EXISTS (
              SELECT 1 FROM rental_extension_requests rer
              WHERE rer.invoice_id = i.id
            )
          ) THEN TRUE
          ELSE FALSE
        END AS "isExtension"
      FROM payments p
      JOIN invoices i ON i.id = p.invoice_id
      WHERE ${paymentWhereClause}
    `

    const refundSelect = Prisma.sql`
      SELECT
        r.id::text AS id,
        'REFUND' AS kind,
        i.invoice_type::text AS source,
        CASE i.invoice_type::text
          WHEN 'RENTAL' THEN 
            CASE 
              WHEN r.rental_order_id IS NOT NULL AND i.rental_order_id IS NOT NULL AND r.rental_order_id != i.rental_order_id THEN i.rental_order_id::text
              ELSE COALESCE(r.rental_order_id, i.rental_order_id)::text
            END
          WHEN 'BOOKING' THEN i.booking_id::text
          WHEN 'TRAIL_ACCESS' THEN 
            CASE 
              WHEN r.trail_access_id IS NOT NULL AND i.trail_access_id IS NOT NULL AND r.trail_access_id != i.trail_access_id THEN i.trail_access_id::text
              ELSE COALESCE(r.trail_access_id, i.trail_access_id)::text
            END
          ELSE NULL
        END AS "sourceId",
        p.id::text AS "paymentId",
        r.id::text AS "refundId",
        i.id::text AS "invoiceId",
        r.amount::text AS amount,
        r.currency AS currency,
        r.status::text AS status,
        CASE WHEN r.status = 'SUCCEEDED' THEN 'CREDIT' ELSE 'NONE' END AS "financialEffect",
        p.payment_method AS "paymentMethod",
        r.created_at AS "createdAt",
        r.refunded_at AS "completedAt",
        i.invoice_no AS "invoiceNo",
        i.revision_no AS "revisionNo",
        r.purpose::text AS "refundPurpose",
        FALSE AS "isExtension"
      FROM refunds r
      JOIN payments p ON p.id = r.payment_id
      JOIN invoices i ON i.id = p.invoice_id
      WHERE ${refundWhereClause}
    `

    let timelineSql: Prisma.Sql
    let countSql: Prisma.Sql

    if (query.kind === 'PAYMENT') {
      timelineSql = Prisma.sql`
        WITH timeline AS (${paymentSelect})
        SELECT * FROM timeline
        ORDER BY "createdAt" DESC, id DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `
      countSql = Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM payments p
        JOIN invoices i ON i.id = p.invoice_id
        WHERE ${paymentWhereClause}
      `
    } else if (query.kind === 'REFUND') {
      timelineSql = Prisma.sql`
        WITH timeline AS (${refundSelect})
        SELECT * FROM timeline
        ORDER BY "createdAt" DESC, id DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `
      countSql = Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM refunds r
        JOIN payments p ON p.id = r.payment_id
        JOIN invoices i ON i.id = p.invoice_id
        WHERE ${refundWhereClause}
      `
    } else {
      timelineSql = Prisma.sql`
        WITH timeline AS (
          ${paymentSelect}
          UNION ALL
          ${refundSelect}
        )
        SELECT * FROM timeline
        ORDER BY "createdAt" DESC, id DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `
      countSql = Prisma.sql`
        WITH timeline AS (
          SELECT p.id FROM payments p JOIN invoices i ON i.id = p.invoice_id WHERE ${paymentWhereClause}
          UNION ALL
          SELECT r.id FROM refunds r JOIN payments p ON p.id = r.payment_id JOIN invoices i ON i.id = p.invoice_id WHERE ${refundWhereClause}
        )
        SELECT COUNT(*)::int AS total FROM timeline
      `
    }

    const [rows, countResult] = await Promise.all([
      this.db.$queryRaw<RawTimelineRow[]>(timelineSql),
      this.db.$queryRaw<{ total: number }[]>(countSql),
    ])

    const total = countResult[0]?.total ?? 0

    const items: UserTransactionItemDto[] = rows.map((row) => {
      const description = this.formatDescription(row.kind, row.source, row.refundPurpose, row.isExtension)

      return {
        id: row.id,
        kind: row.kind,
        source: row.source,
        sourceId: row.sourceId,
        paymentId: row.paymentId,
        refundId: row.refundId,
        invoiceId: row.invoiceId,
        amount: new Prisma.Decimal(row.amount).toFixed(2),
        currency: row.currency,
        status: row.status,
        financialEffect: row.financialEffect,
        description,
        paymentMethod: row.paymentMethod ?? null,
        createdAt: new Date(row.createdAt).toISOString(),
        completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
      }
    })

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
    }
  }

  private formatDescription(
    kind: TransactionKind,
    source: TransactionSource,
    purpose?: string | null,
    isExtension?: boolean,
  ): string {
    if (kind === 'PAYMENT') {
      switch (source) {
        case 'RENTAL':
          return isExtension ? 'Thanh toán gia hạn thuê thiết bị' : 'Thanh toán đơn thuê thiết bị'
        case 'BOOKING':
          return 'Thanh toán đơn đặt chỗ chuyến đi'
        case 'TRAIL_ACCESS':
          return 'Thanh toán quyền truy cập cung đường'
        default:
          return 'Thanh toán giao dịch'
      }
    } else {
      switch (purpose) {
        case 'DEPOSIT':
          return 'Hoàn cọc thuê thiết bị'
        case 'RENTAL_CANCELLATION':
          return 'Hoàn tiền huỷ đơn thuê thiết bị'
        case 'BOOKING_CANCELLATION':
          return 'Hoàn tiền huỷ đặt chỗ chuyến đi'
        case 'TRAIL_ACCESS':
          return 'Hoàn tiền quyền truy cập cung đường'
        case 'TECHNICAL_REVERSAL':
          return 'Hoàn tiền giao dịch kỹ thuật'
        default:
          switch (source) {
            case 'RENTAL':
              return 'Hoàn tiền đơn thuê thiết bị'
            case 'BOOKING':
              return 'Hoàn tiền đơn đặt chỗ chuyến đi'
            case 'TRAIL_ACCESS':
              return 'Hoàn tiền quyền truy cập cung đường'
            default:
              return 'Hoàn tiền giao dịch'
          }
      }
    }
  }
}
