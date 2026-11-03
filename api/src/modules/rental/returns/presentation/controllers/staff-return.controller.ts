import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from 'src/shared/constants';
import { AuthType } from 'src/shared/constants/auth.constant';
import { ActiveUser } from 'src/shared/decorators/active-user.decorator';
import { Auth } from 'src/shared/decorators/auth.decorator';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { AppError } from 'src/shared/errors/app-error';
import { RENTAL_RETURN_ERROR_CODES as RR } from 'src/shared/errors/codes/rental-return.error-codes';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import { ReceiveReturnUseCase } from '../../application/use-cases/receive-return.use-case';
import { FinalInspectionUseCase } from '../../application/use-cases/final-inspection.use-case';
import { FinalizeReturnUseCase } from '../../application/use-cases/finalize-return.use-case';
import { MarkReturnedUnitReadyUseCase } from '../../application/use-cases/mark-returned-unit-ready.use-case';
import { ListReturnsUseCase } from '../../application/use-cases/list-returns.use-case';
import { GetReturnUseCase } from '../../application/use-cases/get-return.use-case';
import {
  EquipmentUnitIdParamSchema, FinalInspectionBodySchema, FinalizeReturnBodySchema, ListReturnsQuerySchema,
  MarkUnitReadyBodySchema, ReceiveReturnBodySchema, RentalReturnIdempotencyKeySchema, ReturnIdParamSchema,
  type EquipmentUnitIdParamDto, type FinalInspectionBodyDto, type FinalizeReturnBodyDto, type ListReturnsQueryDto,
  type MarkUnitReadyBodyDto, type ReceiveReturnBodyDto, type ReturnIdParamDto,
} from '../dtos/rental-return.dto';

@ApiTags('Staff Returns')
@ApiBearerAuth('bearer')
@Controller()
@Auth([AuthType.Bearer])
export class StaffReturnController {
  constructor(
    private readonly receiveUseCase: ReceiveReturnUseCase,
    private readonly finalInspectionUseCase: FinalInspectionUseCase,
    private readonly finalizeUseCase: FinalizeReturnUseCase,
    private readonly readyUseCase: MarkReturnedUnitReadyUseCase,
    private readonly listUseCase: ListReturnsUseCase,
    private readonly getUseCase: GetReturnUseCase,
  ) {}

  @Post('staff/returns/:returnId/receive')
  @Roles(UserRole.STAFF_INVENTORY)
  @HttpCode(200)
  @ApiOperation({
    summary: 'RB-API-604 — Nhân viên kho nhận thiết bị trả về',
    description:
      'Nhân viên kho xác nhận nhận các thiết bị trả về từ nhân viên giao hàng (custody transfer). ' +
      'Phải cung cấp pendingTransferId (từ RB-API-603), inventoryLocationId, và danh sách unitId đã quét. ' +
      'inventoryLocationId phải khớp với đích đến của pending custody transfer.',
  })
  @ApiParam({ name: 'returnId', type: String, format: 'uuid', description: 'UUID task trả hàng', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Khóa duy nhất để tránh gọi trùng (8–200 ký tự)', example: 'recv-ret-20261005-abc123' })
  @ApiBody({
    description: 'Thông tin nhận thiết bị trả về',
    schema: {
      type: 'object',
      required: ['pendingTransferId', 'inventoryLocationId', 'scannedUnitIds', 'expectedVersion'],
      properties: {
        pendingTransferId: { type: 'string', format: 'uuid', description: 'UUID pending custody transfer từ RB-API-603', example: '990e8400-e29b-41d4-a716-446655440010' },
        inventoryLocationId: { type: 'string', format: 'uuid', description: 'UUID vị trí kho nhận hàng (phải khớp transfer đích)', example: 'aa0e8400-e29b-41d4-a716-446655440020' },
        scannedUnitIds: { type: 'array', items: { type: 'string', format: 'uuid' }, maxItems: 100, description: 'UUID thiết bị thực tế đã quét nhận; có thể rỗng nếu toàn bộ transfer thất lạc', example: ['550e8400-e29b-41d4-a716-446655440001'] },
        incidentNote: { type: 'string', description: 'Mô tả bắt buộc khi kho nhận thiếu so với transfer' },
        expectedVersion: { type: 'integer', minimum: 1, description: 'Phiên bản hiện tại', example: 4 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Thiết bị đã được nhận vào kho thành công' })
  @ApiResponse({ status: 409, description: 'Xung đột phiên bản' })
  @ApiResponse({ status: 422, description: 'PendingTransferId không hợp lệ hoặc inventoryLocationId không khớp' })
  async receive(@Param(new ZodValidationPipe(ReturnIdParamSchema)) params: ReturnIdParamDto, @Body(new ZodValidationPipe(ReceiveReturnBodySchema)) body: ReceiveReturnBodyDto, @Headers('idempotency-key') rawKey: string | undefined, @ActiveUser('id') actorUserId: string) {
    return this.receiveUseCase.execute({ actorUserId, returnId: params.returnId, ...body, idempotencyKey: requireKey(rawKey), now: new Date() });
  }

  @Post('staff/returns/:returnId/final-inspection')
  @Roles(UserRole.STAFF_INVENTORY)
  @HttpCode(201)
  @ApiOperation({
    summary: 'RB-API-605 — Kiểm tra CUỐI CÙNG tình trạng thiết bị (FINAL inspection)',
    description:
      'Nhân viên kho thực hiện đánh giá tình trạng CUỐI CÙNG cho MỌI thiết bị đã nhận về vật lý. ' +
      'Đây là đánh giá chính thức (SOT v1.5.2), khác với quan sát sơ bộ của delivery (RB-API-602). ' +
      'Mỗi thiết bị được đánh giá condition, hư hỏng (damage rules), phụ kiện, và bằng chứng.',
  })
  @ApiParam({ name: 'returnId', type: String, format: 'uuid', description: 'UUID task trả hàng' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Khóa duy nhất để tránh gọi trùng', example: 'final-insp-20261005-def456' })
  @ApiBody({
    description: 'Danh sách kiểm tra cuối cùng cho từng thiết bị',
    schema: {
      type: 'object',
      required: ['items', 'expectedVersion'],
      properties: {
        items: {
          type: 'array', minItems: 1, maxItems: 100, description: 'Kiểm tra từng thiết bị',
          items: {
            type: 'object',
            required: ['unitId', 'condition'],
            properties: {
              unitId: { type: 'string', format: 'uuid', description: 'UUID thiết bị', example: '550e8400-e29b-41d4-a716-446655440001' },
              outcome: { type: 'string', enum: ['PASS', 'ISSUE'], description: 'Kết quả: PASS (bình thường) hoặc ISSUE (có vấn đề)', example: 'PASS' },
              condition: { type: 'string', enum: ['NEW', 'GOOD', 'FAIR', 'DAMAGED', 'LOST'], description: 'Tình trạng cuối cùng', example: 'GOOD' },
              accessories: { type: 'array', items: { type: 'string' }, description: 'Phụ kiện kèm theo' },
              damage: {
                type: 'array', description: 'Danh sách hư hỏng (nếu có)',
                items: {
                  type: 'object',
                  properties: {
                    ruleId: { type: 'string', format: 'uuid', description: 'UUID quy tắc hư hỏng' },
                    quantity: { type: 'integer', minimum: 1, description: 'Số lượng', example: 1 },
                    notes: { type: 'string', description: 'Ghi chú hư hỏng' },
                    evidenceIds: { type: 'array', items: { type: 'string', format: 'uuid' }, description: 'UUID ảnh minh chứng' },
                  },
                },
              },
              evidenceIds: { type: 'array', items: { type: 'string', format: 'uuid' }, maxItems: 20, description: 'UUID ảnh/video minh chứng kiểm tra' },
              notes: { type: 'string', maxLength: 2000, description: 'Ghi chú kiểm tra' },
            },
          },
        },
        expectedVersion: { type: 'integer', minimum: 1, description: 'Phiên bản hiện tại', example: 5 },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Kiểm tra cuối cùng đã được ghi nhận' })
  @ApiResponse({ status: 409, description: 'Xung đột phiên bản' })
  @ApiResponse({ status: 422, description: 'outcome=PASS xung đột với condition=DAMAGED hoặc có damage' })
  async finalInspection(@Param(new ZodValidationPipe(ReturnIdParamSchema)) params: ReturnIdParamDto, @Body(new ZodValidationPipe(FinalInspectionBodySchema)) body: FinalInspectionBodyDto, @Headers('idempotency-key') rawKey: string | undefined, @ActiveUser('id') actorUserId: string) {
    const items = body.items.map(item => ({
      issueUnitId: item.unitId ?? item.issueUnitId!, outcome: item.outcome,
      condition: item.condition, damage: item.damage, evidenceIds: item.evidenceIds,
      notes: item.notes,
    }));
    return this.finalInspectionUseCase.execute({ actorUserId, returnId: params.returnId, items,
      expectedVersion: body.expectedVersion, idempotencyKey: requireKey(rawKey), now: new Date() });
  }

  @Post('staff/returns/:returnId/finalize')
  @Roles(UserRole.STAFF_INVENTORY)
  @HttpCode(200)
  @ApiOperation({
    summary: 'RB-API-608 — Hoàn tất kết quả kiểm tra trả hàng (KHÔNG đánh dấu AVAILABLE)',
    description:
      'Nhân viên kho chốt kết quả kiểm tra cho từng thiết bị (NORMAL/DAMAGED/LOST). ' +
      'API này KHÔNG đánh dấu thiết bị là AVAILABLE — ' +
      'việc đó phải qua RB-API-611 (mark-unit-ready) sau khi vệ sinh xong.',
  })
  @ApiParam({ name: 'returnId', type: String, format: 'uuid', description: 'UUID task trả hàng' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Khóa duy nhất để tránh gọi trùng', example: 'finalize-20261005-ghi789' })
  @ApiBody({
    description: 'Kết quả kiểm tra cuối cùng cho từng thiết bị',
    schema: {
      type: 'object',
      required: ['unitOutcomes', 'inspectionVersion', 'expectedVersion'],
      properties: {
        unitOutcomes: {
          type: 'array', minItems: 1, maxItems: 100, description: 'Kết quả cho từng thiết bị',
          items: {
            type: 'object',
            required: ['unitId', 'outcome'],
            properties: {
              unitId: { type: 'string', format: 'uuid', description: 'UUID thiết bị' },
              outcome: { type: 'string', enum: ['NORMAL', 'DAMAGED', 'LOST'], description: 'Kết quả: bình thường, hư hỏng, hoặc mất', example: 'NORMAL' },
            },
          },
        },
        inspectionVersion: { type: 'integer', minimum: 1, description: 'Phiên bản kết quả kiểm tra', example: 1 },
        expectedVersion: { type: 'integer', minimum: 1, description: 'Phiên bản return hiện tại', example: 6 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Kết quả trả hàng đã được chốt' })
  @ApiResponse({ status: 409, description: 'Xung đột phiên bản' })
  async finalize(@Param(new ZodValidationPipe(ReturnIdParamSchema)) params: ReturnIdParamDto, @Body(new ZodValidationPipe(FinalizeReturnBodySchema)) body: FinalizeReturnBodyDto, @Headers('idempotency-key') rawKey: string | undefined, @ActiveUser('id') actorUserId: string) {
    return this.finalizeUseCase.execute({ actorUserId, returnId: params.returnId, ...body, idempotencyKey: requireKey(rawKey), now: new Date() });
  }

  @Post('staff/equipment-units/:id/ready')
  @Roles(UserRole.STAFF_INVENTORY)
  @HttpCode(200)
  @ApiOperation({
    summary: 'RB-API-611 — Hoàn tất vệ sinh và đánh dấu thiết bị AVAILABLE',
    description:
      'Sau khi vệ sinh và kiểm tra phụ kiện xong, nhân viên kho đánh dấu thiết bị NORMAL ' +
      'trở lại trạng thái AVAILABLE để sẵn sàng cho lần thuê tiếp theo. ' +
      'Chỉ áp dụng cho thiết bị có outcome = NORMAL từ bước finalize (RB-API-608).',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID thiết bị (EquipmentUnit)', example: '550e8400-e29b-41d4-a716-446655440001' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Khóa duy nhất để tránh gọi trùng', example: 'ready-unit-20261005-jkl012' })
  @ApiBody({
    description: 'Xác nhận đã vệ sinh và kiểm tra phụ kiện',
    schema: {
      type: 'object',
      required: ['accessoriesChecked', 'expectedVersion'],
      properties: {
        inspectionId: { type: 'string', format: 'uuid', description: 'UUID bản kiểm tra liên quan (tùy chọn)' },
        accessoriesChecked: { type: 'boolean', description: 'Đã kiểm tra phụ kiện đầy đủ chưa?', example: true },
        expectedVersion: { type: 'integer', minimum: 1, description: 'Phiên bản hiện tại', example: 7 },
        gradeDecision: {
          type: 'object',
          description:
            'Bắt buộc khi thiết bị thuộc sản phẩm có hạng (grade); không gửi với sản phẩm thường. ' +
            'KEEP = giữ hạng. DOWNGRADE = chuyển thiết bị sang sản phẩm "Đã sử dụng tốt" cùng nhóm (chỉ từ "Rất mới"), bắt buộc reason. ' +
            'Nếu hạ hạng làm thiếu hàng cho đơn đã đặt chưa bàn giao: đơn không đổi, được đánh dấu ACTION_REQUIRED để nhân viên xử lý.',
          required: ['decision'],
          properties: {
            decision: { type: 'string', enum: ['KEEP', 'DOWNGRADE'], example: 'KEEP' },
            reason: { type: 'string', minLength: 3, maxLength: 1000, description: 'Lý do (bắt buộc khi DOWNGRADE)' },
            note: { type: 'string', maxLength: 3000 },
            evidenceIds: { type: 'array', maxItems: 10, items: { type: 'string', format: 'uuid' }, description: 'UUID ảnh bằng chứng' },
          },
        },
      },
      example: { accessoriesChecked: true, expectedVersion: 7, gradeDecision: { decision: 'KEEP' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Thiết bị đã được đánh dấu AVAILABLE; trả thêm gradeReview (null với sản phẩm thường)' })
  @ApiResponse({ status: 409, description: 'Xung đột phiên bản' })
  @ApiResponse({
    status: 422,
    description:
      'Thiết bị không ở trạng thái hợp lệ để đánh dấu AVAILABLE; RENTAL_GRADE_DECISION_REQUIRED; RENTAL_GRADE_DECISION_NOT_APPLICABLE; ' +
      'RENTAL_GRADE_DOWNGRADE_NOT_ALLOWED; RENTAL_GRADE_TARGET_NOT_FOUND',
  })
  async ready(@Param(new ZodValidationPipe(EquipmentUnitIdParamSchema)) params: EquipmentUnitIdParamDto, @Body(new ZodValidationPipe(MarkUnitReadyBodySchema)) body: MarkUnitReadyBodyDto, @Headers('idempotency-key') rawKey: string | undefined, @ActiveUser('id') actorUserId: string) {
    return this.readyUseCase.execute({ actorUserId, unitId: params.id, ...body, idempotencyKey: requireKey(rawKey), now: new Date() });
  }

  @Get('staff/returns')
  @Roles(UserRole.STAFF_INVENTORY)
  @ApiOperation({
    summary: 'RB-API-613 — Danh sách task trả hàng (Nhân viên kho)',
    description:
      'Nhân viên kho xem danh sách các task trả hàng cần xử lý, phân trang. ' +
      'Hỗ trợ lọc theo trạng thái: WAITING_CLEANING, REVIEW_REQUIRED, TRANSFER_PENDING, INVENTORY_RECEIVED, COMPLETED.',
  })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Trạng thái task trả hàng', enum: ['WAITING_CLEANING', 'REVIEW_REQUIRED', 'TRANSFER_PENDING', 'INVENTORY_RECEIVED', 'COMPLETED'] })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Trang hiện tại (mặc định 1)', example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Số item mỗi trang (mặc định 20)', example: 20 })
  @ApiResponse({ status: 200, description: 'Danh sách task trả hàng và thông tin phân trang' })
  async list(@Query(new ZodValidationPipe(ListReturnsQuerySchema)) query: ListReturnsQueryDto, @ActiveUser('id') actorUserId: string) {
    return this.listUseCase.execute({ actorUserId, ...query });
  }

  @Get('staff/returns/:returnId')
  @Roles(UserRole.STAFF_INVENTORY, UserRole.STAFF_DELIVERY, UserRole.ADMIN)
  @ApiOperation({
    summary: 'RB-API-614 — Chi tiết task trả hàng và theo dõi trả hàng một phần',
    description:
      'Xem thông tin chi tiết task trả hàng, bao gồm: danh sách thiết bị, ' +
      'kết quả kiểm tra, trạng thái custody, và tracking trả hàng một phần (partial return).',
  })
  @ApiParam({ name: 'returnId', type: String, format: 'uuid', description: 'UUID task trả hàng', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: 200, description: 'Chi tiết task trả hàng' })
  @ApiResponse({ status: 404, description: 'Task trả hàng không tồn tại' })
  async detail(@Param(new ZodValidationPipe(ReturnIdParamSchema)) params: ReturnIdParamDto, @ActiveUser('id') actorUserId: string, @ActiveUser('role') actorRole: string) {
    return this.getUseCase.execute({ actorUserId, actorRole, returnId: params.returnId });
  }
}

function requireKey(raw: string | undefined) { const parsed = RentalReturnIdempotencyKeySchema.safeParse(raw); if (!parsed.success) throw AppError.fromCode(RR.IDEMPOTENCY_KEY_REQUIRED); return parsed.data; }
