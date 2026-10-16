import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from 'src/shared/constants';
import { AuthType } from 'src/shared/constants/auth.constant';
import { ActiveUser } from 'src/shared/decorators/active-user.decorator';
import { Auth } from 'src/shared/decorators/auth.decorator';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { AppError } from 'src/shared/errors/app-error';
import { DELIVERY_ERROR_CODES as DL } from 'src/shared/errors/codes/delivery.error-codes';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import { ClaimDeliveryTaskUseCase } from '../../application/use-cases/claim-delivery-task.use-case';
import { GetDeliveryTaskUseCase } from '../../application/use-cases/get-delivery-task.use-case';
import { ListDeliveryTasksUseCase } from '../../application/use-cases/list-delivery-tasks.use-case';
import { ReceivePackageUseCase } from '../../application/use-cases/receive-package.use-case';
import { VerifyRentalRecipientUseCase } from '../../application/use-cases/verify-rental-recipient.use-case';
import {
  ClaimDeliveryTaskBodySchema,
  ListDeliveryTasksQuerySchema,
  DeliveryIdempotencyKeySchema,
  DeliveryTaskIdParamSchema,
  ReceivePackageBodySchema,
  VerifyRecipientBodySchema,
  type ClaimDeliveryTaskBodyDto,
  type ListDeliveryTasksQueryDto,
  type DeliveryTaskIdParamDto,
  type ReceivePackageBodyDto,
  type VerifyRecipientBodyDto,
} from '../dtos/delivery.dto';

@ApiTags('Giao nhận thiết bị (Delivery Tasks)')
@ApiBearerAuth('bearer')
@Controller(['delivery/tasks', 'logistics/tasks'])
@Auth([AuthType.Bearer])
@Roles(UserRole.STAFF_DELIVERY)
export class DeliveryTaskController {
  constructor(
    private readonly listTasksUseCase: ListDeliveryTasksUseCase,
    private readonly getTaskUseCase: GetDeliveryTaskUseCase,
    private readonly claimTaskUseCase: ClaimDeliveryTaskUseCase,
    private readonly receivePackageUseCase: ReceivePackageUseCase,
    private readonly verifyRecipientUseCase: VerifyRentalRecipientUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'RB-API-401 — Danh sách task giao hàng (STAFF_DELIVERY)',
    description:
      'Trả về danh sách các task giao hàng phân trang cho nhân viên giao hàng đang đăng nhập. ' +
      'Hỗ trợ lọc theo ngày, loại (OUTBOUND = giao đi, RETURN = nhận trả), và trạng thái.',
  })
  @ApiQuery({ name: 'date', required: false, type: String, description: 'Ngày lọc (YYYY-MM-DD)', example: '2026-10-05' })
  @ApiQuery({ name: 'type', required: false, type: String, description: 'Loại task giao hàng', enum: ['OUTBOUND', 'RETURN'] })
  @ApiQuery({
    name: 'status', required: false, type: String, description: 'Trạng thái task',
    enum: ['SCHEDULED', 'PACKAGE_RECEIVED', 'RECIPIENT_VERIFIED', 'HANDED_OVER', 'COLLECTING', 'RETURNED', 'INVENTORY_RECEIVED', 'NO_SHOW', 'REFUSED', 'CLOSED', 'BLOCKED', 'CANCELLED'],
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Trang hiện tại (mặc định 1)', example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Số item mỗi trang (mặc định 20, tối đa 100)', example: 20 })
  @ApiResponse({ status: 200, description: 'Danh sách task giao hàng và thông tin phân trang' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực — thiếu hoặc sai Bearer token' })
  async list(
    @Query(new ZodValidationPipe(ListDeliveryTasksQuerySchema)) query: ListDeliveryTasksQueryDto,
    @ActiveUser('id') actorUserId: string,
  ) {
    return this.listTasksUseCase.execute({ actorUserId, ...query });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'RB-API-410 — Chi tiết task giao hàng',
    description:
      'Lấy thông tin chi tiết một task giao hàng, bao gồm: package, trạng thái custody, ' +
      'thông tin khách nhận, lịch sử chuyển giao, và mã pickup (nếu có).',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID của task giao hàng', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: 200, description: 'Thông tin chi tiết task giao hàng' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy task với ID đã cho' })
  async detail(
    @Param(new ZodValidationPipe(DeliveryTaskIdParamSchema)) params: DeliveryTaskIdParamDto,
    @ActiveUser('id') actorUserId: string,
  ) {
    return this.getTaskUseCase.execute({ actorUserId, taskId: params.id });
  }

  @Post(':id/claim')
  @HttpCode(200)
  @ApiOperation({
    summary: 'RB-API-406 — Nhận (claim) task giao hàng',
    description:
      'Nhân viên giao hàng nhận task giao hàng để xử lý. ' +
      'Task phải ở trạng thái SCHEDULED. Sau khi claim, task được gán cho nhân viên đang đăng nhập.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID của task giao hàng' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Khóa duy nhất để tránh gọi trùng (8–200 ký tự)', example: 'claim-dlv-20261005-abc123' })
  @ApiBody({
    description: 'Phiên bản task hiện tại (optimistic lock)',
    schema: {
      type: 'object',
      required: ['expectedVersion'],
      properties: {
        expectedVersion: { type: 'integer', minimum: 1, description: 'Phiên bản task hiện tại', example: 1 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Task giao hàng đã được nhận thành công' })
  @ApiResponse({ status: 409, description: 'Xung đột phiên bản hoặc task đã được nhận bởi người khác' })
  async claim(
    @Param(new ZodValidationPipe(DeliveryTaskIdParamSchema)) params: DeliveryTaskIdParamDto,
    @Body(new ZodValidationPipe(ClaimDeliveryTaskBodySchema)) body: ClaimDeliveryTaskBodyDto,
    @Headers('idempotency-key') rawKey: string | undefined,
    @ActiveUser('id') actorUserId: string,
  ) {
    return this.claimTaskUseCase.execute({
      actorUserId,
      taskId: params.id,
      expectedVersion: body.expectedVersion,
      idempotencyKey: requireDeliveryIdempotencyKey(rawKey),
    });
  }

  @Post(':id/receive-package')
  @HttpCode(200)
  @ApiOperation({
    summary: 'RB-API-402 — Nhận package từ kho (custody transfer)',
    description:
      'Nhân viên giao hàng xác nhận đã nhận package từ kho thông qua custody transfer. ' +
      'Cần cung cấp custodyTransferId (từ yêu cầu chuyển giao) và packageCode để xác minh.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID của task giao hàng' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Khóa duy nhất để tránh gọi trùng', example: 'recv-pkg-20261005-def456' })
  @ApiBody({
    description: 'Thông tin nhận package',
    schema: {
      type: 'object',
      required: ['custodyTransferId', 'packageCode', 'expectedVersion'],
      properties: {
        custodyTransferId: { type: 'string', format: 'uuid', description: 'UUID yêu cầu chuyển giao từ nhân viên kho', example: '990e8400-e29b-41d4-a716-446655440010' },
        packageCode: { type: 'string', minLength: 3, maxLength: 120, description: 'Mã package để xác minh (quét từ barcode)', example: 'PKG-2026-1005-001' },
        expectedVersion: { type: 'integer', minimum: 1, description: 'Phiên bản task hiện tại', example: 2 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Package đã được nhận, custody chuyển sang nhân viên giao hàng' })
  @ApiResponse({ status: 409, description: 'Xung đột phiên bản' })
  @ApiResponse({ status: 422, description: 'CustodyTransferId không hợp lệ hoặc packageCode không khớp' })
  async receivePackage(
    @Param(new ZodValidationPipe(DeliveryTaskIdParamSchema)) params: DeliveryTaskIdParamDto,
    @Body(new ZodValidationPipe(ReceivePackageBodySchema)) body: ReceivePackageBodyDto,
    @Headers('idempotency-key') rawKey: string | undefined,
    @ActiveUser('id') actorUserId: string,
  ) {
    return this.receivePackageUseCase.execute({
      actorUserId,
      taskId: params.id,
      custodyTransferId: body.custodyTransferId,
      packageCode: body.packageCode,
      expectedVersion: body.expectedVersion,
      idempotencyKey: requireDeliveryIdempotencyKey(rawKey),
    });
  }

  @Post(':id/verify-user')
  @HttpCode(200)
  @ApiOperation({
    summary: 'RB-API-403 — Xác thực người nhận bằng mã pickup',
    description:
      'Nhân viên giao hàng nhập mã pickup một lần (OTP) mà khách hàng cung cấp ' +
      'để xác minh danh tính người nhận trước khi bàn giao thiết bị.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID của task giao hàng' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Khóa duy nhất để tránh gọi trùng', example: 'verify-20261005-ghi789' })
  @ApiBody({
    description: 'Mã xác thực người nhận',
    schema: {
      type: 'object',
      required: ['pickupCode', 'expectedVersion'],
      properties: {
        pickupCode: { type: 'string', minLength: 1, maxLength: 128, description: 'Mã pickup một lần từ khách hàng', example: 'TREK-8A3F' },
        expectedVersion: { type: 'integer', minimum: 1, description: 'Phiên bản task hiện tại', example: 3 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Người nhận đã được xác thực thành công' })
  @ApiResponse({ status: 409, description: 'Xung đột phiên bản' })
  @ApiResponse({ status: 422, description: 'Mã pickup không đúng hoặc đã hết hạn' })
  async verifyRecipient(
    @Param(new ZodValidationPipe(DeliveryTaskIdParamSchema)) params: DeliveryTaskIdParamDto,
    @Body(new ZodValidationPipe(VerifyRecipientBodySchema)) body: VerifyRecipientBodyDto,
    @Headers('idempotency-key') rawKey: string | undefined,
    @ActiveUser('id') actorUserId: string,
  ) {
    return this.verifyRecipientUseCase.execute({
      actorUserId,
      taskId: params.id,
      pickupCode: body.pickupCode,
      expectedVersion: body.expectedVersion,
      idempotencyKey: requireDeliveryIdempotencyKey(rawKey),
    });
  }
}

function requireDeliveryIdempotencyKey(raw: string | undefined): string {
  const parsed = DeliveryIdempotencyKeySchema.safeParse(raw);
  if (!parsed.success) throw AppError.fromCode(DL.IDEMPOTENCY_KEY_REQUIRED);
  return parsed.data;
}
