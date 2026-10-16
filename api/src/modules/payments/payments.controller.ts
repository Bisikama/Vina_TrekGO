import { Body, Controller, Get, Headers, Param, Post, Req, Res } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
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

@ApiTags('Thanh toán đặt chỗ (Booking Payments)')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Controller('bookings')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post(':id/payments')
  @ApiOperation({
    summary: 'Tạo phiên thanh toán cho đơn đặt chỗ chuyến đi',
    description:
      'Khởi tạo phiên thanh toán cho đơn đặt chỗ (Booking) ở trạng thái PENDING_PAYMENT. ' +
      'Hỗ trợ 2 phương thức: QR (quét mã QR ngân hàng/ví điện tử) hoặc REDIRECT (chuyển hướng cổng thanh toán). ' +
      'Yêu cầu Idempotency-Key để tránh tạo trùng lặp phiên thanh toán.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'UUID của đơn đặt chỗ cần thanh toán',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @ApiHeader({
    name: 'idempotency-key',
    required: true,
    description: 'Khóa duy nhất tránh giao dịch trùng lặp (1–200 ký tự ASCII)',
    example: 'pay-book-20261014-abc123',
  })
  @ApiBody({
    description: 'Phương thức thanh toán mong muốn',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['paymentMethod'],
      properties: {
        paymentMethod: {
          type: 'string',
          enum: ['QR', 'REDIRECT'],
          description: 'Phương thức: QR hoặc chuyển hướng cổng thanh toán',
          example: 'REDIRECT',
        },
        gateway: {
          type: 'string',
          enum: ['momo', 'vnpay'],
          description: 'Cổng thanh toán; bỏ trống để dùng cổng mặc định',
          example: 'vnpay',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Tạo phiên thanh toán thành công — trả về checkoutUrl/qrCode' })
  @ApiResponse({ status: 200, description: 'Phiên thanh toán đã tồn tại và còn hiệu lực (idempotent)' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ hoặc paymentMethod sai' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực — token không hợp lệ' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đơn đặt chỗ' })
  @ApiResponse({ status: 409, description: 'Đơn đặt chỗ đã được thanh toán hoặc đã hủy' })
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
