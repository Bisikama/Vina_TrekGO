import { Body, Controller, Headers, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from 'src/shared/constants';
import { AuthType } from 'src/shared/constants/auth.constant';
import { ActiveUser } from 'src/shared/decorators/active-user.decorator';
import { Auth } from 'src/shared/decorators/auth.decorator';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { AppError } from 'src/shared/errors/app-error';
import { RENTAL_RETURN_ERROR_CODES as RR } from 'src/shared/errors/codes/rental-return.error-codes';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import { CreateDepositSettlementUseCase } from '../../application/use-cases/create-deposit-settlement.use-case';
import { ResolveRentalExceptionUseCase } from '../../application/use-cases/resolve-rental-exception.use-case';
import { CreateDepositSettlementBodySchema, ExceptionIdParamSchema, RentalOrderIdParamSchema, RentalReturnIdempotencyKeySchema, ResolveExceptionBodySchema, type CreateDepositSettlementBodyDto, type ExceptionIdParamDto, type RentalOrderIdParamDto, type ResolveExceptionBodyDto } from '../dtos/rental-return.dto';

@ApiTags('Rental Return Admin')
@ApiBearerAuth('bearer')
@Controller()
@Auth([AuthType.Bearer])
export class RentalReturnAdminController {
  constructor(private readonly settlementUseCase: CreateDepositSettlementUseCase, private readonly resolveUseCase: ResolveRentalExceptionUseCase) {}

  @Post('rental-orders/:id/deposit-settlement')
  @Roles(UserRole.ADMIN)
  @HttpCode(202)
  @ApiOperation({
    summary: 'RB-API-606 — Tạo quyết toán đặt cọc: trừ tiền hư hỏng và yêu cầu hoàn trả phần còn lại',
    description:
      'Admin phê duyệt khoản trừ tiền đặt cọc do hư hỏng/mất thiết bị và ' +
      'kích hoạt yêu cầu hoàn trả (refund) phần đặt cọc còn lại cho khách. ' +
      'Cần assessmentId (từ kết quả kiểm tra) và approvalRef (mã phê duyệt nội bộ).',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID đơn hàng thuê', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Khóa duy nhất để tránh gọi trùng (8–200 ký tự)', example: 'settle-20261005-abc123' })
  @ApiBody({
    description: 'Thông tin quyết toán đặt cọc',
    schema: {
      type: 'object',
      required: ['assessmentId', 'approvalRef'],
      properties: {
        assessmentId: { type: 'string', format: 'uuid', description: 'UUID đánh giá tình trạng (assessment)', example: '880e8400-e29b-41d4-a716-446655440005' },
        approvalRef: { type: 'string', minLength: 3, maxLength: 180, description: 'Mã phê duyệt nội bộ', example: 'APPROVE-MGR-2026-1005-001' },
      },
    },
  })
  @ApiResponse({ status: 202, description: 'Quyết toán đã được tạo, yêu cầu hoàn trả đang xử lý' })
  @ApiResponse({ status: 409, description: 'Đã quyết toán trước đó' })
  @ApiResponse({ status: 404, description: 'Đơn hàng hoặc assessment không tồn tại' })
  async settle(@Param(new ZodValidationPipe(RentalOrderIdParamSchema)) params: RentalOrderIdParamDto, @Body(new ZodValidationPipe(CreateDepositSettlementBodySchema)) body: CreateDepositSettlementBodyDto, @Headers('idempotency-key') rawKey: string | undefined, @ActiveUser('id') actorUserId: string) {
    return this.settlementUseCase.execute({ actorUserId, orderId: params.id, ...body, idempotencyKey: requireKey(rawKey), now: new Date() });
  }

  @Post('admin/rental-exceptions/:id/resolve')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({
    summary: 'RB-API-610 — Admin xử lý ngoại lệ: trừ tiền / từ chối / xác nhận mất / đóng',
    description:
      'Admin giải quyết một ngoại lệ (exception) phát sinh trong quy trình trả hàng. ' +
      'Các quyết định khả dụng: APPROVE_DEDUCTION (trừ tiền), REJECT_DEDUCTION (từ chối trừ), ' +
      'CONFIRM_LOST (xác nhận mất), CLOSE_NO_ACTION (đóng không xử lý).',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID ngoại lệ cần xử lý', example: '990e8400-e29b-41d4-a716-446655440010' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Khóa duy nhất để tránh gọi trùng', example: 'resolve-20261005-def456' })
  @ApiBody({
    description: 'Quyết định xử lý ngoại lệ',
    schema: {
      type: 'object',
      required: ['decision', 'reason', 'expectedVersion'],
      properties: {
        decision: { type: 'string', enum: ['APPROVE_DEDUCTION', 'REJECT_DEDUCTION', 'CONFIRM_LOST', 'CLOSE_NO_ACTION'], description: 'Quyết định của Admin', example: 'APPROVE_DEDUCTION' },
        reason: { type: 'string', minLength: 3, maxLength: 3000, description: 'Lý do quyết định chi tiết', example: 'Xác nhận hư hỏng theo ảnh minh chứng, trừ tiền theo biểu phí' },
        assessmentVersion: { type: 'integer', minimum: 1, description: 'Phiên bản assessment (tùy chọn)' },
        expectedVersion: { type: 'integer', minimum: 1, description: 'Phiên bản exception hiện tại', example: 1 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Ngoại lệ đã được xử lý thành công' })
  @ApiResponse({ status: 409, description: 'Xung đột phiên bản hoặc đã xử lý trước đó' })
  @ApiResponse({ status: 404, description: 'Ngoại lệ không tồn tại' })
  async resolve(@Param(new ZodValidationPipe(ExceptionIdParamSchema)) params: ExceptionIdParamDto, @Body(new ZodValidationPipe(ResolveExceptionBodySchema)) body: ResolveExceptionBodyDto, @Headers('idempotency-key') rawKey: string | undefined, @ActiveUser('id') actorUserId: string) {
    return this.resolveUseCase.execute({ actorUserId, exceptionId: params.id, ...body, idempotencyKey: requireKey(rawKey), now: new Date() });
  }
}

function requireKey(raw: string | undefined) { const parsed = RentalReturnIdempotencyKeySchema.safeParse(raw); if (!parsed.success) throw AppError.fromCode(RR.IDEMPOTENCY_KEY_REQUIRED); return parsed.data; }
