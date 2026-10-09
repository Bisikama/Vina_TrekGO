import { Body, Controller, Headers, Param, Post, Res } from '@nestjs/common'
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import type { Response } from 'express'
import { Auth } from '../../../shared/decorators/auth.decorator'
import { AuthType } from '../../../shared/constants/auth.constant'
import { ActiveUser } from '../../../shared/decorators/active-user.decorator'
import { ZodValidationPipe } from '../../../shared/pipes/zod-validation.pipe'
import { PaymentsPort } from '../../payments/payments.port'
import { PaymentMethod } from '../../payments/payment-provider.port'

@ApiTags('Rental Extension Payments')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Controller('rental-extensions')
export class RentalExtensionPaymentsController {
  constructor(private readonly payments: PaymentsPort) {}

  @Post(':id/payments')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async checkout(
    @Param('id', new ZodValidationPipe(z.string().uuid())) extensionId: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body(new ZodValidationPipe(z.object({ paymentMethod: z.enum(['QR','REDIRECT']) }).strict())) body: { paymentMethod: PaymentMethod },
    @ActiveUser('id') actorUserId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    new ZodValidationPipe(z.string().min(1).max(200)).transform(idempotencyKey, { type: 'custom' })
    const result = await this.payments.createRentalExtensionCheckout({ extensionId, actorUserId, idempotencyKey, paymentMethod: body.paymentMethod })
    response.status(result.httpStatus)
    return result.body
  }
}
