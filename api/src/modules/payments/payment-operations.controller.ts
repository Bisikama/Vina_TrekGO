import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ActiveUser } from '../../shared/decorators/active-user.decorator'
import { Auth } from '../../shared/decorators/auth.decorator'
import { Roles } from '../../shared/decorators/roles.decorator'
import { AuthType } from '../../shared/constants/auth.constant'
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe'
import { AppError, PAYMENT_ERROR_CODES } from '../../shared/errors'
import type { ActiveUserData } from '../../shared/types/user.type'
import { PrismaService } from '../../shared/services/prisma.service'
import { PaymentRecoveryService } from './payment-recovery.service'
import { refundSummary } from './refunds.service'

const reasonSchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict()

@Controller('admin')
@ApiTags('Payments')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Roles('ADMIN')
export class PaymentOperationsController {
  constructor(private readonly recovery: PaymentRecoveryService) {}
  @Post('payments/:id/reconcile')
  @HttpCode(202)
  payment(
    @Param('id', new ZodValidationPipe(z.string().uuid())) id: string,
    @Body(new ZodValidationPipe(reasonSchema)) body: { reason: string },
    @ActiveUser('id') actorId: string,
  ) {
    return this.recovery.schedule('payment', id, actorId, body.reason)
  }
  @Post('refunds/:id/reconcile')
  @HttpCode(202)
  refund(
    @Param('id', new ZodValidationPipe(z.string().uuid())) id: string,
    @Body(new ZodValidationPipe(reasonSchema)) body: { reason: string },
    @ActiveUser('id') actorId: string,
  ) {
    return this.recovery.schedule('refund', id, actorId, body.reason)
  }
}

@Controller('refunds')
@ApiTags('Payments')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
export class RefundsController {
  constructor(private readonly db: PrismaService) {}
  @Get(':id')
  async detail(@Param('id', new ZodValidationPipe(z.string().uuid())) id: string, @ActiveUser() actor: ActiveUserData) {
    if (!actor?.id) throw AppError.fromCode('UNAUTHENTICATED')
    const refund = await this.db.refund.findFirst({
      where: { id, ...(actor.role === 'ADMIN' ? {} : { payment: { invoice: { userId: actor.id } } }) },
    })
    if (!refund) throw AppError.fromCode(PAYMENT_ERROR_CODES.PAYMENT_NOT_FOUND)
    return refundSummary(refund)
  }
}
