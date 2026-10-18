import { Body, Controller, Header, Headers, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from 'src/shared/constants';
import { AuthType } from 'src/shared/constants/auth.constant';
import { ActiveUser } from 'src/shared/decorators/active-user.decorator';
import { Auth } from 'src/shared/decorators/auth.decorator';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { AppError } from 'src/shared/errors/app-error';
import { RENTAL_RETURN_ERROR_CODES as RR } from 'src/shared/errors/codes/rental-return.error-codes';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import { ReturnToInventoryLocationUseCase } from '../../application/use-cases/return-to-inventory-location.use-case';
import { RentalReturnIdempotencyKeySchema, ReturnIdParamSchema, ReturnToInventoryLocationBodySchema, type ReturnIdParamDto, type ReturnToInventoryLocationBodyDto } from '../dtos/rental-return.dto';

@ApiTags('Rental Return Delivery')
@ApiBearerAuth('bearer')
@Controller(['delivery/tasks', 'logistics/tasks'])
@Auth([AuthType.Bearer])
export class DeliveryReturnController {
  constructor(private readonly useCase: ReturnToInventoryLocationUseCase) {}

  @Post([
    ':returnId/return-to-inventory-location',
    ':id/return-to-inventory-location',
    ':returnId/return-to-warehouse',
    ':id/return-to-warehouse',
  ])
  @Roles(UserRole.STAFF_DELIVERY)
  @HttpCode(200)
  @ApiOperation({
    summary: 'RB-API-603 — Yêu cầu chuyển giao thiết bị trả về kho (Delivery → Inventory)',
    description:
      'Nhân viên giao hàng gửi yêu cầu chuyển quyền giám sát (custody transfer) ' +
      'các thiết bị đã thu hồi từ khách về kho (Inventory Location). ' +
      'Kho sẽ nhận được pending transfer và phải xác nhận bằng RB-API-604 (receive). ' +
      'Có thể kèm packageId và pendingTransferId nếu đã có từ hệ thống.',
  })
  @ApiParam({ name: 'returnId', type: String, format: 'uuid', description: 'UUID task trả hàng', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Khóa duy nhất để tránh gọi trùng (8–200 ký tự)', example: 'return-inv-20261005-abc123' })
  @ApiBody({
    description: 'Thông tin chuyển giao thiết bị về kho',
    schema: {
      type: 'object',
      required: ['unitIds', 'expectedVersion'],
      properties: {
        unitIds: { type: 'array', items: { type: 'string', format: 'uuid' }, minItems: 1, maxItems: 100, description: 'UUID các thiết bị cần chuyển về kho', example: ['550e8400-e29b-41d4-a716-446655440001'] },
        packageId: { type: 'string', format: 'uuid', description: 'UUID package chứa thiết bị (tùy chọn)', example: '660e8400-e29b-41d4-a716-446655440002' },
        pendingTransferId: { type: 'string', format: 'uuid', description: 'UUID pending transfer đã tồn tại (tùy chọn)' },
        expectedVersion: { type: 'integer', minimum: 1, description: 'Phiên bản task hiện tại', example: 3 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Yêu cầu chuyển giao đã được tạo, chờ kho xác nhận nhận hàng' })
  @ApiResponse({ status: 409, description: 'Xung đột phiên bản' })
  @ApiResponse({ status: 422, description: 'Unit không thuộc task hoặc chưa ở trạng thái hợp lệ để chuyển giao' })
  async execute(
    @Param(new ZodValidationPipe(ReturnIdParamSchema)) params: ReturnIdParamDto,
    @Body(new ZodValidationPipe(ReturnToInventoryLocationBodySchema)) body: ReturnToInventoryLocationBodyDto,
    @Headers('idempotency-key') rawKey: string | undefined,
    @ActiveUser('id') actorUserId: string,
  ) {
    return this.useCase.execute({ actorUserId, deliveryTaskId: params.returnId, ...body, idempotencyKey: requireKey(rawKey), now: new Date() });
  }
}

function requireKey(raw: string | undefined) { const parsed = RentalReturnIdempotencyKeySchema.safeParse(raw); if (!parsed.success) throw AppError.fromCode(RR.IDEMPOTENCY_KEY_REQUIRED); return parsed.data; }
