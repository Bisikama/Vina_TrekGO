import { ManualRefundsService } from './manual-refunds.service'
import { MANUAL_REFUND_DETAIL_SCHEMA } from './manual-refund.swagger'
import { Body, Controller, Get, Headers, HttpCode, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ActiveUser } from '../../shared/decorators/active-user.decorator'
import { Auth } from '../../shared/decorators/auth.decorator'
import { Roles } from '../../shared/decorators/roles.decorator'
import { AuthType } from '../../shared/constants/auth.constant'
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe'
import { AppError } from '../../shared/errors'
import type { ActiveUserData } from '../../shared/types/user.type'
import { PaymentRecoveryService } from './payment-recovery.service'
import { SandboxRefundSimulationService } from './sandbox-refund-simulation.service'
import {
  SandboxSimulateRefundBodySchema,
  SandboxSimulateRefundParamSchema,
  type SandboxSimulateRefundBodyDto,
  type SandboxSimulateRefundParamDto,
} from './dtos/sandbox-refund-simulation.dto'

const reasonSchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict()

@Controller('admin')
@ApiTags('Quản trị thanh toán (Admin Payments & Reconciliation)')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Roles('ADMIN')
export class PaymentOperationsController {
  constructor(
    private readonly recovery: PaymentRecoveryService,
    private readonly simulation: SandboxRefundSimulationService,
  ) {}

  @Post('payments/:id/reconcile')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Đối soát thanh toán thủ công (Admin Payment Reconcile)',
    description:
      'Dành cho Admin đối soát và đồng bộ lại trạng thái thanh toán từ cổng khi webhook bị gián đoạn. ' +
      'Yêu cầu cung cấp lý do đối soát.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'UUID của giao dịch thanh toán (Payment ID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiBody({
    description: 'Lý do đối soát',
    schema: {
      type: 'object',
      required: ['reason'],
      properties: {
        reason: {
          type: 'string',
          minLength: 1,
          maxLength: 500,
          description: 'Lý do thực hiện đối soát',
          example: 'Khách hàng đã thanh toán thành công nhưng hệ thống chưa nhận webhook',
        },
      },
    },
  })
  @ApiResponse({ status: 202, description: 'Yêu cầu đối soát đã được lên lịch xử lý' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực — token không hợp lệ' })
  @ApiResponse({ status: 403, description: 'Chỉ Admin mới có quyền thực hiện thao tác này' })
  payment(
    @Param('id', new ZodValidationPipe(z.string().uuid())) id: string,
    @Body(new ZodValidationPipe(reasonSchema)) body: { reason: string },
    @ActiveUser('id') actorId: string,
  ) {
    return this.recovery.schedule('payment', id, actorId, body.reason)
  }

  @Post('refunds/:id/reconcile')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Đối soát hoàn tiền thủ công (Admin Refund Reconcile)',
    description:
      'Refund booking SANDBOX_SIMULATED được phục hồi bằng settlement mô phỏng nội bộ, không gọi VNPay. Các mode khác giữ cơ chế đối soát hiện có.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'UUID của lệnh hoàn tiền (Refund ID)',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @ApiBody({
    description: 'Lý do đối soát hoàn tiền',
    schema: {
      type: 'object',
      required: ['reason'],
      properties: {
        reason: {
          type: 'string',
          minLength: 1,
          maxLength: 500,
          description: 'Lý do thực hiện đối soát',
          example: 'Kiểm tra trạng thái hoàn tiền sau 24h chờ xử lý',
        },
      },
    },
  })
  @ApiResponse({ status: 202, description: 'Yêu cầu đối soát hoàn tiền đã được lên lịch' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Chỉ Admin mới có quyền thực hiện' })
  async refund(
    @Param('id', new ZodValidationPipe(z.string().uuid())) id: string,
    @Body(new ZodValidationPipe(reasonSchema)) body: { reason: string },
    @ActiveUser('id') actorId: string,
  ) {
    const refund = await this.simulation.settleAutomaticBookingRefund(id)
    if (refund.executionMode === 'SANDBOX_SIMULATED')
      return { refundId: id, reconcileStatus: 'RESOLVED', refund }
    return this.recovery.schedule('refund', id, actorId, body.reason)
  }

  @Post('payment-refunds/:refundId/sandbox-simulate-settlement')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Mô phỏng hoàn tiền hủy booking, hủy đơn thuê hoặc hoàn cọc VNPay Sandbox (TEST ONLY)',
    description:
      'Chỉ dành cho môi trường TEST/DEMO cô lập khi VNPay Sandbox kẹt ở 05/06 PROCESSING hoặc không có API refund. ' +
      'API ghi nhận một kết quả provider SUCCEEDED giả lập qua Shared Payment; Rental chỉ cập nhật settlement bằng outbox worker. ' +
      'Không gọi API hoàn tiền thật và không chứng minh tiền đã về tài khoản.',
  })
  @ApiParam({ name: 'refundId', type: String, format: 'uuid', description: 'UUID của lệnh hoàn tiền booking hoặc hoàn cọc' })
  @ApiHeader({
    name: 'idempotency-key',
    required: true,
    description: 'Khóa chống lặp (8 - 200 ký tự)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Shared Payment đã ghi nhận refund SUCCEEDED; settlementProcessingStatus cho biết Rental worker đã áp dụng hay chưa',
  })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({
    status: 403,
    description: 'Simulation chưa bật, payment không thuộc SANDBOX, database chưa được cho phép hoặc không có quyền Admin. NODE_ENV=production hỗ trợ booking mode SANDBOX_SIMULATED.',
  })
  @ApiResponse({
    status: 409,
    description: 'Lệnh hoàn tiền không hợp lệ, xung đột phiên bản hoặc đã được mô phỏng',
  })
  async simulateRefund(
    @Param(new ZodValidationPipe(SandboxSimulateRefundParamSchema))
    params: SandboxSimulateRefundParamDto,
    @Body(new ZodValidationPipe(SandboxSimulateRefundBodySchema))
    body: SandboxSimulateRefundBodyDto,
    @Headers('idempotency-key') rawKey: string | undefined,
    @ActiveUser('id') actorUserId: string,
  ) {
    if (!rawKey || rawKey.trim().length < 8 || rawKey.trim().length > 200) {
      throw AppError.fromCode('IDEMPOTENCY_KEY_REQUIRED', {
        message: 'Header Idempotency-Key bắt buộc có độ dài từ 8 đến 200 ký tự',
      })
    }
    return {
      data: await this.simulation.simulateRefundSettlement({
        refundId: params.refundId,
        actorUserId,
        idempotencyKey: rawKey.trim(),
        body,
      }),
    }
  }

  @Post('refunds/:refundId/sandbox-simulate-settlement')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Alias: Xác nhận hoàn tiền mô phỏng VNPay Sandbox (TEST ONLY)',
  })
  async simulateRefundAlias(
    @Param(new ZodValidationPipe(SandboxSimulateRefundParamSchema))
    params: SandboxSimulateRefundParamDto,
    @Body(new ZodValidationPipe(SandboxSimulateRefundBodySchema))
    body: SandboxSimulateRefundBodyDto,
    @Headers('idempotency-key') rawKey: string | undefined,
    @ActiveUser('id') actorUserId: string,
  ) {
    return this.simulateRefund(params, body, rawKey, actorUserId)
  }

  @Get('payment-refunds/:refundId/sandbox-simulation')
  @ApiOperation({
    summary: 'Chi tiết bằng chứng mô phỏng hoàn tiền (TEST ONLY)',
    description: 'Truy vấn nguồn gốc và trạng thái mô phỏng hoàn tiền của một refund.',
  })
  async getSimulation(
    @Param(new ZodValidationPipe(SandboxSimulateRefundParamSchema))
    params: SandboxSimulateRefundParamDto,
  ) {
    return {
      data: await this.simulation.getSimulationDetail(params.refundId),
    }
  }
}

@Controller('refunds')
@ApiTags('Payments')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
export class RefundsController {
  constructor(private readonly manualRefunds: ManualRefundsService) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Xem chi tiết lệnh hoàn tiền (Refund Detail)',
    description:
      'Chủ hóa đơn hoặc Admin được xem. Trả refundId, paymentId, purpose, reasonCode, amount, currency, status, refundedAt và reconciliationRequired. SUCCEEDED mới xác nhận hoàn thành.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'UUID của lệnh hoàn tiền',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @ApiResponse({ status: 200, schema: MANUAL_REFUND_DETAIL_SCHEMA, description: 'Refund detail; ADMIN_MANUAL is declared by admin, not verified by the payment provider' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy lệnh hoàn tiền' })
  async detail(@Param('id', new ZodValidationPipe(z.string().uuid())) id: string, @ActiveUser() actor: ActiveUserData) {
    if (!actor?.id) throw AppError.fromCode('UNAUTHENTICATED')
    return this.manualRefunds.detail(id, actor)
  }
}
