import { Body, Controller, Get, Header, Headers, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from 'src/shared/constants';
import { AuthType } from 'src/shared/constants/auth.constant';
import { ActiveUser } from 'src/shared/decorators/active-user.decorator';
import { Auth } from 'src/shared/decorators/auth.decorator';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { AppError } from 'src/shared/errors/app-error';
import { DELIVERY_ERROR_CODES as DL } from 'src/shared/errors/codes/delivery.error-codes';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import { CommitRentalHandoverUseCase } from '../../application/use-cases/commit-rental-handover.use-case';
import { GetRentalHandoverPreviewUseCase } from '../../application/use-cases/get-rental-handover-preview.use-case';
import { GetRentalPickupCodeUseCase } from '../../application/use-cases/get-rental-pickup-code.use-case';
import { MarkRentalNoShowUseCase } from '../../application/use-cases/mark-rental-no-show.use-case';
import {
  CommitHandoverBodySchema,
  DeliveryIdempotencyKeySchema,
  MarkNoShowBodySchema,
  RentalOrderIdParamSchema,
  type CommitHandoverBodyDto,
  type MarkNoShowBodyDto,
  type RentalOrderIdParamDto,
} from '../dtos/delivery.dto';

@ApiTags('Rental Handover')
@ApiBearerAuth('bearer')
@Controller('rental-orders')
@Auth([AuthType.Bearer])
export class RentalHandoverController {
  constructor(
    private readonly commitHandoverUseCase: CommitRentalHandoverUseCase,
    private readonly markNoShowUseCase: MarkRentalNoShowUseCase,
    private readonly pickupCodeUseCase: GetRentalPickupCodeUseCase,
    private readonly handoverPreviewUseCase: GetRentalHandoverPreviewUseCase,
  ) {}

  @Post(':id/handover')
  @Roles(UserRole.STAFF_DELIVERY)
  @HttpCode(200)
  @ApiOperation({
    summary: 'RB-API-404 — Bàn giao toàn bộ package cho khách hàng',
    description:
      'Nhân viên giao hàng xác nhận đã bàn giao toàn bộ package cho khách. ' +
      'Yêu cầu verificationRef (mã xác minh từ bước verify-user) và packageId. ' +
      'Có thể kèm ghi chú và danh sách sự cố phát hiện tại thời điểm giao.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID đơn hàng thuê', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Khóa duy nhất để tránh gọi trùng (8–200 ký tự)', example: 'handover-20261005-abc123' })
  @ApiBody({
    description: 'Thông tin bàn giao package',
    schema: {
      type: 'object',
      required: ['packageId', 'verificationRef', 'expectedVersion'],
      properties: {
        packageId: { type: 'string', format: 'uuid', description: 'UUID package được bàn giao', example: '660e8400-e29b-41d4-a716-446655440002' },
        verificationRef: { type: 'string', minLength: 8, maxLength: 180, description: 'Mã xác minh từ bước verify-user', example: 'VERIFY-REF-8A3F-2026' },
        recipientNotes: { type: 'string', maxLength: 2000, description: 'Ghi chú từ khách nhận (tùy chọn)', example: 'Khách yêu cầu hướng dẫn sử dụng thêm' },
        reportedIssues: {
          type: 'array', description: 'Sự cố phát hiện tại thời điểm giao (tùy chọn)',
          items: {
            type: 'object',
            properties: {
              unitId: { type: 'string', format: 'uuid', description: 'UUID thiết bị có sự cố (tùy chọn)' },
              type: { type: 'string', description: 'Loại sự cố', example: 'SCRATCHED' },
              description: { type: 'string', description: 'Mô tả chi tiết sự cố', example: 'Vết xước nhỏ trên khung xe' },
            },
          },
        },
        expectedVersion: { type: 'integer', minimum: 1, description: 'Phiên bản task hiện tại', example: 4 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Bàn giao thành công, đơn hàng chuyển sang trạng thái ACTIVE' })
  @ApiResponse({ status: 409, description: 'Xung đột phiên bản' })
  @ApiResponse({ status: 422, description: 'VerificationRef không hợp lệ hoặc package chưa sẵn sàng' })
  async handover(
    @Param(new ZodValidationPipe(RentalOrderIdParamSchema)) params: RentalOrderIdParamDto,
    @Body(new ZodValidationPipe(CommitHandoverBodySchema)) body: CommitHandoverBodyDto,
    @Headers('idempotency-key') rawKey: string | undefined,
    @ActiveUser('id') actorUserId: string,
  ) {
    return this.commitHandoverUseCase.execute({
      actorUserId,
      orderId: params.id,
      packageId: body.packageId,
      verificationRef: body.verificationRef,
      recipientNotes: body.recipientNotes,
      reportedIssues: body.reportedIssues,
      expectedVersion: body.expectedVersion,
      idempotencyKey: requireDeliveryIdempotencyKey(rawKey),
    });
  }

  @Post(':id/no-show')
  @Roles(UserRole.STAFF_DELIVERY)
  @HttpCode(200)
  @ApiOperation({
    summary: 'RB-API-405 — Ghi nhận khách không đến / từ chối nhận',
    description:
      'Nhân viên giao hàng ghi nhận trường hợp khách không đến hoặc từ chối nhận thiết bị. ' +
      'Phải gọi TRƯỚC khi bàn giao thực tế. ' +
      'Lý do bao gồm: khách vắng mặt, đổi ý, từ chối do tình trạng, lỗi hệ thống, v.v.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID đơn hàng thuê' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Khóa duy nhất để tránh gọi trùng', example: 'noshow-20261005-def456' })
  @ApiBody({
    description: 'Thông tin no-show / từ chối',
    schema: {
      type: 'object',
      required: ['reason', 'expectedVersion'],
      properties: {
        reason: {
          type: 'string', description: 'Lý do no-show/từ chối',
          enum: ['NO_SHOW', 'USER_NO_SHOW', 'USER_CHANGED_MIND', 'USER_REFUSED_DISCLOSED_CONDITION', 'SYSTEM_WRONG_EQUIPMENT', 'SYSTEM_DAMAGED_EQUIPMENT', 'SYSTEM_MISSING_EQUIPMENT', 'OTHER_SYSTEM_FAULT'],
          example: 'USER_NO_SHOW',
        },
        notes: { type: 'string', maxLength: 2000, description: 'Ghi chú bổ sung (tùy chọn)', example: 'Đã chờ 30 phút tại điểm hẹn' },
        evidenceIds: { type: 'array', items: { type: 'string', format: 'uuid' }, description: 'UUID ảnh/video minh chứng (tùy chọn)' },
        expectedVersion: { type: 'integer', minimum: 1, description: 'Phiên bản task hiện tại', example: 3 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Đã ghi nhận no-show/từ chối thành công' })
  @ApiResponse({ status: 409, description: 'Xung đột phiên bản' })
  async noShow(
    @Param(new ZodValidationPipe(RentalOrderIdParamSchema)) params: RentalOrderIdParamDto,
    @Body(new ZodValidationPipe(MarkNoShowBodySchema)) body: MarkNoShowBodyDto,
    @Headers('idempotency-key') rawKey: string | undefined,
    @ActiveUser('id') actorUserId: string,
  ) {
    return this.markNoShowUseCase.execute({
      actorUserId,
      orderId: params.id,
      reason: body.reason,
      notes: body.notes,
      evidenceIds: body.evidenceIds,
      expectedVersion: body.expectedVersion,
      idempotencyKey: requireDeliveryIdempotencyKey(rawKey),
    });
  }

  @Get(':id/pickup-code')
  @Roles(UserRole.USER, UserRole.LEADER)
  @ApiOperation({
    summary: 'RB-API-407 — Lấy mã pickup một lần cho khách hàng',
    description:
      'Tạo hoặc xoay mã pickup ngắn hạn (OTP) để khách hàng cung cấp cho nhân viên giao hàng ' +
      'nhằm xác minh danh tính khi nhận thiết bị. ' +
      'Response không được cache (Cache-Control: no-store).',
  })
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Pragma', 'no-cache')
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID đơn hàng thuê', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: 200, description: 'Mã pickup và thời hạn hiệu lực' })
  @ApiResponse({ status: 404, description: 'Đơn hàng không tồn tại hoặc không thuộc quyền truy cập' })
  async pickupCode(
    @Param(new ZodValidationPipe(RentalOrderIdParamSchema)) params: RentalOrderIdParamDto,
    @ActiveUser('id') actorUserId: string,
  ) {
    return this.pickupCodeUseCase.execute({ actorUserId, orderId: params.id });
  }

  @Get(':id/handover-preview')
  @Roles(UserRole.USER, UserRole.LEADER)
  @ApiOperation({
    summary: 'RB-API-409 — Xem trước package và tình trạng trước giao hàng',
    description:
      'Khách hàng xem trước thông tin package sẽ nhận, bao gồm danh sách thiết bị, ' +
      'condition-before snapshots, và phụ kiện kèm theo. Mỗi món có product { id, name, grade }. ' +
      'API chỉ đọc, không thay đổi dữ liệu.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID đơn hàng thuê', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: 200, description: 'Thông tin preview package + condition-before' })
  @ApiResponse({ status: 404, description: 'Đơn hàng không tồn tại' })
  async preview(
    @Param(new ZodValidationPipe(RentalOrderIdParamSchema)) params: RentalOrderIdParamDto,
    @ActiveUser('id') actorUserId: string,
  ) {
    return this.handoverPreviewUseCase.execute({ actorUserId, orderId: params.id });
  }
}

function requireDeliveryIdempotencyKey(raw: string | undefined): string {
  const parsed = DeliveryIdempotencyKeySchema.safeParse(raw);
  if (!parsed.success) throw AppError.fromCode(DL.IDEMPOTENCY_KEY_REQUIRED);
  return parsed.data;
}
