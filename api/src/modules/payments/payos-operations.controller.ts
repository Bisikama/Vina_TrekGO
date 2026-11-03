import { Controller, Get, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { Auth } from '../../shared/decorators/auth.decorator'
import { Roles } from '../../shared/decorators/roles.decorator'
import { AuthType } from '../../shared/constants/auth.constant'
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe'
import { PrismaService } from '../../shared/services/prisma.service'

const querySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    reconcileStatus: z.enum(['IDLE', 'SCHEDULED', 'RUNNING', 'NEEDS_REVIEW', 'RESOLVED']).default('NEEDS_REVIEW'),
    source: z.enum(['BOOKING', 'RENTAL', 'TRAIL_ACCESS']).optional(),
  })
  .strict()

@Controller('admin/payos-payments')
@ApiTags('Admin payOS Reconciliation')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Roles('ADMIN')
export class PayosOperationsController {
  constructor(private readonly db: PrismaService) {}

  @Get()
  @ApiOperation({
    summary: 'List payOS payments for reconciliation',
    description:
      'Defaults to NEEDS_REVIEW. Shows expected and observed amounts and transaction counts; never changes amounts or refunds arbitrary excess money. Use existing admin payments/:id/reconcile to query again.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({
    name: 'reconcileStatus',
    required: false,
    enum: ['IDLE', 'SCHEDULED', 'RUNNING', 'NEEDS_REVIEW', 'RESOLVED'],
  })
  @ApiQuery({ name: 'source', required: false, enum: ['BOOKING', 'RENTAL', 'TRAIL_ACCESS'] })
  async list(@Query(new ZodValidationPipe(querySchema)) query: z.infer<typeof querySchema>) {
    const where: Prisma.PaymentWhereInput = {
      paymentGateway: 'payos',
      providerEnvironment: 'PRODUCTION',
      reconcileStatus: query.reconcileStatus,
      ...(query.source ? { invoice: { invoiceType: query.source } } : {}),
    }
    const [total, rows] = await this.db.$transaction([
      this.db.payment.count({ where }),
      this.db.payment.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { invoice: true, payosCheckout: true },
      }),
    ])
    return {
      items: rows.map((row) => {
        const evidence = row.payosCheckout?.lastResponse as Prisma.JsonObject | null
        return {
          paymentId: row.id,
          invoiceId: row.invoiceId,
          source: row.invoice.invoiceType,
          ownerUserId: row.invoice.userId,
          amount: row.amount.toFixed(0),
          currency: row.currency,
          status: row.status,
          reconcileStatus: row.reconcileStatus,
          reviewReason: row.lastErrorCode,
          orderCode: row.payosCheckout?.orderCode.toString() ?? null,
          paymentLinkId: row.payosCheckout?.paymentLinkId ?? null,
          observedAmount: typeof evidence?.amount === 'number' ? String(evidence.amount) : null,
          observedAmountPaid: typeof evidence?.amountPaid === 'number' ? String(evidence.amountPaid) : null,
          observedTransactionCount: Array.isArray(evidence?.transactions) ? evidence.transactions.length : null,
          createdAt: row.createdAt.toISOString(),
        }
      }),
      pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
    }
  }
}
