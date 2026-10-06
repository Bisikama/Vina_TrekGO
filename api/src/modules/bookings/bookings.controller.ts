import { Controller, Get, Param } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { Auth } from '../../shared/decorators/auth.decorator'
import { ActiveUser } from '../../shared/decorators/active-user.decorator'
import { AuthType } from '../../shared/constants/auth.constant'
import { AppError, BOOKING_ERROR_CODES } from '../../shared/errors'
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe'
import { PrismaService } from '../../shared/services/prisma.service'

@ApiTags('Bookings')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Controller('bookings')
export class BookingsController {
  constructor(private readonly db: PrismaService) {}

  @Get(':id')
  async detail(
    @Param('id', new ZodValidationPipe(z.string().uuid())) id: string,
    @ActiveUser('id') actorUserId: string,
  ) {
    if (!actorUserId) throw AppError.fromCode('UNAUTHENTICATED')
    const booking = await this.db.booking.findFirst({
      where: { id, userId: actorUserId },
      include: {
        invoicesViaBookingId: {
          include: { paymentsViaInvoiceId: { include: { application: true, refundsViaPaymentId: true } } },
        },
      },
    })
    if (!booking) throw AppError.fromCode(BOOKING_ERROR_CODES.NOT_FOUND)
    const payments = booking.invoicesViaBookingId
      .flatMap((invoice) => invoice.paymentsViaInvoiceId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))
    // An accepted collection takes precedence over a newer rejected duplicate attempt.
    const payment = payments.find((p) => p.application?.status === 'APPLIED') ?? payments[0]
    return {
      id: booking.id,
      status: booking.status,
      expiresAt: booking.expiresAt.toISOString(),
      confirmedAt: booking.confirmedAt?.toISOString() ?? null,
      totalAmount: booking.totalAmount.toFixed(),
      currency: booking.currency,
      paymentSummary: payment
        ? {
            paymentId: payment.id,
            status: payment.status,
            applicationStatus: payment.application?.status ?? null,
            applicationReasonCode: payment.application?.reasonCode ?? null,
            reconciliationRequired: ['SCHEDULED', 'RUNNING', 'NEEDS_REVIEW'].includes(payment.reconcileStatus),
          }
        : null,
      refunds: payments.flatMap((p) =>
        p.refundsViaPaymentId.map((refund) => ({
          refundId: refund.id,
          paymentId: p.id,
          purpose: refund.purpose,
          reasonCode: refund.reasonCode,
          amount: refund.amount.toFixed(),
          currency: refund.currency,
          status: refund.status,
          refundedAt: refund.refundedAt?.toISOString() ?? null,
          reconciliationRequired: ['SCHEDULED', 'RUNNING', 'NEEDS_REVIEW'].includes(refund.reconcileStatus),
        })),
      ),
    }
  }
}
