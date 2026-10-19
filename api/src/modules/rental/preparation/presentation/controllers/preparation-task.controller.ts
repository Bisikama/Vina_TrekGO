import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from 'src/shared/constants';
import { AuthType } from 'src/shared/constants/auth.constant';
import { ActiveUser } from 'src/shared/decorators/active-user.decorator';
import { Auth } from 'src/shared/decorators/auth.decorator';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { AppError } from 'src/shared/errors/app-error';
import { PREPARATION_ERROR_CODES as PR } from 'src/shared/errors/codes/preparation.error-codes';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import { ClaimPreparationTaskUseCase } from '../../application/use-cases/claim-preparation-task.use-case';
import { GetPreparationTaskUseCase } from '../../application/use-cases/get-preparation-task.use-case';
import { ListPickCandidatesUseCase } from '../../application/use-cases/list-pick-candidates.use-case';
import { ListReplacementCandidatesUseCase } from '../../application/use-cases/list-replacement-candidates.use-case';
import { ListPreparationTasksUseCase } from '../../application/use-cases/list-preparation-tasks.use-case';
import { MarkPreparationReadyUseCase } from '../../application/use-cases/mark-preparation-ready.use-case';
import { PackPreparationPackageUseCase } from '../../application/use-cases/pack-preparation-package.use-case';
import { PickPreparationUnitsUseCase } from '../../application/use-cases/pick-preparation-units.use-case';
import { ReplacePreparationUnitUseCase } from '../../application/use-cases/replace-preparation-unit.use-case';
import { RequestPreparationTransferUseCase } from '../../application/use-cases/request-preparation-transfer.use-case';
import { SavePreHandoverConditionUseCase } from '../../application/use-cases/save-pre-handover-condition.use-case';
import {
  ClaimPreparationTaskBodySchema,
  ListPreparationTasksQuerySchema,
  MarkPreparationReadyBodySchema,
  PackPreparationPackageBodySchema,
  PickCandidatesQuerySchema,
  PickPreparationUnitsBodySchema,
  ReplacementCandidatesQuerySchema,
  ReplacePreparationUnitBodySchema,
  RequestPreparationTransferBodySchema,
  SaveConditionSnapshotBodySchema,
  InventoryLocationIdempotencyKeySchema,
  PreparationTaskIdParamSchema,
  type ClaimPreparationTaskBodyDto,
  type ListPreparationTasksQueryDto,
  type MarkPreparationReadyBodyDto,
  type PackPreparationPackageBodyDto,
  type PickCandidatesQueryDto,
  type PickPreparationUnitsBodyDto,
  type ReplacementCandidatesQueryDto,
  type ReplacePreparationUnitBodyDto,
  type RequestPreparationTransferBodyDto,
  type SaveConditionSnapshotBodyDto,
  type PreparationTaskIdParamDto,
} from '../dtos/preparation-task.dto';

@ApiTags('Preparation Tasks - Chuẩn Bị Đơn Hàng')
@ApiBearerAuth('bearer')
@Controller(['staff/warehouse/tasks', 'staff/preparation/tasks', 'inventory/tasks'])
@Auth([AuthType.Bearer])
@Roles(UserRole.STAFF_INVENTORY)
export class PreparationTaskController {
  constructor(
    private readonly listTasksUseCase: ListPreparationTasksUseCase,
    private readonly getTaskUseCase: GetPreparationTaskUseCase,
    private readonly pickUnitsUseCase: PickPreparationUnitsUseCase,
    private readonly saveConditionUseCase: SavePreHandoverConditionUseCase,
    private readonly packPackageUseCase: PackPreparationPackageUseCase,
    private readonly markReadyUseCase: MarkPreparationReadyUseCase,
    private readonly replaceUnitUseCase: ReplacePreparationUnitUseCase,
    private readonly claimTaskUseCase: ClaimPreparationTaskUseCase,
    private readonly requestTransferUseCase: RequestPreparationTransferUseCase,
    private readonly replacementCandidatesUseCase: ListReplacementCandidatesUseCase,
    private readonly pickCandidatesUseCase: ListPickCandidatesUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'RB-API-301 — Danh sách task chuẩn bị (STAFF_INVENTORY)',
    description:
      'Trả về danh sách các task chuẩn bị thiết bị cho thuê, phân trang. ' +
      'Hỗ trợ lọc theo ngày, trạng thái, và tripId. ' +
      'Chỉ hiển thị task thuộc phạm vi nhân viên kho đang đăng nhập.',
  })
  @ApiQuery({ name: 'date', required: false, type: String, description: 'Ngày lọc (YYYY-MM-DD)', example: '2026-10-05' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Trạng thái task', enum: ['OPEN', 'PICKING', 'CONDITION_CAPTURED', 'PACKED', 'READY', 'TRANSFERRED', 'RETURN_RECEIVED', 'CLOSED', 'BLOCKED', 'CANCELLED'] })
  @ApiQuery({ name: 'tripId', required: false, type: String, description: 'UUID chuyến đi liên quan', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Trang hiện tại (mặc định 1)', example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Số item mỗi trang (mặc định 20, tối đa 100)', example: 20 })
  @ApiResponse({ status: 200, description: 'Danh sách task chuẩn bị và thông tin phân trang' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực — thiếu hoặc sai Bearer token' })
  async listTasks(
    @Query(new ZodValidationPipe(ListPreparationTasksQuerySchema)) query: ListPreparationTasksQueryDto,
    @ActiveUser('id') actorUserId: string,
  ) {
    return this.listTasksUseCase.execute({ actorUserId, ...query });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'RB-API-302 — Chi tiết task chuẩn bị',
    description:
      'Lấy thông tin chi tiết một task chuẩn bị bao gồm: danh sách thiết bị, ' +
      'trạng thái pick/pack, condition snapshots, package và lịch sử thay đổi.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID của task chuẩn bị', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: 200, description: 'Thông tin chi tiết task chuẩn bị' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy task với ID đã cho' })
  async getTask(
    @Param(new ZodValidationPipe(PreparationTaskIdParamSchema)) params: PreparationTaskIdParamDto,
    @ActiveUser('id') actorUserId: string,
  ) {
    return this.getTaskUseCase.execute({ actorUserId, taskId: params.id });
  }

  @Post(':id/pick')
  @HttpCode(200)
  @ApiOperation({
    summary: 'RB-API-303 — Pick (gán) thiết bị cụ thể sau thanh toán',
    description:
      'Nhân viên kho quét mã asset để gán (pick) thiết bị cụ thể vào đơn hàng. ' +
      'Các assetCode phải duy nhất trong cùng một request. ' +
      'Yêu cầu Idempotency-Key và expectedVersion để tránh xung đột đồng thời.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID của task chuẩn bị' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Khóa duy nhất để tránh gọi trùng (8–200 ký tự)', example: 'pick-20261005-abc123xy' })
  @ApiBody({
    description: 'Danh sách mã asset cần pick và phiên bản task hiện tại',
    schema: {
      type: 'object',
      required: ['assetCodes', 'expectedVersion'],
      properties: {
        assetCodes: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 100, description: 'Mảng mã asset thiết bị (quét QR/barcode)', example: ['TREK-BIKE-001', 'TREK-BIKE-002'] },
        expectedVersion: { type: 'integer', minimum: 1, description: 'Phiên bản task hiện tại (optimistic lock)', example: 1 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Kết quả pick: pickedUnits, assignments, progress, taskVersion' })
  @ApiResponse({ status: 409, description: 'Xung đột phiên bản — task đã bị cập nhật bởi người khác' })
  @ApiResponse({ status: 422, description: 'AssetCode không hợp lệ hoặc thiết bị không khả dụng' })
  async pickUnits(
    @Param(new ZodValidationPipe(PreparationTaskIdParamSchema)) params: PreparationTaskIdParamDto,
    @Body(new ZodValidationPipe(PickPreparationUnitsBodySchema)) body: PickPreparationUnitsBodyDto,
    @Headers('idempotency-key') rawKey: string | undefined,
    @ActiveUser('id') actorUserId: string,
  ) {
    return this.pickUnitsUseCase.execute({
      actorUserId,
      taskId: params.id,
      assetCodes: body.assetCodes,
      expectedVersion: body.expectedVersion,
      idempotencyKey: requireInventoryLocationIdempotencyKey(rawKey),
    });
  }

  @Post(':id/condition-snapshots')
  @ApiOperation({
    summary: 'RB-API-304 — Lưu bằng chứng tình trạng trước giao (PRE_HANDOVER)',
    description:
      'Lưu bản ghi tình trạng thiết bị (condition snapshot) bất biến trước khi giao cho khách. ' +
      'Bao gồm đánh giá condition, ghi chú, phụ kiện kèm theo, và danh sách evidence (hình ảnh/video). ' +
      'Mỗi snapshot không thể sửa đổi sau khi tạo.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID của task chuẩn bị' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Khóa duy nhất để tránh gọi trùng (8–200 ký tự)', example: 'cond-20261005-xyz789' })
  @ApiBody({
    description: 'Thông tin tình trạng thiết bị trước giao hàng',
    schema: {
      type: 'object',
      required: ['unitId', 'condition', 'evidenceIds', 'expectedVersion'],
      properties: {
        unitId: { type: 'string', format: 'uuid', description: 'UUID thiết bị cần ghi nhận tình trạng', example: '550e8400-e29b-41d4-a716-446655440001' },
        condition: { type: 'string', enum: ['NEW', 'GOOD', 'FAIR', 'DAMAGED', 'LOST'], description: 'Mức đánh giá tình trạng', example: 'GOOD' },
        notes: { type: 'string', maxLength: 2000, description: 'Ghi chú bổ sung (tùy chọn)', example: 'Xe có vết xước nhỏ ở tay lái bên phải' },
        accessories: {
          type: 'array', description: 'Danh sách phụ kiện kèm theo',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Tên phụ kiện', example: 'Khóa xe' },
              expectedQuantity: { type: 'integer', description: 'Số lượng kỳ vọng', example: 1 },
              actualQuantity: { type: 'integer', description: 'Số lượng thực tế', example: 1 },
            },
          },
        },
        evidenceIds: { type: 'array', items: { type: 'string', format: 'uuid' }, minItems: 1, maxItems: 5, description: 'UUID ảnh/video minh chứng (đã upload trước)', example: ['550e8400-e29b-41d4-a716-446655440106'] },
        expectedVersion: { type: 'integer', minimum: 1, description: 'Phiên bản task hiện tại', example: 2 },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Snapshot tình trạng đã được lưu thành công (bất biến)' })
  @ApiResponse({ status: 409, description: 'Xung đột phiên bản' })
  async saveConditionSnapshot(
    @Param(new ZodValidationPipe(PreparationTaskIdParamSchema)) params: PreparationTaskIdParamDto,
    @Body(new ZodValidationPipe(SaveConditionSnapshotBodySchema)) body: SaveConditionSnapshotBodyDto,
    @Headers('idempotency-key') rawKey: string | undefined,
    @ActiveUser('id') actorUserId: string,
  ) {
    return this.saveConditionUseCase.execute({
      actorUserId,
      taskId: params.id,
      unitId: body.unitId,
      condition: body.condition,
      notes: body.notes,
      accessories: body.accessories,
      evidenceIds: body.evidenceIds,
      expectedVersion: body.expectedVersion,
      idempotencyKey: requireInventoryLocationIdempotencyKey(rawKey),
    });
  }

  @Post(':id/pack')
  @HttpCode(200)
  @ApiOperation({
    summary: 'RB-API-305 — Đóng gói (pack) thiết bị đã pick và ghi nhận tình trạng',
    description:
      'Đóng gói các thiết bị đã được pick và đã có condition snapshot. ' +
      'Tất cả unitId phải đã được pick trước đó và phải có condition-before evidence. ' +
      'Sau bước này, package chuyển sang trạng thái PACKED.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID của task chuẩn bị' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Khóa duy nhất để tránh gọi trùng', example: 'pack-20261005-def456' })
  @ApiBody({
    description: 'Danh sách unit cần đóng gói',
    schema: {
      type: 'object',
      required: ['unitIds', 'expectedVersion'],
      properties: {
        unitIds: { type: 'array', items: { type: 'string', format: 'uuid' }, minItems: 1, maxItems: 100, description: 'UUID các thiết bị cần đóng gói (phải duy nhất)', example: ['550e8400-e29b-41d4-a716-446655440001'] },
        expectedVersion: { type: 'integer', minimum: 1, description: 'Phiên bản task hiện tại', example: 3 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Package đã được đóng gói thành công' })
  @ApiResponse({ status: 409, description: 'Xung đột phiên bản' })
  @ApiResponse({ status: 422, description: 'Unit chưa pick hoặc chưa có condition snapshot' })
  async packPackage(
    @Param(new ZodValidationPipe(PreparationTaskIdParamSchema)) params: PreparationTaskIdParamDto,
    @Body(new ZodValidationPipe(PackPreparationPackageBodySchema)) body: PackPreparationPackageBodyDto,
    @Headers('idempotency-key') rawKey: string | undefined,
    @ActiveUser('id') actorUserId: string,
  ) {
    return this.packPackageUseCase.execute({
      actorUserId,
      taskId: params.id,
      unitIds: body.unitIds,
      expectedVersion: body.expectedVersion,
      idempotencyKey: requireInventoryLocationIdempotencyKey(rawKey),
    });
  }

  @Post(':id/ready')
  @HttpCode(200)
  @ApiOperation({
    summary: 'RB-API-306 — Đánh dấu sẵn sàng giao (READY_FOR_HANDOVER)',
    description:
      'Đánh dấu package đã sẵn sàng giao cho khách. ' +
      'Hệ thống tự động tạo DeliveryTask (HANDOVER) cho nhân viên giao hàng. ' +
      'Package phải ở trạng thái PACKED trước khi gọi API này.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID của task chuẩn bị' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Khóa duy nhất để tránh gọi trùng', example: 'ready-20261005-ghi789' })
  @ApiBody({
    description: 'ID package và phiên bản task',
    schema: {
      type: 'object',
      required: ['packageId', 'expectedVersion'],
      properties: {
        packageId: { type: 'string', format: 'uuid', description: 'UUID package đã đóng gói', example: '660e8400-e29b-41d4-a716-446655440002' },
        expectedVersion: { type: 'integer', minimum: 1, description: 'Phiên bản task hiện tại', example: 4 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Task chuyển sang READY, DeliveryTask HANDOVER được tạo tự động' })
  @ApiResponse({ status: 409, description: 'Xung đột phiên bản' })
  @ApiResponse({ status: 422, description: 'Package chưa ở trạng thái PACKED' })
  async markReady(
    @Param(new ZodValidationPipe(PreparationTaskIdParamSchema)) params: PreparationTaskIdParamDto,
    @Body(new ZodValidationPipe(MarkPreparationReadyBodySchema)) body: MarkPreparationReadyBodyDto,
    @Headers('idempotency-key') rawKey: string | undefined,
    @ActiveUser('id') actorUserId: string,
  ) {
    return this.markReadyUseCase.execute({
      actorUserId,
      taskId: params.id,
      packageId: body.packageId,
      expectedVersion: body.expectedVersion,
      idempotencyKey: requireInventoryLocationIdempotencyKey(rawKey),
    });
  }

  @Post(':id/replace-unit')
  @HttpCode(200)
  @ApiOperation({
    summary: 'RB-API-307 — Thay thế thiết bị trước khi giao hàng',
    description:
      'Thay thế nguyên tử (atomic swap) một thiết bị đã pick bằng thiết bị khác. ' +
      'Thiết bị mới phải cùng loại sản phẩm và đang khả dụng. ' +
      'Thiết bị cũ sẽ được trả về kho. oldUnitId và newUnitId không được trùng nhau.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID của task chuẩn bị' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Khóa duy nhất để tránh gọi trùng', example: 'replace-20261005-jkl012' })
  @ApiBody({
    description: 'Thông tin thay thế thiết bị',
    schema: {
      type: 'object',
      required: ['oldUnitId', 'newUnitId', 'reason', 'expectedVersion'],
      properties: {
        oldUnitId: { type: 'string', format: 'uuid', description: 'UUID thiết bị cần thay thế', example: '550e8400-e29b-41d4-a716-446655440001' },
        newUnitId: { type: 'string', format: 'uuid', description: 'UUID thiết bị thay thế (phải khác oldUnitId)', example: '550e8400-e29b-41d4-a716-446655440099' },
        reason: { type: 'string', minLength: 3, maxLength: 1000, description: 'Lý do thay thế', example: 'Phát hiện lỗi phanh trong quá trình kiểm tra' },
        expectedVersion: { type: 'integer', minimum: 1, description: 'Phiên bản task hiện tại', example: 3 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Thiết bị đã được thay thế thành công' })
  @ApiResponse({ status: 409, description: 'Xung đột phiên bản' })
  @ApiResponse({ status: 422, description: 'Thiết bị mới không cùng loại hoặc không khả dụng' })
  async replaceUnit(
    @Param(new ZodValidationPipe(PreparationTaskIdParamSchema)) params: PreparationTaskIdParamDto,
    @Body(new ZodValidationPipe(ReplacePreparationUnitBodySchema)) body: ReplacePreparationUnitBodyDto,
    @Headers('idempotency-key') rawKey: string | undefined,
    @ActiveUser('id') actorUserId: string,
  ) {
    return this.replaceUnitUseCase.execute({
      actorUserId,
      taskId: params.id,
      oldUnitId: body.oldUnitId,
      newUnitId: body.newUnitId,
      reason: body.reason,
      expectedVersion: body.expectedVersion,
      idempotencyKey: requireInventoryLocationIdempotencyKey(rawKey),
    });
  }

  @Post(':id/claim')
  @HttpCode(200)
  @ApiOperation({
    summary: 'RB-API-308 — Nhận (claim) task chuẩn bị',
    description:
      'Nhân viên kho nhận task chuẩn bị để xử lý. ' +
      'Task phải ở trạng thái OPEN. Sau khi claim, task được gán cho nhân viên đang đăng nhập.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID của task chuẩn bị' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Khóa duy nhất để tránh gọi trùng', example: 'claim-20261005-mno345' })
  @ApiBody({
    description: 'Phiên bản task hiện tại',
    schema: {
      type: 'object',
      required: ['expectedVersion'],
      properties: {
        expectedVersion: { type: 'integer', minimum: 1, description: 'Phiên bản task hiện tại', example: 1 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Task đã được nhận thành công' })
  @ApiResponse({ status: 409, description: 'Xung đột phiên bản hoặc task đã được nhận bởi người khác' })
  async claimTask(
    @Param(new ZodValidationPipe(PreparationTaskIdParamSchema)) params: PreparationTaskIdParamDto,
    @Body(new ZodValidationPipe(ClaimPreparationTaskBodySchema)) body: ClaimPreparationTaskBodyDto,
    @Headers('idempotency-key') rawKey: string | undefined,
    @ActiveUser('id') actorUserId: string,
  ) {
    return this.claimTaskUseCase.execute({
      actorUserId,
      taskId: params.id,
      expectedVersion: body.expectedVersion,
      idempotencyKey: requireInventoryLocationIdempotencyKey(rawKey),
    });
  }

  @Post(':id/transfer-request')
  @HttpCode(200)
  @ApiOperation({
    summary: 'RB-API-309 — Yêu cầu chuyển giao package cho nhân viên giao hàng',
    description:
      'Nhân viên kho gửi yêu cầu chuyển quyền giám sát (custody transfer) package ' +
      'cho nhân viên giao hàng (STAFF_DELIVERY). ' +
      'Nhân viên giao hàng sẽ nhận được thông báo và phải xác nhận bằng API receive-package.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID của task chuẩn bị' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Khóa duy nhất để tránh gọi trùng', example: 'transfer-20261005-pqr678' })
  @ApiBody({
    description: 'Thông tin yêu cầu chuyển giao',
    schema: {
      type: 'object',
      required: ['packageId', 'toStaffId', 'expectedVersion'],
      properties: {
        packageId: { type: 'string', format: 'uuid', description: 'UUID package cần chuyển giao', example: '660e8400-e29b-41d4-a716-446655440002' },
        toStaffId: { type: 'string', format: 'uuid', description: 'UUID nhân viên giao hàng nhận package', example: '770e8400-e29b-41d4-a716-446655440003' },
        expectedVersion: { type: 'integer', minimum: 1, description: 'Phiên bản task hiện tại', example: 5 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Yêu cầu chuyển giao đã được tạo, chờ nhân viên giao hàng xác nhận' })
  @ApiResponse({ status: 409, description: 'Xung đột phiên bản' })
  async requestTransfer(
    @Param(new ZodValidationPipe(PreparationTaskIdParamSchema)) params: PreparationTaskIdParamDto,
    @Body(new ZodValidationPipe(RequestPreparationTransferBodySchema)) body: RequestPreparationTransferBodyDto,
    @Headers('idempotency-key') rawKey: string | undefined,
    @ActiveUser('id') actorUserId: string,
  ) {
    return this.requestTransferUseCase.execute({
      actorUserId,
      taskId: params.id,
      packageId: body.packageId,
      toStaffId: body.toStaffId,
      expectedVersion: body.expectedVersion,
      idempotencyKey: requireInventoryLocationIdempotencyKey(rawKey),
    });
  }

  @Get(':id/replacement-candidates')
  @ApiOperation({
    summary: 'RB-API-310 — Danh sách thiết bị thay thế phù hợp',
    description:
      'Trả về danh sách thiết bị cùng loại sản phẩm đang khả dụng (AVAILABLE) ' +
      'có thể dùng để thay thế thiết bị hiện tại. Dùng trước khi gọi replace-unit.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID của task chuẩn bị' })
  @ApiQuery({ name: 'oldUnitId', required: true, type: String, description: 'UUID thiết bị cần thay thế', example: '550e8400-e29b-41d4-a716-446655440001' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Trang hiện tại (mặc định 1)', example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Số item mỗi trang (mặc định 20)', example: 20 })
  @ApiResponse({ status: 200, description: 'Danh sách thiết bị phù hợp có thể thay thế' })
  async replacementCandidates(
    @Param(new ZodValidationPipe(PreparationTaskIdParamSchema)) params: PreparationTaskIdParamDto,
    @Query(new ZodValidationPipe(ReplacementCandidatesQuerySchema)) query: ReplacementCandidatesQueryDto,
    @ActiveUser('id') actorUserId: string,
  ) {
    return this.replacementCandidatesUseCase.execute({ actorUserId, taskId: params.id, ...query });
  }

  @Get(':id/pick-candidates')
  @ApiOperation({
    summary: 'RB-API-311 — Danh sách thiết bị khả dụng để pick thủ công',
    description:
      'Dùng khi không thể quét QR/barcode. Tìm kiếm thiết bị theo productId hoặc từ khóa (q). ' +
      'Trả về danh sách thiết bị AVAILABLE có thể pick cho task hiện tại.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID của task chuẩn bị' })
  @ApiQuery({ name: 'productId', required: false, type: String, description: 'UUID loại sản phẩm cần lọc', example: '880e8400-e29b-41d4-a716-446655440004' })
  @ApiQuery({ name: 'q', required: false, type: String, description: 'Từ khóa tìm kiếm (tên, mã asset...)', example: 'TREK' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Trang hiện tại (mặc định 1)', example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Số item mỗi trang (mặc định 20)', example: 20 })
  @ApiResponse({ status: 200, description: 'Danh sách thiết bị khả dụng để pick' })
  async pickCandidates(
    @Param(new ZodValidationPipe(PreparationTaskIdParamSchema)) params: PreparationTaskIdParamDto,
    @Query(new ZodValidationPipe(PickCandidatesQuerySchema)) query: PickCandidatesQueryDto,
    @ActiveUser('id') actorUserId: string,
  ) {
    return this.pickCandidatesUseCase.execute({ actorUserId, taskId: params.id, ...query });
  }
}

function requireInventoryLocationIdempotencyKey(raw: string | undefined): string {
  const parsed = InventoryLocationIdempotencyKeySchema.safeParse(raw);
  if (!parsed.success) throw AppError.fromCode(PR.IDEMPOTENCY_KEY_REQUIRED);
  return parsed.data;
}
