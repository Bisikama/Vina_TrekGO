import { Body, Controller, Headers, Param, Post, Req, Res } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiHeader, ApiParam, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
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
  @ApiParam({ name: 'trailId', type: String, format: 'uuid', description: 'UUID của cung đường muốn mua bản quyền',
    example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiHeader({ name: 'idempotency-key', required: true, description: 'Khóa duy nhất tránh giao dịch trùng lặp (1–200 ký tự ASCII)' })
  @ApiBody({ description: 'Phương thức thanh toán', schema: { type: 'object', additionalProperties: false, required: ['paymentMethod'], properties: {
    paymentMethod: { type: 'string', enum: ['QR', 'REDIRECT'], description: 'Phương thức thanh toán: QR (quét mã) hoặc REDIRECT (chuyển hướng)', example: 'QR' },
    gateway: { type: 'string', enum: ['momo', 'vnpay'], description: 'Bỏ trống để dùng cổng mặc định' },
  } } })
  async create(
    @Param('trailId', new ZodValidationPipe(z.string())) trailId: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body(new ZodValidationPipe(z.object({ paymentMethod: z.enum(['QR', 'REDIRECT']), gateway: z.enum(['momo', 'vnpay']).optional() }).strict()))
    body: { paymentMethod: PaymentMethod; gateway?: 'momo' | 'vnpay' },
    @ActiveUser('id') actorUserId: string,
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request,
  ) {
    new ZodValidationPipe(
      z
        .string()
        .min(1)
        .max(200)
        .regex(/^[\x21-\x7e]+$/),
    ).transform(idempotencyKey, { type: 'custom' })
    const result = await this.purchase.execute({
      trailId, actorUserId, idempotencyKey, ...body,
      clientIp: request.ip ?? request.socket.remoteAddress,
    })
    response.status(result.httpStatus)
    return result.body
  }
}
