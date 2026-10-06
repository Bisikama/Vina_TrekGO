import { Body, Controller, Headers, Param, Post, Res } from '@nestjs/common'
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { z } from 'zod'
import { Auth } from '../../../../shared/decorators/auth.decorator'
import { AuthType } from '../../../../shared/constants/auth.constant'
import { ActiveUser } from '../../../../shared/decorators/active-user.decorator'
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe'
import { PurchaseTrailUseCase } from '../../application/use-cases/purchase-trail.use-case'
import { PaymentMethod } from '../../../payments/payment-provider.port'

@ApiTags('Trail purchases')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Controller('trails')
export class TrailPurchaseController {
  constructor(private readonly purchase: PurchaseTrailUseCase) {}
  @Post(':trailId/purchase')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async create(
    @Param('trailId', new ZodValidationPipe(z.string().uuid())) trailId: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body(new ZodValidationPipe(z.object({ paymentMethod: z.enum(['QR', 'REDIRECT']) }).strict()))
    body: { paymentMethod: PaymentMethod },
    @ActiveUser('id') actorUserId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    new ZodValidationPipe(
      z
        .string()
        .min(1)
        .max(200)
        .regex(/^[\x21-\x7e]+$/),
    ).transform(idempotencyKey, { type: 'custom' })
    const result = await this.purchase.execute({ trailId, actorUserId, idempotencyKey, ...body })
    response.status(result.httpStatus)
    return result.body
  }
}
