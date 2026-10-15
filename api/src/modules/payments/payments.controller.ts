import { Body, Controller, Get, Headers, Param, Post, Req, Res } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiHeader, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { Auth } from '../../shared/decorators/auth.decorator'
import { AuthType } from '../../shared/constants/auth.constant'
import { ActiveUser } from '../../shared/decorators/active-user.decorator'
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe'
import { AppError } from '../../shared/errors'
import { PaymentsService } from './payments.service'
import type { PaymentMethod } from './payment-provider.port'

const bodySchema = z.object({ paymentMethod: z.enum(['QR', 'REDIRECT']), gateway: z.enum(['momo', 'vnpay']).optional() }).strict()
const keySchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[\x21-\x7e]+$/)

@ApiTags('Payments')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Controller('bookings')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post(':id/payments')
  @ApiHeader({ name: 'idempotency-key', required: true, example: 'cf02-payment-001' })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['paymentMethod'],
      properties: { paymentMethod: { type: 'string', enum: ['QR', 'REDIRECT'] }, gateway: { type: 'string', enum: ['momo', 'vnpay'] } },
    },
  })
  async create(
    @Param('id', new ZodValidationPipe(z.string().uuid())) bookingId: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body(new ZodValidationPipe(bodySchema)) body: { paymentMethod: PaymentMethod; gateway?: 'momo' | 'vnpay' },
    @ActiveUser('id') actorUserId: string,
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request,
  ) {
    if (!actorUserId) throw AppError.fromCode('UNAUTHENTICATED')
    new ZodValidationPipe(keySchema).transform(idempotencyKey, { type: 'custom' })
    const result = await this.payments.createBookingCheckout({ bookingId, actorUserId, idempotencyKey, ...body, clientIp: request.ip ?? request.socket.remoteAddress })
    response.status(result.httpStatus)
    return result.body
  }
}

@ApiTags('Payments')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Controller('payments')
export class PaymentOptionsController {
  constructor(private readonly payments: PaymentsService) {}
  @Get('options')
  options() { return this.payments.paymentOptions() }
}
