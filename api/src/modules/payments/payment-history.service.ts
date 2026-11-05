import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../shared/services/prisma.service'
import { AppError, PAYMENT_ERROR_CODES, RENTAL_ORDERING_ERROR_CODES as RO } from '../../shared/errors'
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
import {
  resolveAllowedGateways,
  type AdminCashflowSummaryQueryDto,
  type AdminCashflowSummaryResponseDto,
  type AdminGatewayFilter,
  type AdminPaymentDetailResponseDto,
  type AdminRefundDetailResponseDto,
  type AdminTransactionBreakdownDto,
  type AdminTransactionCategory,
  type AdminTransactionDirection,
  type AdminTransactionItemDto,
  type AdminTransactionsQueryDto,
  type AdminTransactionsResponseDto,
  type SupportedAdminGateway,
} from './dtos/admin-cashflow.dto'

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
  executionMode: string | null
  confirmationSource: string | null
  refundPurpose: string | null
  isExtension: boolean
}

interface RawAdminTimelineRow extends RawTimelineRow {
  userId: string
  userFullName: string | null
  userEmail: string
  paymentGateway: string | null
  providerEnvironment?: string | null
  transactionRef: string | null
  payosOrderCode?: string | null
  reconcileStatus: string
  reconciliationRequired: boolean
  manualRefundStatus?: string | null
  serviceFeeAmount?: string | null
  rentalFeeAmount?: string | null
  depositAmount?: string | null
  deductionAmount?: string | null
}

interface RawCashflowBucketRow {
  bucket: string
  inflowAmount: string
  inflowCount: number
  outflowAmount: string
  outflowCount: number
  serviceFeeAmount?: string
  depositCollectedAmount?: string
  depositRefundedAmount?: string
  retainedDeductionAmount?: string
}

interface RawCashflowTotalsRow {
  totalInflowAmount: string
  totalInflowCount: number
  totalOutflowAmount: string
  totalOutflowCount: number
  pendingInflowAmount: string
  pendingInflowCount: number
  pendingOutflowAmount: string
  pendingOutflowCount: number
  reconciliationRequiredCount: number
  bookingInflowAmount?: string
  rentalFeeInflowAmount?: string
  rentalExtensionInflowAmount?: string
  rentalDepositInflowAmount?: string
  trailAccessInflowAmount?: string
  depositOutflowAmount?: string
  bookingCancellationOutflowAmount?: string
  rentalCancellationOutflowAmount?: string
  technicalReversalOutflowAmount?: string
  retainedDepositDeductionAmount?: string
  payosManualRefundPendingCount?: number
  vnpaySandboxPendingRefundCount?: number
}

function normalizeSupportedGateway(raw: string | null | undefined): SupportedAdminGateway | null {
  const lower = (raw ?? '').trim().toLowerCase()
  if (lower === 'vnpay') return 'vnpay'
  return null
}

function buildVietQrUrl(params: {
  bankBin: string | null | undefined
  accountNumber: string | null | undefined
  accountHolderName: string | null | undefined
  amount: Prisma.Decimal | string
  invoiceNo: string | null | undefined
  refundId: string
}): string | null {
  const { bankBin, accountNumber, accountHolderName, amount, invoiceNo, refundId } = params
  if (!bankBin || !accountNumber) return null
  const amountInt = new Prisma.Decimal(amount).toFixed(0)
  const addInfo = encodeURIComponent(`HOAN TIEN ${invoiceNo ?? refundId.slice(0, 8)}`)
  const accountName = accountHolderName ? `&accountName=${encodeURIComponent(accountHolderName)}` : ''
  return `https://img.vietqr.io/image/${encodeURIComponent(bankBin)}-${encodeURIComponent(accountNumber)}-compact2.png?amount=${amountInt}&addInfo=${addInfo}${accountName}`
}

@Injectable()
export class PaymentHistoryService {
  constructor(private readonly db: PrismaService) { }

  private simulationDisclosure(mode: string | null, confirmation: string | null) {
    return mode === 'SANDBOX_SIMULATED' || confirmation === 'SANDBOX_SIMULATION'
      ? { settlementMode: 'SANDBOX_SIMULATED' as const, warnings: ['TEST_ONLY', 'NO_REAL_MONEY_RETURNED'] }
      : {}
  }

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
            executionMode: true,
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
          executionMode: refund.executionMode,
          confirmationSource:
            refund.executionMode === 'MANUAL_BANK_TRANSFER' && refund.status === 'SUCCEEDED'
              ? 'ADMIN_MANUAL'
              : null,
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
        NULL::text AS "executionMode",
        NULL::text AS "confirmationSource",
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
        r.execution_mode::text AS "executionMode",
        CASE WHEN r.status = 'SUCCEEDED' AND (r.provider_payload -> 'sandboxSimulation') IS NOT NULL THEN 'SANDBOX_SIMULATION'
          WHEN r.execution_mode = 'MANUAL_BANK_TRANSFER' AND r.status = 'SUCCEEDED' THEN 'ADMIN_MANUAL' ELSE NULL END AS "confirmationSource",
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
      const description = this.formatDescription(
        row.kind,
        row.source,
        row.refundPurpose,
        row.isExtension,
      )

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
        executionMode: row.executionMode ?? null,
        confirmationSource: row.confirmationSource ?? null,
        ...this.simulationDisclosure(row.executionMode, row.confirmationSource),
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

  /**
   * API 3 — Admin System-Wide Transaction Ledger (VNPay & PayOS)
   * Method: GET /api/v1/admin/transactions
   *
   * Retrieves unified timeline of all payments (Cash-In) and refunds (Cash-Out) across
   * BOOKING, RENTAL (with rental fee, extension, deposit, deduction breakdown), and TRAIL_ACCESS.
   * VNPay SANDBOX only; ALL/BOTH are aliases. Refund entries require simulation provenance or mode.
   */
  async getAdminTransactions(input: {
    query: AdminTransactionsQueryDto
  }): Promise<AdminTransactionsResponseDto> {
    const { query } = input
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const offset = (page - 1) * pageSize
    const gatewayFilter: AdminGatewayFilter = query.gateway ?? 'vnpay'
    const allowedGateways = resolveAllowedGateways(gatewayFilter)
    const gatewaySqlList = Prisma.join(allowedGateways.map((g) => Prisma.sql`${g}`))

    const effectiveKind: TransactionKind | undefined =
      query.kind ??
      (query.direction === 'CASH_IN'
        ? 'PAYMENT'
        : query.direction === 'CASH_OUT'
          ? 'REFUND'
          : undefined)

    const validRefundStatuses = ['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED']

    const isExtensionExpr = Prisma.sql`(
      i.invoice_no LIKE 'RENTAL-EXT-%' OR
      EXISTS (
        SELECT 1 FROM rental_extension_requests rer
        WHERE rer.invoice_id = i.id
      )
    )`

    const paymentConditions: Prisma.Sql[] = [
      Prisma.sql`LOWER(p.payment_gateway) IN (${gatewaySqlList})`,
      Prisma.sql`p.provider_environment = 'SANDBOX'`,
    ]
    const refundConditions: Prisma.Sql[] = [
      Prisma.sql`LOWER(COALESCE(r.payment_gateway, p.payment_gateway)) IN (${gatewaySqlList})`,
      Prisma.sql`p.payment_gateway = 'vnpay' AND p.provider_environment = 'SANDBOX' AND p.status = 'SUCCEEDED'`,
      Prisma.sql`r.payment_gateway = 'vnpay' AND r.provider_environment = 'SANDBOX'`,
      Prisma.sql`(r.execution_mode::text = 'SANDBOX_SIMULATED' OR (r.provider_payload -> 'sandboxSimulation') IS NOT NULL)`,
    ]

    if (query.userId) {
      paymentConditions.push(Prisma.sql`i.user_id = ${query.userId}::uuid`)
      refundConditions.push(Prisma.sql`i.user_id = ${query.userId}::uuid`)
    }
    if (query.source) {
      paymentConditions.push(Prisma.sql`i.invoice_type::text = ${query.source}`)
      refundConditions.push(Prisma.sql`i.invoice_type::text = ${query.source}`)
    }
    if (query.status) {
      paymentConditions.push(Prisma.sql`p.status::text = ${query.status}`)
      if (validRefundStatuses.includes(query.status)) {
        refundConditions.push(Prisma.sql`r.status::text = ${query.status}`)
      } else {
        refundConditions.push(Prisma.sql`1 = 0`)
      }
    }
    if (query.reconcileStatus) {
      paymentConditions.push(Prisma.sql`p.reconcile_status::text = ${query.reconcileStatus}`)
      refundConditions.push(Prisma.sql`r.reconcile_status::text = ${query.reconcileStatus}`)
    }
    if (query.executionMode) {
      paymentConditions.push(Prisma.sql`1 = 0`)
      refundConditions.push(Prisma.sql`r.execution_mode::text = ${query.executionMode}`)
    }
    if (query.manualStatus) {
      paymentConditions.push(Prisma.sql`1 = 0`)
      refundConditions.push(Prisma.sql`mr.status::text = ${query.manualStatus}`)
    }
    if (query.category) {
      if (query.category === 'BOOKING_PAYMENT') {
        paymentConditions.push(Prisma.sql`i.invoice_type::text = 'BOOKING'`)
        refundConditions.push(Prisma.sql`1 = 0`)
      } else if (query.category === 'RENTAL_INITIAL') {
        paymentConditions.push(Prisma.sql`i.invoice_type::text = 'RENTAL' AND NOT ${isExtensionExpr}`)
        refundConditions.push(Prisma.sql`1 = 0`)
      } else if (query.category === 'RENTAL_EXTENSION') {
        paymentConditions.push(Prisma.sql`i.invoice_type::text = 'RENTAL' AND ${isExtensionExpr}`)
        refundConditions.push(Prisma.sql`1 = 0`)
      } else if (query.category === 'TRAIL_PURCHASE') {
        paymentConditions.push(Prisma.sql`i.invoice_type::text = 'TRAIL_ACCESS'`)
        refundConditions.push(Prisma.sql`1 = 0`)
      } else if (query.category === 'DEPOSIT_REFUND') {
        paymentConditions.push(Prisma.sql`1 = 0`)
        refundConditions.push(Prisma.sql`r.purpose::text = 'DEPOSIT'`)
      } else if (query.category === 'BOOKING_CANCEL_REFUND') {
        paymentConditions.push(Prisma.sql`1 = 0`)
        refundConditions.push(Prisma.sql`r.purpose::text = 'BOOKING_CANCELLATION'`)
      } else if (query.category === 'RENTAL_CANCEL_REFUND') {
        paymentConditions.push(Prisma.sql`1 = 0`)
        refundConditions.push(Prisma.sql`r.purpose::text = 'RENTAL_CANCELLATION'`)
      } else if (query.category === 'TRAIL_REFUND') {
        paymentConditions.push(Prisma.sql`1 = 0`)
        refundConditions.push(Prisma.sql`r.purpose::text = 'TRAIL_ACCESS'`)
      } else if (query.category === 'TECHNICAL_REVERSAL') {
        paymentConditions.push(Prisma.sql`1 = 0`)
        refundConditions.push(Prisma.sql`r.purpose::text = 'TECHNICAL_REVERSAL'`)
      }
    }
    if (query.search) {
      const pattern = `%${query.search}%`
      paymentConditions.push(
        Prisma.sql`(
          i.invoice_no ILIKE ${pattern}
          OR p.id::text ILIKE ${pattern}
          OR COALESCE(p.transaction_ref, '') ILIKE ${pattern}
          OR COALESCE(p.merchant_request_ref, '') ILIKE ${pattern}
          OR COALESCE(pc.order_code::text, '') ILIKE ${pattern}
          OR COALESCE(u.full_name, '') ILIKE ${pattern}
          OR u.email ILIKE ${pattern}
          OR COALESCE(u.phone, '') ILIKE ${pattern}
        )`,
      )
      refundConditions.push(
        Prisma.sql`(
          i.invoice_no ILIKE ${pattern}
          OR r.id::text ILIKE ${pattern}
          OR p.id::text ILIKE ${pattern}
          OR COALESCE(r.refund_transaction_ref, '') ILIKE ${pattern}
          OR COALESCE(r.merchant_refund_ref, '') ILIKE ${pattern}
          OR COALESCE(p.transaction_ref, '') ILIKE ${pattern}
          OR COALESCE(pc.order_code::text, '') ILIKE ${pattern}
          OR COALESCE(u.full_name, '') ILIKE ${pattern}
          OR u.email ILIKE ${pattern}
          OR COALESCE(u.phone, '') ILIKE ${pattern}
        )`,
      )
    }
    if (query.from) {
      paymentConditions.push(Prisma.sql`p.created_at >= ${new Date(query.from)}`)
      refundConditions.push(Prisma.sql`r.created_at >= ${new Date(query.from)}`)
    }
    if (query.to) {
      paymentConditions.push(Prisma.sql`p.created_at <= ${new Date(query.to)}`)
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
        i.user_id::text AS "userId",
        u.full_name AS "userFullName",
        u.email AS "userEmail",
        p.amount::text AS amount,
        p.currency AS currency,
        p.status::text AS status,
        CASE WHEN p.status = 'SUCCEEDED' THEN 'DEBIT' ELSE 'NONE' END AS "financialEffect",
        LOWER(p.payment_gateway) AS "paymentGateway",
        p.provider_environment::text AS "providerEnvironment",
        p.payment_method AS "paymentMethod",
        p.transaction_ref AS "transactionRef",
        pc.order_code::text AS "payosOrderCode",
        p.reconcile_status::text AS "reconcileStatus",
        (p.reconcile_status IN ('NEEDS_REVIEW', 'SCHEDULED', 'RUNNING')) AS "reconciliationRequired",
        p.created_at AS "createdAt",
        p.paid_at AS "completedAt",
        i.invoice_no AS "invoiceNo",
        i.revision_no AS "revisionNo",
        NULL::text AS "refundPurpose",
        NULL::text AS "executionMode",
        NULL::text AS "confirmationSource",
        NULL::text AS "manualRefundStatus",
        CASE
          WHEN i.invoice_type::text = 'RENTAL' AND ${isExtensionExpr} THEN TRUE
          ELSE FALSE
        END AS "isExtension",
        CASE
          WHEN i.invoice_type::text = 'RENTAL' AND NOT ${isExtensionExpr} THEN
            COALESCE(
              (SELECT SUM(pa.amount) FROM payment_allocations pa WHERE pa.payment_id = p.id AND pa.component = 'RENTAL_FEE'),
              (SELECT ro.rental_fee FROM rental_orders ro WHERE ro.id = i.rental_order_id),
              p.amount
            )::text
          ELSE p.amount::text
        END AS "serviceFeeAmount",
        CASE
          WHEN i.invoice_type::text = 'RENTAL' AND ${isExtensionExpr} THEN p.amount::text
          WHEN i.invoice_type::text = 'RENTAL' THEN
            COALESCE(
              (SELECT SUM(pa.amount) FROM payment_allocations pa WHERE pa.payment_id = p.id AND pa.component = 'RENTAL_FEE'),
              (SELECT ro.rental_fee FROM rental_orders ro WHERE ro.id = i.rental_order_id),
              p.amount
            )::text
          ELSE '0'::text
        END AS "rentalFeeAmount",
        CASE
          WHEN i.invoice_type::text = 'RENTAL' AND NOT ${isExtensionExpr} THEN
            COALESCE(
              (SELECT SUM(pa.amount) FROM payment_allocations pa WHERE pa.payment_id = p.id AND pa.component = 'RENTAL_DEPOSIT'),
              (SELECT ro.total_deposit FROM rental_orders ro WHERE ro.id = i.rental_order_id),
              0
            )::text
          ELSE '0'::text
        END AS "depositAmount",
        '0'::text AS "deductionAmount"
      FROM payments p
      JOIN invoices i ON i.id = p.invoice_id
      JOIN users u ON u.id = i.user_id
      LEFT JOIN payos_checkouts pc ON pc.payment_id = p.id
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
        i.user_id::text AS "userId",
        u.full_name AS "userFullName",
        u.email AS "userEmail",
        r.amount::text AS amount,
        r.currency AS currency,
        r.status::text AS status,
        CASE WHEN r.status = 'SUCCEEDED' THEN 'CREDIT' ELSE 'NONE' END AS "financialEffect",
        LOWER(COALESCE(r.payment_gateway, p.payment_gateway)) AS "paymentGateway",
        COALESCE(r.provider_environment, p.provider_environment)::text AS "providerEnvironment",
        p.payment_method AS "paymentMethod",
        r.refund_transaction_ref AS "transactionRef",
        pc.order_code::text AS "payosOrderCode",
        r.reconcile_status::text AS "reconcileStatus",
        (
          r.reconcile_status IN ('NEEDS_REVIEW', 'SCHEDULED', 'RUNNING')
          OR mr.status = 'NEEDS_REVIEW'
        ) AS "reconciliationRequired",
        r.created_at AS "createdAt",
        r.refunded_at AS "completedAt",
        i.invoice_no AS "invoiceNo",
        i.revision_no AS "revisionNo",
        r.purpose::text AS "refundPurpose",
        r.execution_mode::text AS "executionMode",
        CASE
          WHEN r.status = 'SUCCEEDED' AND (r.provider_payload -> 'sandboxSimulation') IS NOT NULL THEN 'SANDBOX_SIMULATION'
          WHEN r.execution_mode = 'MANUAL_BANK_TRANSFER' AND r.status = 'SUCCEEDED' THEN 'ADMIN_MANUAL'
          WHEN r.execution_mode = 'PROVIDER_API' AND r.status = 'SUCCEEDED' THEN 'PROVIDER'
          ELSE NULL
        END AS "confirmationSource",
        mr.status::text AS "manualRefundStatus",
        FALSE AS "isExtension",
        CASE
          WHEN r.purpose = 'DEPOSIT' THEN '0'::text
          WHEN r.purpose = 'RENTAL_CANCELLATION' THEN
            COALESCE(
              (
                SELECT SUM(ra.amount)
                FROM refund_allocations ra
                JOIN payment_allocations pa ON pa.id = ra.payment_allocation_id
                WHERE ra.refund_id = r.id AND pa.component = 'RENTAL_FEE'
              ),
              0
            )::text
          ELSE r.amount::text
        END AS "serviceFeeAmount",
        CASE
          WHEN r.purpose = 'RENTAL_CANCELLATION' THEN
            COALESCE(
              (
                SELECT SUM(ra.amount)
                FROM refund_allocations ra
                JOIN payment_allocations pa ON pa.id = ra.payment_allocation_id
                WHERE ra.refund_id = r.id AND pa.component = 'RENTAL_FEE'
              ),
              0
            )::text
          ELSE '0'::text
        END AS "rentalFeeAmount",
        CASE
          WHEN r.purpose = 'DEPOSIT' THEN
            COALESCE(
              (SELECT dsi.deposit_amount FROM deposit_settlement_items dsi WHERE dsi.id = r.deposit_settlement_item_id),
              (SELECT ds.total_deposit FROM deposit_settlements ds WHERE ds.id = r.deposit_settlement_id),
              r.amount
            )::text
          WHEN r.purpose = 'RENTAL_CANCELLATION' THEN
            COALESCE(
              (
                SELECT SUM(ra.amount)
                FROM refund_allocations ra
                JOIN payment_allocations pa ON pa.id = ra.payment_allocation_id
                WHERE ra.refund_id = r.id AND pa.component = 'RENTAL_DEPOSIT'
              ),
              r.amount
            )::text
          ELSE '0'::text
        END AS "depositAmount",
        CASE
          WHEN r.purpose = 'DEPOSIT' THEN
            COALESCE(
              (SELECT dsi.deduction_amount FROM deposit_settlement_items dsi WHERE dsi.id = r.deposit_settlement_item_id),
              (SELECT ds.total_deduction FROM deposit_settlements ds WHERE ds.id = r.deposit_settlement_id),
              0
            )::text
          WHEN r.purpose IN ('BOOKING_CANCELLATION', 'RENTAL_CANCELLATION') THEN
            GREATEST(0, p.amount - r.amount)::text
          ELSE '0'::text
        END AS "deductionAmount"
      FROM refunds r
      JOIN payments p ON p.id = r.payment_id
      JOIN invoices i ON i.id = p.invoice_id
      JOIN users u ON u.id = i.user_id
      LEFT JOIN manual_refunds mr ON mr.refund_id = r.id
      LEFT JOIN payos_checkouts pc ON pc.payment_id = p.id
      WHERE ${refundWhereClause}
    `

    let timelineSql: Prisma.Sql
    let countSql: Prisma.Sql

    if (effectiveKind === 'PAYMENT') {
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
        JOIN users u ON u.id = i.user_id
        LEFT JOIN payos_checkouts pc ON pc.payment_id = p.id
        WHERE ${paymentWhereClause}
      `
    } else if (effectiveKind === 'REFUND') {
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
        JOIN users u ON u.id = i.user_id
        LEFT JOIN manual_refunds mr ON mr.refund_id = r.id
        LEFT JOIN payos_checkouts pc ON pc.payment_id = p.id
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
          SELECT p.id FROM payments p JOIN invoices i ON i.id = p.invoice_id JOIN users u ON u.id = i.user_id LEFT JOIN payos_checkouts pc ON pc.payment_id = p.id WHERE ${paymentWhereClause}
          UNION ALL
          SELECT r.id FROM refunds r JOIN payments p ON p.id = r.payment_id JOIN invoices i ON i.id = p.invoice_id JOIN users u ON u.id = i.user_id LEFT JOIN manual_refunds mr ON mr.refund_id = r.id LEFT JOIN payos_checkouts pc ON pc.payment_id = p.id WHERE ${refundWhereClause}
        )
        SELECT COUNT(*)::int AS total FROM timeline
      `
    }

    const [rows, countResult] = await Promise.all([
      this.db.$queryRaw<RawAdminTimelineRow[]>(timelineSql),
      this.db.$queryRaw<{ total: number }[]>(countSql),
    ])

    const total = countResult[0]?.total ?? 0

    const items: AdminTransactionItemDto[] = rows.map((row) => {
      const amountFixed = new Prisma.Decimal(row.amount).toFixed(2)
      const isExt = Boolean(row.isExtension)
      const direction: AdminTransactionDirection = row.kind === 'PAYMENT' ? 'CASH_IN' : 'CASH_OUT'
      const category = this.resolveCategory(row.kind, row.source, row.refundPurpose, isExt)

      const defaultServiceFee =
        row.kind === 'REFUND' && row.refundPurpose === 'DEPOSIT' ? '0.00' : amountFixed
      const defaultRentalFee =
        row.kind === 'PAYMENT' && row.source === 'RENTAL' ? amountFixed : '0.00'
      const defaultDeposit =
        row.kind === 'REFUND' && row.refundPurpose === 'DEPOSIT' ? amountFixed : '0.00'

      const breakdown: AdminTransactionBreakdownDto = {
        serviceFeeAmount:
          row.serviceFeeAmount !== undefined && row.serviceFeeAmount !== null
            ? new Prisma.Decimal(row.serviceFeeAmount).toFixed(2)
            : defaultServiceFee,
        rentalFeeAmount:
          row.rentalFeeAmount !== undefined && row.rentalFeeAmount !== null
            ? new Prisma.Decimal(row.rentalFeeAmount).toFixed(2)
            : defaultRentalFee,
        depositAmount:
          row.depositAmount !== undefined && row.depositAmount !== null
            ? new Prisma.Decimal(row.depositAmount).toFixed(2)
            : defaultDeposit,
        deductionAmount:
          row.deductionAmount !== undefined && row.deductionAmount !== null
            ? new Prisma.Decimal(row.deductionAmount).toFixed(2)
            : '0.00',
        isExtension: isExt,
      }

      const gw = row.paymentGateway?.toLowerCase() ?? null
      const env =
        row.providerEnvironment ??
        (gw === 'payos' ? 'PRODUCTION' : gw === 'vnpay' ? 'SANDBOX' : null)
      const canSimulateSandbox =
        row.kind === 'REFUND' &&
        gw === 'vnpay' &&
        env === 'SANDBOX' &&
        ['SANDBOX_SIMULATED', 'PROVIDER_API'].includes(row.executionMode ?? 'PROVIDER_API') &&
        (row.status === 'PENDING' || row.status === 'PROCESSING')

      return {
        id: row.id,
        kind: row.kind,
        direction,
        category,
        source: row.source,
        sourceId: row.sourceId,
        paymentId: row.paymentId,
        refundId: row.refundId,
        invoiceId: row.invoiceId,
        invoiceNo: row.invoiceNo ?? null,
        user: {
          id: row.userId,
          fullName: row.userFullName ?? null,
          email: row.userEmail,
        },
        amount: amountFixed,
        currency: row.currency,
        breakdown,
        status: row.status,
        financialEffect: row.financialEffect,
        paymentGateway: row.paymentGateway ?? null,
        providerEnvironment: env,
        paymentMethod: row.paymentMethod ?? null,
        transactionRef: row.transactionRef ?? null,
        payosOrderCode: null,
        reconcileStatus: row.reconcileStatus,
        reconciliationRequired: Boolean(row.reconciliationRequired),
        executionMode: row.executionMode ?? null,
        confirmationSource: row.confirmationSource ?? null,
        ...this.simulationDisclosure(row.executionMode, row.confirmationSource),
        refundPurpose: row.refundPurpose ?? null,
        manualRefundStatus: row.manualRefundStatus ?? null,
        canSimulateSandbox,
        description: this.formatDescription(row.kind, row.source, row.refundPurpose, isExt),
        createdAt: new Date(row.createdAt).toISOString(),
        completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
      }
    })

    return {
      appliedFilters: {
        gateway: gatewayFilter,
        gatewaysIncluded: allowedGateways,
        source: query.source ?? null,
        kind: effectiveKind ?? null,
        category: query.category ?? null,
        status: query.status ?? null,
      },
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
   * API 4 — Admin Cashflow Summary (VNPay SANDBOX)
   * Method: GET /api/v1/admin/cashflow/summary (and alias GET /api/v1/admin/transactions/summary)
   *
   * Aggregates system-wide inflows (SUCCEEDED payments), outflows (SUCCEEDED refunds),
   * pending amounts, reconciliation backlog, and breakdowns by source within the same sandbox scope.
   */
  async getAdminCashflowSummary(input: {
    query: AdminCashflowSummaryQueryDto
  }): Promise<AdminCashflowSummaryResponseDto> {
    const { query } = input
    const gatewayFilter: AdminGatewayFilter = query.gateway ?? 'vnpay'
    const allowedGateways = resolveAllowedGateways(gatewayFilter)
    const gatewaySqlList = Prisma.join(allowedGateways.map((g) => Prisma.sql`${g}`))

    const isExtensionExpr = Prisma.sql`(
      i.invoice_no LIKE 'RENTAL-EXT-%' OR
      EXISTS (
        SELECT 1 FROM rental_extension_requests rer
        WHERE rer.invoice_id = i.id
      )
    )`

    const paymentConditions: Prisma.Sql[] = [
      Prisma.sql`LOWER(p.payment_gateway) IN (${gatewaySqlList})`,
      Prisma.sql`p.provider_environment = 'SANDBOX'`,
    ]
    const refundConditions: Prisma.Sql[] = [
      Prisma.sql`LOWER(COALESCE(r.payment_gateway, p.payment_gateway)) IN (${gatewaySqlList})`,
      Prisma.sql`p.payment_gateway = 'vnpay' AND p.provider_environment = 'SANDBOX' AND p.status = 'SUCCEEDED'`,
      Prisma.sql`r.payment_gateway = 'vnpay' AND r.provider_environment = 'SANDBOX'`,
      Prisma.sql`(r.execution_mode::text = 'SANDBOX_SIMULATED' OR (r.provider_payload -> 'sandboxSimulation') IS NOT NULL)`,
    ]

    if (query.source) {
      paymentConditions.push(Prisma.sql`i.invoice_type::text = ${query.source}`)
      refundConditions.push(Prisma.sql`i.invoice_type::text = ${query.source}`)
    }
    if (query.from) {
      paymentConditions.push(Prisma.sql`p.created_at >= ${new Date(query.from)}`)
      refundConditions.push(Prisma.sql`r.created_at >= ${new Date(query.from)}`)
    }
    if (query.to) {
      paymentConditions.push(Prisma.sql`p.created_at <= ${new Date(query.to)}`)
      refundConditions.push(Prisma.sql`r.created_at <= ${new Date(query.to)}`)
    }

    const paymentWhere = Prisma.join(paymentConditions, ' AND ')
    const refundWhere = Prisma.join(refundConditions, ' AND ')

    const totalsSql = Prisma.sql`
      SELECT
        COALESCE((
          SELECT SUM(p.amount) FROM payments p JOIN invoices i ON i.id = p.invoice_id
          WHERE ${paymentWhere} AND p.status = 'SUCCEEDED'
        ), 0)::text AS "totalInflowAmount",
        COALESCE((
          SELECT COUNT(*)::int FROM payments p JOIN invoices i ON i.id = p.invoice_id
          WHERE ${paymentWhere} AND p.status = 'SUCCEEDED'
        ), 0) AS "totalInflowCount",
        COALESCE((
          SELECT SUM(r.amount) FROM refunds r JOIN payments p ON p.id = r.payment_id JOIN invoices i ON i.id = p.invoice_id
          WHERE ${refundWhere} AND r.status = 'SUCCEEDED'
        ), 0)::text AS "totalOutflowAmount",
        COALESCE((
          SELECT COUNT(*)::int FROM refunds r JOIN payments p ON p.id = r.payment_id JOIN invoices i ON i.id = p.invoice_id
          WHERE ${refundWhere} AND r.status = 'SUCCEEDED'
        ), 0) AS "totalOutflowCount",
        COALESCE((
          SELECT SUM(p.amount) FROM payments p JOIN invoices i ON i.id = p.invoice_id
          WHERE ${paymentWhere} AND p.status IN ('PENDING', 'PROCESSING')
        ), 0)::text AS "pendingInflowAmount",
        COALESCE((
          SELECT COUNT(*)::int FROM payments p JOIN invoices i ON i.id = p.invoice_id
          WHERE ${paymentWhere} AND p.status IN ('PENDING', 'PROCESSING')
        ), 0) AS "pendingInflowCount",
        COALESCE((
          SELECT SUM(r.amount) FROM refunds r JOIN payments p ON p.id = r.payment_id JOIN invoices i ON i.id = p.invoice_id
          WHERE ${refundWhere} AND r.status IN ('PENDING', 'PROCESSING')
        ), 0)::text AS "pendingOutflowAmount",
        COALESCE((
          SELECT COUNT(*)::int FROM refunds r JOIN payments p ON p.id = r.payment_id JOIN invoices i ON i.id = p.invoice_id
          WHERE ${refundWhere} AND r.status IN ('PENDING', 'PROCESSING')
        ), 0) AS "pendingOutflowCount",
        (
          COALESCE((
            SELECT COUNT(*)::int FROM payments p JOIN invoices i ON i.id = p.invoice_id
            WHERE ${paymentWhere} AND p.reconcile_status = 'NEEDS_REVIEW'
          ), 0) +
          COALESCE((
            SELECT COUNT(*)::int FROM refunds r JOIN payments p ON p.id = r.payment_id JOIN invoices i ON i.id = p.invoice_id LEFT JOIN manual_refunds mr ON mr.refund_id = r.id
            WHERE ${refundWhere} AND (r.reconcile_status = 'NEEDS_REVIEW' OR mr.status = 'NEEDS_REVIEW')
          ), 0)
        ) AS "reconciliationRequiredCount",
        COALESCE((
          SELECT SUM(p.amount) FROM payments p JOIN invoices i ON i.id = p.invoice_id
          WHERE ${paymentWhere} AND p.status = 'SUCCEEDED' AND i.invoice_type = 'BOOKING'
        ), 0)::text AS "bookingInflowAmount",
        COALESCE((
          SELECT SUM(
            COALESCE(
              (SELECT SUM(pa.amount) FROM payment_allocations pa WHERE pa.payment_id = p.id AND pa.component = 'RENTAL_FEE'),
              (SELECT ro.rental_fee FROM rental_orders ro WHERE ro.id = i.rental_order_id),
              p.amount
            )
          )
          FROM payments p JOIN invoices i ON i.id = p.invoice_id
          WHERE ${paymentWhere} AND p.status = 'SUCCEEDED' AND i.invoice_type = 'RENTAL' AND NOT ${isExtensionExpr}
        ), 0)::text AS "rentalFeeInflowAmount",
        COALESCE((
          SELECT SUM(p.amount) FROM payments p JOIN invoices i ON i.id = p.invoice_id
          WHERE ${paymentWhere} AND p.status = 'SUCCEEDED' AND i.invoice_type = 'RENTAL' AND ${isExtensionExpr}
        ), 0)::text AS "rentalExtensionInflowAmount",
        COALESCE((
          SELECT SUM(
            COALESCE(
              (SELECT SUM(pa.amount) FROM payment_allocations pa WHERE pa.payment_id = p.id AND pa.component = 'RENTAL_DEPOSIT'),
              (SELECT ro.total_deposit FROM rental_orders ro WHERE ro.id = i.rental_order_id),
              0
            )
          )
          FROM payments p JOIN invoices i ON i.id = p.invoice_id
          WHERE ${paymentWhere} AND p.status = 'SUCCEEDED' AND i.invoice_type = 'RENTAL' AND NOT ${isExtensionExpr}
        ), 0)::text AS "rentalDepositInflowAmount",
        COALESCE((
          SELECT SUM(p.amount) FROM payments p JOIN invoices i ON i.id = p.invoice_id
          WHERE ${paymentWhere} AND p.status = 'SUCCEEDED' AND i.invoice_type = 'TRAIL_ACCESS'
        ), 0)::text AS "trailAccessInflowAmount",
        COALESCE((
          SELECT SUM(r.amount) FROM refunds r JOIN payments p ON p.id = r.payment_id JOIN invoices i ON i.id = p.invoice_id
          WHERE ${refundWhere} AND r.status = 'SUCCEEDED' AND r.purpose = 'DEPOSIT'
        ), 0)::text AS "depositOutflowAmount",
        COALESCE((
          SELECT SUM(r.amount) FROM refunds r JOIN payments p ON p.id = r.payment_id JOIN invoices i ON i.id = p.invoice_id
          WHERE ${refundWhere} AND r.status = 'SUCCEEDED' AND r.purpose = 'BOOKING_CANCELLATION'
        ), 0)::text AS "bookingCancellationOutflowAmount",
        COALESCE((
          SELECT SUM(r.amount) FROM refunds r JOIN payments p ON p.id = r.payment_id JOIN invoices i ON i.id = p.invoice_id
          WHERE ${refundWhere} AND r.status = 'SUCCEEDED' AND r.purpose = 'RENTAL_CANCELLATION'
        ), 0)::text AS "rentalCancellationOutflowAmount",
        COALESCE((
          SELECT SUM(r.amount) FROM refunds r JOIN payments p ON p.id = r.payment_id JOIN invoices i ON i.id = p.invoice_id
          WHERE ${refundWhere} AND r.status = 'SUCCEEDED' AND r.purpose = 'TECHNICAL_REVERSAL'
        ), 0)::text AS "technicalReversalOutflowAmount",
        COALESCE((
          SELECT SUM(ds.total_deduction)
          FROM deposit_settlements ds
          WHERE EXISTS (
            SELECT 1 FROM payments p JOIN invoices i ON i.id = p.invoice_id
            WHERE ${paymentWhere} AND p.status = 'SUCCEEDED' AND i.rental_order_id = ds.order_id
          )
        ), 0)::text AS "retainedDepositDeductionAmount",
        COALESCE((
          SELECT COUNT(*)::int
          FROM refunds r
          JOIN payments p ON p.id = r.payment_id
          JOIN invoices i ON i.id = p.invoice_id
          JOIN manual_refunds mr ON mr.refund_id = r.id
          WHERE ${refundWhere} AND r.execution_mode = 'MANUAL_BANK_TRANSFER' AND mr.status IN ('AWAITING_RECIPIENT', 'READY', 'PROCESSING', 'NEEDS_REVIEW')
        ), 0) AS "payosManualRefundPendingCount",
        COALESCE((
          SELECT COUNT(*)::int
          FROM refunds r
          JOIN payments p ON p.id = r.payment_id
          JOIN invoices i ON i.id = p.invoice_id
          WHERE ${refundWhere}
            AND LOWER(COALESCE(r.payment_gateway, p.payment_gateway)) = 'vnpay'
            AND COALESCE(r.provider_environment, p.provider_environment) = 'SANDBOX'
            AND (r.execution_mode::text = 'SANDBOX_SIMULATED' OR (r.provider_payload -> 'sandboxSimulation') IS NOT NULL)
            AND r.status IN ('PENDING', 'PROCESSING')
        ), 0) AS "vnpaySandboxPendingRefundCount"
    `

    const bySourceSql = Prisma.sql`
      WITH entries AS (
        SELECT
          i.invoice_type::text AS bucket,
          p.amount AS inflow_amount,
          1 AS inflow_count,
          0::numeric AS outflow_amount,
          0 AS outflow_count
        FROM payments p
        JOIN invoices i ON i.id = p.invoice_id
        WHERE ${paymentWhere} AND p.status = 'SUCCEEDED'
        UNION ALL
        SELECT
          i.invoice_type::text AS bucket,
          0::numeric AS inflow_amount,
          0 AS inflow_count,
          r.amount AS outflow_amount,
          1 AS outflow_count
        FROM refunds r
        JOIN payments p ON p.id = r.payment_id
        JOIN invoices i ON i.id = p.invoice_id
        WHERE ${refundWhere} AND r.status = 'SUCCEEDED'
      )
      SELECT
        bucket,
        COALESCE(SUM(inflow_amount), 0)::text AS "inflowAmount",
        COALESCE(SUM(inflow_count), 0)::int AS "inflowCount",
        COALESCE(SUM(outflow_amount), 0)::text AS "outflowAmount",
        COALESCE(SUM(outflow_count), 0)::int AS "outflowCount"
      FROM entries
      GROUP BY bucket
      ORDER BY bucket ASC
    `

    const byGatewaySql = Prisma.sql`
      WITH entries AS (
        SELECT
          LOWER(p.payment_gateway) AS bucket,
          p.amount AS inflow_amount,
          1 AS inflow_count,
          0::numeric AS outflow_amount,
          0 AS outflow_count
        FROM payments p
        JOIN invoices i ON i.id = p.invoice_id
        WHERE ${paymentWhere} AND p.status = 'SUCCEEDED'
        UNION ALL
        SELECT
          LOWER(COALESCE(r.payment_gateway, p.payment_gateway)) AS bucket,
          0::numeric AS inflow_amount,
          0 AS inflow_count,
          r.amount AS outflow_amount,
          1 AS outflow_count
        FROM refunds r
        JOIN payments p ON p.id = r.payment_id
        JOIN invoices i ON i.id = p.invoice_id
        WHERE ${refundWhere} AND r.status = 'SUCCEEDED'
      )
      SELECT
        bucket,
        COALESCE(SUM(inflow_amount), 0)::text AS "inflowAmount",
        COALESCE(SUM(inflow_count), 0)::int AS "inflowCount",
        COALESCE(SUM(outflow_amount), 0)::text AS "outflowAmount",
        COALESCE(SUM(outflow_count), 0)::int AS "outflowCount"
      FROM entries
      GROUP BY bucket
      ORDER BY bucket ASC
    `

    const [totalsRows, bySourceRows, byGatewayRows] = await Promise.all([
      this.db.$queryRaw<RawCashflowTotalsRow[]>(totalsSql),
      this.db.$queryRaw<RawCashflowBucketRow[]>(bySourceSql),
      this.db.$queryRaw<RawCashflowBucketRow[]>(byGatewaySql),
    ])

    const rawTotals = totalsRows[0] ?? {
      totalInflowAmount: '0',
      totalInflowCount: 0,
      totalOutflowAmount: '0',
      totalOutflowCount: 0,
      pendingInflowAmount: '0',
      pendingInflowCount: 0,
      pendingOutflowAmount: '0',
      pendingOutflowCount: 0,
      reconciliationRequiredCount: 0,
    }

    const totalInflowDec = new Prisma.Decimal(rawTotals.totalInflowAmount)
    const totalOutflowDec = new Prisma.Decimal(rawTotals.totalOutflowAmount)
    const netDec = totalInflowDec.minus(totalOutflowDec)

    const hasExtendedTotals = rawTotals.bookingInflowAmount !== undefined
    let extendedTotals: Partial<AdminCashflowSummaryResponseDto['totals']> = {}
    if (hasExtendedTotals) {
      const depositCollected = new Prisma.Decimal(rawTotals.rentalDepositInflowAmount ?? 0)
      const depositRefunded = new Prisma.Decimal(rawTotals.depositOutflowAmount ?? 0)
      const depositDeducted = new Prisma.Decimal(rawTotals.retainedDepositDeductionAmount ?? 0)
      const rawActiveDeposit = depositCollected.minus(depositRefunded).minus(depositDeducted)
      const activeDepositHeld = rawActiveDeposit.gt(0) ? rawActiveDeposit : new Prisma.Decimal(0)
      const serviceRevenue = totalInflowDec.minus(depositCollected)

      extendedTotals = {
        serviceRevenueAmount: (serviceRevenue.gt(0) ? serviceRevenue : new Prisma.Decimal(0)).toFixed(2),
        bookingInflowAmount: new Prisma.Decimal(rawTotals.bookingInflowAmount ?? 0).toFixed(2),
        rentalFeeInflowAmount: new Prisma.Decimal(rawTotals.rentalFeeInflowAmount ?? 0).toFixed(2),
        rentalExtensionInflowAmount: new Prisma.Decimal(
          rawTotals.rentalExtensionInflowAmount ?? 0,
        ).toFixed(2),
        rentalDepositInflowAmount: depositCollected.toFixed(2),
        trailAccessInflowAmount: new Prisma.Decimal(rawTotals.trailAccessInflowAmount ?? 0).toFixed(2),
        depositOutflowAmount: depositRefunded.toFixed(2),
        bookingCancellationOutflowAmount: new Prisma.Decimal(
          rawTotals.bookingCancellationOutflowAmount ?? 0,
        ).toFixed(2),
        rentalCancellationOutflowAmount: new Prisma.Decimal(
          rawTotals.rentalCancellationOutflowAmount ?? 0,
        ).toFixed(2),
        technicalReversalOutflowAmount: new Prisma.Decimal(
          rawTotals.technicalReversalOutflowAmount ?? 0,
        ).toFixed(2),
        retainedDepositDeductionAmount: depositDeducted.toFixed(2),
        activeDepositHeldAmount: activeDepositHeld.toFixed(2),
        payosManualRefundPendingCount: 0,
        vnpaySandboxPendingRefundCount: Number(rawTotals.vnpaySandboxPendingRefundCount ?? 0),
      }
    }

    const allSources: TransactionSource[] = query.source
      ? [query.source]
      : ['BOOKING', 'RENTAL', 'TRAIL_ACCESS']
    const sourceMap = new Map(bySourceRows.map((r) => [r.bucket, r]))

    const bySource = allSources.map((src) => {
      const row = sourceMap.get(src)
      const inflow = new Prisma.Decimal(row?.inflowAmount ?? 0)
      const outflow = new Prisma.Decimal(row?.outflowAmount ?? 0)
      return {
        source: src,
        inflowAmount: inflow.toFixed(2),
        inflowCount: row?.inflowCount ?? 0,
        outflowAmount: outflow.toFixed(2),
        outflowCount: row?.outflowCount ?? 0,
        netAmount: inflow.minus(outflow).toFixed(2),
      }
    })

    const byGateway = byGatewayRows
      .filter((row) => allowedGateways.includes(row.bucket as SupportedAdminGateway))
      .map((row) => {
        const inflow = new Prisma.Decimal(row.inflowAmount)
        const outflow = new Prisma.Decimal(row.outflowAmount)
        return {
          gateway: row.bucket,
          inflowAmount: inflow.toFixed(2),
          inflowCount: row.inflowCount,
          outflowAmount: outflow.toFixed(2),
          outflowCount: row.outflowCount,
          netAmount: inflow.minus(outflow).toFixed(2),
        }
      })

    return {
      appliedFilters: {
        gateway: gatewayFilter,
        gatewaysIncluded: allowedGateways,
        source: query.source ?? null,
      },
      currency: 'VND',
      settlementMode: 'SANDBOX_SIMULATED',
      warnings: ['TEST_ONLY', 'NO_REAL_MONEY_RETURNED'],
      period: {
        from: query.from ? new Date(query.from).toISOString() : null,
        to: query.to ? new Date(query.to).toISOString() : null,
      },
      totals: {
        totalInflowAmount: totalInflowDec.toFixed(2),
        totalInflowCount: Number(rawTotals.totalInflowCount),
        totalOutflowAmount: totalOutflowDec.toFixed(2),
        totalOutflowCount: Number(rawTotals.totalOutflowCount),
        netCashflowAmount: netDec.toFixed(2),
        pendingInflowAmount: new Prisma.Decimal(rawTotals.pendingInflowAmount).toFixed(2),
        pendingInflowCount: Number(rawTotals.pendingInflowCount),
        pendingOutflowAmount: new Prisma.Decimal(rawTotals.pendingOutflowAmount).toFixed(2),
        pendingOutflowCount: Number(rawTotals.pendingOutflowCount),
        reconciliationRequiredCount: Number(rawTotals.reconciliationRequiredCount),
        ...extendedTotals,
      },
      bySource,
      byGateway,
    }
  }

  /**
   * API 5 — Admin Payment Detail
   * Method: GET /api/v1/admin/payments/:id (and alias GET /api/v1/admin/transactions/payments/:id)
   *
   * Returns complete payment & reconciliation diagnostics for Admin without leaking gateway secrets.
   * Only allows VNPay SANDBOX payments.
   */
  async getAdminPaymentDetail(input: { paymentId: string }): Promise<AdminPaymentDetailResponseDto> {
    const payment = await this.db.payment.findUnique({
      where: { id: input.paymentId },
      include: {
        invoice: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true },
            },
            rentalOrder: {
              select: { rentalFee: true, totalDeposit: true },
            },
          },
        },
        payosCheckout: true,
        application: true,
        allocations: {
          orderBy: { createdAt: 'asc' },
        },
        refundsViaPaymentId: {
          include: {
            manualRefund: true,
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        },
      },
    })

    const gw = normalizeSupportedGateway(payment?.paymentGateway)
    if (!payment || !gw || payment.providerEnvironment !== 'SANDBOX') {
      throw AppError.fromCode(PAYMENT_ERROR_CODES.PAYMENT_NOT_FOUND)
    }

    const inv = payment.invoice
    const sourceId = inv.bookingId ?? inv.rentalOrderId ?? inv.trailAccessId ?? null
    const isExtension = inv.invoiceNo?.startsWith('RENTAL-EXT-') ?? false

    const totalDec = new Prisma.Decimal(payment.amount)
    let serviceFeeDec = totalDec
    let rentalFeeDec = new Prisma.Decimal(0)
    let depositDec = new Prisma.Decimal(0)

    if (inv.invoiceType === 'RENTAL') {
      if (isExtension) {
        rentalFeeDec = totalDec
      } else if (payment.allocations.length > 0) {
        for (const a of payment.allocations) {
          if (a.component === 'RENTAL_DEPOSIT') {
            depositDec = depositDec.add(new Prisma.Decimal(a.amount))
          } else {
            rentalFeeDec = rentalFeeDec.add(new Prisma.Decimal(a.amount))
          }
        }
        serviceFeeDec = rentalFeeDec
      } else if (inv.rentalOrder) {
        rentalFeeDec = new Prisma.Decimal(inv.rentalOrder.rentalFee)
        depositDec = new Prisma.Decimal(inv.rentalOrder.totalDeposit)
        serviceFeeDec = rentalFeeDec
      } else {
        rentalFeeDec = totalDec
      }
    }

    return {
      paymentId: payment.id,
      invoiceId: inv.id,
      invoiceNo: inv.invoiceNo,
      invoiceStatus: inv.status,
      source: inv.invoiceType,
      sourceId,
      owner: {
        id: inv.user.id,
        fullName: inv.user.fullName ?? null,
        email: inv.user.email,
      },
      amount: totalDec.toFixed(2),
      currency: payment.currency,
      breakdown: {
        serviceFeeAmount: serviceFeeDec.toFixed(2),
        rentalFeeAmount: rentalFeeDec.toFixed(2),
        depositAmount: depositDec.toFixed(2),
        deductionAmount: '0.00',
        isExtension,
      },
      status: payment.status,
      paymentGateway: gw,
      providerEnvironment: payment.providerEnvironment ?? null,
      paymentMethod: payment.paymentMethod ?? null,
      transactionRef: payment.transactionRef ?? null,
      merchantRequestRef: payment.merchantRequestRef ?? null,
      payosOrderCode: null,
      payosPaymentLinkId: null,
      applicationStatus: payment.application?.status ?? null,
      applicationReasonCode: payment.application?.reasonCode ?? null,
      reconcileStatus: payment.reconcileStatus,
      reconciliationRequired: ['NEEDS_REVIEW', 'SCHEDULED', 'RUNNING'].includes(
        payment.reconcileStatus,
      ),
      retryCount: payment.retryCount,
      lastCheckedAt: payment.lastCheckedAt ? payment.lastCheckedAt.toISOString() : null,
      lastErrorCode: payment.lastErrorCode ?? null,
      createdAt: payment.createdAt.toISOString(),
      paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
      allocations: payment.allocations.map((a) => ({
        id: a.id,
        rentalOrderLineId: a.rentalOrderLineId,
        component: a.component,
        amount: new Prisma.Decimal(a.amount).toFixed(2),
      })),
      refunds: payment.refundsViaPaymentId.filter((r) =>
        r.paymentGateway === 'vnpay' && r.providerEnvironment === 'SANDBOX' &&
        (r.executionMode === 'SANDBOX_SIMULATED' || Boolean((r.providerPayload as Prisma.JsonObject | null)?.sandboxSimulation)),
      ).map((r) => {
        const simulated = Boolean(
          (r.providerPayload as Prisma.JsonObject | null)?.sandboxSimulation,
        )
        const confirmationSource = simulated && r.status === 'SUCCEEDED'
          ? 'SANDBOX_SIMULATION'
          : r.manualRefund?.status === 'COMPLETED' ||
            (r.executionMode === 'MANUAL_BANK_TRANSFER' && r.status === 'SUCCEEDED')
            ? 'ADMIN_MANUAL'
            : r.executionMode === 'PROVIDER_API' && r.status === 'SUCCEEDED'
              ? 'PROVIDER'
              : null

        const rGw = normalizeSupportedGateway(r.paymentGateway ?? payment.paymentGateway) ?? gw
        const rEnv = r.providerEnvironment ?? payment.providerEnvironment
        const canSimulateSandbox =
          rGw === 'vnpay' &&
          rEnv === 'SANDBOX' &&
          ['SANDBOX_SIMULATED', 'PROVIDER_API'].includes(r.executionMode) &&
          (r.status === 'PENDING' || r.status === 'PROCESSING')

        return {
          refundId: r.id,
          amount: new Prisma.Decimal(r.amount).toFixed(2),
          currency: r.currency,
          status: r.status,
          purpose: r.purpose,
          reconcileStatus: r.reconcileStatus,
          reconciliationRequired:
            ['NEEDS_REVIEW', 'SCHEDULED', 'RUNNING'].includes(r.reconcileStatus) ||
            r.manualRefund?.status === 'NEEDS_REVIEW',
          executionMode: r.executionMode,
          confirmationSource,
          ...this.simulationDisclosure(r.executionMode, simulated ? 'SANDBOX_SIMULATION' : null),
          manualRefundStatus: r.manualRefund?.status ?? null,
          canSimulateSandbox,
          refundTransactionRef: r.refundTransactionRef ?? null,
          createdAt: r.createdAt.toISOString(),
          refundedAt: r.refundedAt ? r.refundedAt.toISOString() : null,
        }
      }),
    }
  }

  /**
   * API 6 — Admin Refund Detail
   * Method: GET /api/v1/admin/refunds/:id (and alias GET /api/v1/admin/transactions/refunds/:id)
   *
   * Returns simulated VNPay SANDBOX refund diagnostics and the original invoice owner.
   */
  async getAdminRefundDetail(input: { refundId: string }): Promise<AdminRefundDetailResponseDto> {
    const refund = await this.db.refund.findUnique({
      where: { id: input.refundId },
      include: {
        manualRefund: true,
        allocations: {
          include: {
            paymentAllocation: {
              select: { component: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        depositSettlement: {
          select: { totalDeposit: true, totalDeduction: true },
        },
        depositSettlementItem: {
          select: { depositAmount: true, deductionAmount: true },
        },
        payment: {
          include: {
            payosCheckout: true,
            invoice: {
              include: {
                user: {
                  select: { id: true, fullName: true, email: true },
                },
              },
            },
          },
        },
      },
    })

    const gw = normalizeSupportedGateway(
      refund?.paymentGateway ?? refund?.payment.paymentGateway,
    )
    if (!refund || !gw || refund.providerEnvironment !== 'SANDBOX' ||
      refund.payment.paymentGateway !== 'vnpay' || refund.payment.providerEnvironment !== 'SANDBOX' ||
      refund.payment.status !== 'SUCCEEDED' ||
      (refund.executionMode !== 'SANDBOX_SIMULATED' && !(refund.providerPayload as Prisma.JsonObject | null)?.sandboxSimulation)) {
      throw AppError.fromCode(PAYMENT_ERROR_CODES.PAYMENT_NOT_FOUND)
    }

    const payment = refund.payment
    const inv = payment.invoice
    const sourceId =
      inv.invoiceType === 'RENTAL'
        ? (refund.rentalOrderId ?? inv.rentalOrderId ?? null)
        : inv.invoiceType === 'BOOKING'
          ? (inv.bookingId ?? null)
          : (refund.trailAccessId ?? inv.trailAccessId ?? null)

    const simulated = Boolean(
      (refund.providerPayload as Prisma.JsonObject | null)?.sandboxSimulation,
    )
    const m = refund.manualRefund
    const confirmationSource = simulated && refund.status === 'SUCCEEDED'
      ? 'SANDBOX_SIMULATION'
      : m?.status === 'COMPLETED' ||
        (refund.executionMode === 'MANUAL_BANK_TRANSFER' && refund.status === 'SUCCEEDED')
        ? 'ADMIN_MANUAL'
        : refund.executionMode === 'PROVIDER_API' && refund.status === 'SUCCEEDED'
          ? 'PROVIDER'
          : null

    const env = refund.providerEnvironment ?? payment.providerEnvironment ?? null
    const canSimulateSandbox =
      gw === 'vnpay' &&
      env === 'SANDBOX' &&
      ['SANDBOX_SIMULATED', 'PROVIDER_API'].includes(refund.executionMode) &&
      (refund.status === 'PENDING' || refund.status === 'PROCESSING')

    const refundAmt = new Prisma.Decimal(refund.amount)
    const payAmt = new Prisma.Decimal(payment.amount)
    let serviceFeeDec = refundAmt
    let rentalFeeDec = new Prisma.Decimal(0)
    let depositDec = new Prisma.Decimal(0)
    let deductionDec = new Prisma.Decimal(0)

    if (refund.purpose === 'DEPOSIT') {
      serviceFeeDec = new Prisma.Decimal(0)
      depositDec = refund.depositSettlementItem
        ? new Prisma.Decimal(refund.depositSettlementItem.depositAmount)
        : refund.depositSettlement
          ? new Prisma.Decimal(refund.depositSettlement.totalDeposit)
          : refundAmt
      deductionDec = refund.depositSettlementItem
        ? new Prisma.Decimal(refund.depositSettlementItem.deductionAmount)
        : refund.depositSettlement
          ? new Prisma.Decimal(refund.depositSettlement.totalDeduction)
          : new Prisma.Decimal(0)
    } else if (refund.purpose === 'RENTAL_CANCELLATION') {
      if (refund.allocations.length > 0) {
        for (const ra of refund.allocations) {
          if (ra.paymentAllocation.component === 'RENTAL_DEPOSIT') {
            depositDec = depositDec.add(new Prisma.Decimal(ra.amount))
          } else {
            rentalFeeDec = rentalFeeDec.add(new Prisma.Decimal(ra.amount))
          }
        }
        serviceFeeDec = rentalFeeDec
      } else {
        depositDec = refundAmt
        serviceFeeDec = new Prisma.Decimal(0)
      }
      deductionDec = payAmt.gt(refundAmt) ? payAmt.sub(refundAmt) : new Prisma.Decimal(0)
    } else if (refund.purpose === 'BOOKING_CANCELLATION') {
      deductionDec = payAmt.gt(refundAmt) ? payAmt.sub(refundAmt) : new Prisma.Decimal(0)
    }

    let evidenceMediaUrl: string | null = null
    if (m?.evidenceMediaId && (this.db as unknown as { mediaAsset?: { findUnique?: unknown } }).mediaAsset) {
      const media = await this.db.mediaAsset.findUnique({
        where: { id: m.evidenceMediaId },
        select: { secureUrl: true },
      })
      evidenceMediaUrl = media?.secureUrl ?? null
    }

    return {
      refundId: refund.id,
      paymentId: payment.id,
      invoiceId: inv.id,
      invoiceNo: inv.invoiceNo,
      source: inv.invoiceType,
      sourceId,
      owner: {
        id: inv.user.id,
        fullName: inv.user.fullName ?? null,
        email: inv.user.email,
      },
      amount: refundAmt.toFixed(2),
      currency: refund.currency,
      breakdown: {
        serviceFeeAmount: serviceFeeDec.toFixed(2),
        rentalFeeAmount: rentalFeeDec.toFixed(2),
        depositAmount: depositDec.toFixed(2),
        deductionAmount: deductionDec.toFixed(2),
        isExtension: false,
      },
      status: refund.status,
      purpose: refund.purpose,
      reason: refund.reason ?? null,
      reasonCode: refund.reasonCode ?? null,
      paymentGateway: gw,
      providerEnvironment: env,
      executionMode: refund.executionMode,
      confirmationSource,
      ...this.simulationDisclosure(refund.executionMode, simulated ? 'SANDBOX_SIMULATION' : null),
      reconcileStatus: refund.reconcileStatus,
      reconciliationRequired:
        ['NEEDS_REVIEW', 'SCHEDULED', 'RUNNING'].includes(refund.reconcileStatus) ||
        m?.status === 'NEEDS_REVIEW',
      refundTransactionRef: refund.refundTransactionRef ?? null,
      merchantRefundRef: refund.merchantRefundRef ?? null,
      canSimulateSandbox,
      createdAt: refund.createdAt.toISOString(),
      refundedAt: refund.refundedAt ? refund.refundedAt.toISOString() : null,
      sourcePayment: {
        paymentId: payment.id,
        amount: payAmt.toFixed(2),
        status: payment.status,
        paymentGateway: normalizeSupportedGateway(payment.paymentGateway) ?? gw,
        paymentMethod: payment.paymentMethod ?? null,
        transactionRef: payment.transactionRef ?? null,
        payosOrderCode: null,
        paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
      },
      allocations: refund.allocations.map((ra) => ({
        id: ra.id,
        paymentAllocationId: ra.paymentAllocationId,
        component: ra.paymentAllocation.component,
        amount: new Prisma.Decimal(ra.amount).toFixed(2),
      })),
      manualRefund: m
        ? {
          manualStatus: m.status,
          version: m.version,
          assignedAdminId: m.assignedAdminId,
          claimedAt: m.claimedAt ? m.claimedAt.toISOString() : null,
          recipient: m.accountNumber
            ? {
              bankBin: m.bankBin,
              accountNumber: m.accountNumber,
              accountHolderName: m.accountHolderName,
              ownershipConfirmedAt: m.ownershipConfirmedAt
                ? m.ownershipConfirmedAt.toISOString()
                : null,
              vietQrImageUrl: buildVietQrUrl({
                bankBin: m.bankBin,
                accountNumber: m.accountNumber,
                accountHolderName: m.accountHolderName,
                amount: refund.amount,
                invoiceNo: inv.invoiceNo,
                refundId: refund.id,
              }),
            }
            : null,
          bankTransactionRef: m.bankTransactionRef,
          transferredAt: m.transferredAt ? m.transferredAt.toISOString() : null,
          confirmedBy: m.confirmedBy,
          evidenceMediaId: m.evidenceMediaId,
          evidenceMediaUrl,
          note: m.note,
        }
        : null,
    }
  }

  private resolveCategory(
    kind: TransactionKind,
    source: TransactionSource,
    purpose?: string | null,
    isExtension?: boolean,
  ): AdminTransactionCategory {
    if (kind === 'PAYMENT') {
      if (source === 'BOOKING') return 'BOOKING_PAYMENT'
      if (source === 'RENTAL') return isExtension ? 'RENTAL_EXTENSION' : 'RENTAL_INITIAL'
      return 'TRAIL_PURCHASE'
    }
    switch (purpose) {
      case 'DEPOSIT':
        return 'DEPOSIT_REFUND'
      case 'BOOKING_CANCELLATION':
        return 'BOOKING_CANCEL_REFUND'
      case 'RENTAL_CANCELLATION':
        return 'RENTAL_CANCEL_REFUND'
      case 'TRAIL_ACCESS':
        return 'TRAIL_REFUND'
      default:
        return 'TECHNICAL_REVERSAL'
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
