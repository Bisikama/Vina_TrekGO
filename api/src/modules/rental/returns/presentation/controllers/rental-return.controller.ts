import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import { RentalDocumentType } from '@prisma/client'
import { UserRole } from 'src/shared/constants'
import { AuthType } from 'src/shared/constants/auth.constant'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'
import { Auth } from 'src/shared/decorators/auth.decorator'
import { Roles } from 'src/shared/decorators/roles.decorator'
import { AppError } from 'src/shared/errors/app-error'
import { RENTAL_RETURN_ERROR_CODES as RR } from 'src/shared/errors/codes/rental-return.error-codes'
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe'
import { ReturnScanUseCase } from '../../application/use-cases/return-scan.use-case'
import { ReturnInspectionUseCase } from '../../application/use-cases/return-inspection.use-case'
import { GetDepositUseCase } from '../../application/use-cases/get-deposit.use-case'
import { CreateAssessmentReviewUseCase } from '../../application/use-cases/create-assessment-review.use-case'
import { GetRentalAssessmentUseCase } from '../../application/use-cases/get-rental-assessment.use-case'
import { FinalizeReturnReceiptUseCase } from '../../application/use-cases/finalize-return-receipt.use-case'
import { ListRentalDocumentsUseCase } from '../../application/use-cases/list-rental-documents.use-case'
import { GetRentalDocumentUseCase } from '../../application/use-cases/get-rental-document.use-case'
import {
  AssessmentReviewBodySchema,
  FinalizeReturnReceiptBodySchema,
  ListRentalDocumentsQuerySchema,
  RentalOrderDocumentParamsSchema,
  RentalOrderIdParamSchema,
  RentalReturnIdempotencyKeySchema,
  ReturnInspectionBodySchema,
  ReturnScanBodySchema,
  type AssessmentReviewBodyDto,
  type FinalizeReturnReceiptBodyDto,
  type ListRentalDocumentsQueryDto,
  type RentalOrderDocumentParamsDto,
  type RentalOrderIdParamDto,
  type ReturnInspectionBodyDto,
  type ReturnScanBodyDto,
} from '../dtos/rental-return.dto'

@ApiTags('Rental Returns')
@ApiBearerAuth('bearer')
@Controller('rental-orders')
@Auth([AuthType.Bearer])
export class RentalReturnController {
  constructor(
    private readonly returnScanUseCase: ReturnScanUseCase,
    private readonly returnInspectionUseCase: ReturnInspectionUseCase,
    private readonly getDepositUseCase: GetDepositUseCase,
    private readonly createAssessmentReviewUseCase: CreateAssessmentReviewUseCase,
    private readonly getRentalAssessmentUseCase: GetRentalAssessmentUseCase,
    private readonly finalizeReturnReceiptUseCase: FinalizeReturnReceiptUseCase,
    private readonly listRentalDocumentsUseCase: ListRentalDocumentsUseCase,
    private readonly getRentalDocumentUseCase: GetRentalDocumentUseCase,
  ) {}

  @Post(':id/return-scan')
  @Roles(UserRole.STAFF_DELIVERY)
  @HttpCode(200)
  @ApiOperation({
    summary: 'RB-API-601 — Quét nhận thiết bị trả (từng đơn vị, retry-safe)',
    description:
      'Nhân viên giao hàng quét mã asset từng thiết bị khi khách trả hàng. ' +
      'API hỗ trợ retry-safe qua Idempotency-Key + operationId. ' +
      'Mỗi lần gọi có thể quét 1 hoặc nhiều thiết bị cùng lúc.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'UUID đơn hàng thuê',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Khóa duy nhất để tránh gọi trùng (8–200 ký tự)',
    example: 'scan-20261005-abc123',
  })
  @ApiBody({
    description: 'Danh sách mã asset thiết bị trả về',
    schema: {
      type: 'object',
      required: ['assetCodes', 'operationId', 'expectedVersion'],
      properties: {
        assetCodes: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 100,
          description: 'Mảng mã asset quét từ QR/barcode',
          example: ['TREK-BIKE-001', 'TREK-BIKE-002'],
        },
        operationId: {
          type: 'string',
          minLength: 8,
          maxLength: 200,
          description: 'ID thao tác duy nhất (để retry-safe)',
          example: 'op-scan-20261005-xyz789',
        },
        expectedVersion: { type: 'integer', minimum: 1, description: 'Phiên bản hiện tại', example: 1 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Thiết bị đã được quét nhận thành công' })
  @ApiResponse({ status: 409, description: 'Xung đột phiên bản' })
  @ApiResponse({ status: 422, description: 'Mã asset không thuộc đơn hàng hoặc đã quét trước đó' })
  async scan(
    @Param(new ZodValidationPipe(RentalOrderIdParamSchema)) params: RentalOrderIdParamDto,
    @Body(new ZodValidationPipe(ReturnScanBodySchema)) body: ReturnScanBodyDto,
    @Headers('idempotency-key') rawKey: string | undefined,
    @ActiveUser('id') actorUserId: string,
  ) {
    return this.returnScanUseCase.execute({
      actorUserId,
      orderId: params.id,
      ...body,
      idempotencyKey: requireKey(rawKey),
      now: new Date(),
    })
  }

  @Post([':id/return-observations', ':id/return-inspection'])
  @Roles(UserRole.STAFF_DELIVERY)
  @HttpCode(201)
  @ApiOperation({
    summary: 'RB-API-602 — Ghi nhận quan sát tình trạng khi nhận trả (Delivery observations)',
    description:
      'Nhân viên giao hàng ghi nhận quan sát sơ bộ tình trạng thiết bị khi nhận trả từ khách. ' +
      'ĐÂY LÀ QUAN SÁT, KHÔNG PHẢI ĐÁNH GIÁ CUỐI CÙNG. ' +
      'Đánh giá cuối cùng (FINAL) sẽ do nhân viên kho thực hiện qua RB-API-605. ' +
      'Không có hoàn tiền nhanh (quick refund) ở bước này. ' +
      'Hỗ trợ 2 route: return-observations (canonical) và return-inspection (legacy).',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID đơn hàng thuê' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Khóa duy nhất để tránh gọi trùng',
    example: 'obs-20261005-def456',
  })
  @ApiBody({
    description: 'Danh sách quan sát tình trạng thiết bị',
    schema: {
      type: 'object',
      required: ['items', 'expectedVersion'],
      properties: {
        items: {
          type: 'array',
          minItems: 1,
          maxItems: 100,
          description: 'Danh sách thiết bị và quan sát',
          items: {
            type: 'object',
            required: ['unitId'],
            properties: {
              unitId: { type: 'string', format: 'uuid', description: 'UUID thiết bị' },
              visibleDamage: { type: 'boolean', description: 'Có hư hỏng nhìn thấy được không?', example: false },
              accessoryObservations: {
                type: 'array',
                items: { type: 'string' },
                description: 'Ghi nhận về phụ kiện',
                example: ['Thiếu khóa xe'],
              },
              notes: {
                type: 'string',
                maxLength: 2000,
                description: 'Ghi chú bổ sung',
                example: 'Xe sạch, không có vết xước mới',
              },
              evidenceIds: {
                type: 'array',
                items: { type: 'string', format: 'uuid' },
                description: 'UUID ảnh/video minh chứng',
              },
            },
          },
        },
        expectedVersion: { type: 'integer', minimum: 1, description: 'Phiên bản hiện tại', example: 2 },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Quan sát đã được ghi nhận thành công' })
  @ApiResponse({ status: 409, description: 'Xung đột phiên bản' })
  async inspect(
    @Param(new ZodValidationPipe(RentalOrderIdParamSchema)) params: RentalOrderIdParamDto,
    @Body(new ZodValidationPipe(ReturnInspectionBodySchema)) body: ReturnInspectionBodyDto,
    @Headers('idempotency-key') rawKey: string | undefined,
    @ActiveUser('id') actorUserId: string,
  ) {
    const items = body.items.map((item) =>
      'outcome' in item
        ? item
        : {
            unitId: item.unitId,
            outcome:
              item.visibleDamage || item.accessoryObservations.length
                ? ('OBSERVED_ISSUE' as const)
                : ('OBSERVED_RECEIVED' as const),
            accessoryIssues: item.accessoryObservations,
            evidenceIds: item.evidenceIds,
            notes: item.notes,
          },
    )
    return this.returnInspectionUseCase.execute({
      actorUserId,
      orderId: params.id,
      items,
      expectedVersion: body.expectedVersion,
      idempotencyKey: requireKey(rawKey),
      now: new Date(),
    })
  }

  @Get(':id/deposit')
  @Roles(UserRole.USER, UserRole.LEADER)
  @ApiOperation({
    summary: 'RB-API-607 — Xem trạng thái tiền đặt cọc theo từng thiết bị',
    description:
      'Khách hàng xem trạng thái tiền đặt cọc (deposit) và hoàn trả (refund) ' +
      'cho từng thiết bị trong đơn hàng thuê.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'UUID đơn hàng thuê',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({ status: 200, description: 'Thông tin deposit/refund theo từng thiết bị' })
  @ApiResponse({ status: 404, description: 'Đơn hàng không tồn tại hoặc không thuộc quyền truy cập' })
  async deposit(
    @Param(new ZodValidationPipe(RentalOrderIdParamSchema)) params: RentalOrderIdParamDto,
    @ActiveUser('id') actorUserId: string,
  ) {
    return this.getDepositUseCase.execute({ actorUserId, orderId: params.id })
  }

  @Post(':id/assessment-reviews')
  @Roles(UserRole.USER, UserRole.LEADER)
  @HttpCode(201)
  @ApiOperation({
    summary: 'RB-API-609 — Khách phản hồi / khiếu nại đánh giá tình trạng',
    description:
      'Khách hàng gửi phản hồi hoặc khiếu nại cho một đánh giá (assessment) cụ thể. ' +
      'Kèm lý do chi tiết và bằng chứng minh họa.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID đơn hàng thuê' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Khóa duy nhất để tránh gọi trùng',
    example: 'review-20261005-ghi789',
  })
  @ApiBody({
    description: 'Nội dung phản hồi/khiếu nại',
    schema: {
      type: 'object',
      required: ['assessmentId', 'reason'],
      properties: {
        assessmentId: {
          type: 'string',
          format: 'uuid',
          description: 'UUID đánh giá cần phản hồi',
          example: '880e8400-e29b-41d4-a716-446655440005',
        },
        reason: {
          type: 'string',
          minLength: 3,
          maxLength: 3000,
          description: 'Lý do phản hồi/khiếu nại chi tiết',
          example: 'Vết xước này đã có từ trước khi tôi nhận xe',
        },
        evidenceIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
          maxItems: 20,
          description: 'UUID ảnh/video minh chứng của khách',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Phản hồi đã được ghi nhận, chờ Admin xem xét' })
  @ApiResponse({ status: 409, description: 'Xung đột — đã phản hồi trước đó' })
  async review(
    @Param(new ZodValidationPipe(RentalOrderIdParamSchema)) params: RentalOrderIdParamDto,
    @Body(new ZodValidationPipe(AssessmentReviewBodySchema)) body: AssessmentReviewBodyDto,
    @Headers('idempotency-key') rawKey: string | undefined,
    @ActiveUser('id') actorUserId: string,
  ) {
    return this.createAssessmentReviewUseCase.execute({
      actorUserId,
      orderId: params.id,
      ...body,
      idempotencyKey: requireKey(rawKey),
      now: new Date(),
    })
  }

  @Get(':id/assessment')
  @Roles(UserRole.USER, UserRole.LEADER)
  @ApiOperation({
    summary: 'RB-API-616 — Xem chi tiết đánh giá và bằng chứng',
    description:
      'Khách hàng xem chi tiết đánh giá tình trạng thiết bị (assessment), ' +
      'bao gồm kết quả kiểm tra, ảnh/video minh chứng, và lịch sử phản hồi.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'UUID đơn hàng thuê',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({ status: 200, description: 'Chi tiết đánh giá, bằng chứng, và lịch sử phản hồi' })
  @ApiResponse({ status: 404, description: 'Đơn hàng không tồn tại' })
  async assessment(
    @Param(new ZodValidationPipe(RentalOrderIdParamSchema)) params: RentalOrderIdParamDto,
    @ActiveUser('id') actorUserId: string,
  ) {
    return this.getRentalAssessmentUseCase.execute({ actorUserId, orderId: params.id })
  }

  @Post(':id/return-receipts')
  @Roles(UserRole.STAFF_DELIVERY)
  @HttpCode(201)
  @ApiOperation({
    summary: 'RB-API-1004 — Chốt phiên nhận trả và phát hành biên nhận (RETURN_RECEIPT)',
    description:
      'Nhân viên giao hàng được phân công chốt phiên nhận trả cụ thể (bằng returnSessionId) sau khi đã quét nhận và ghi nhận quan sát sơ bộ. ' +
      'Tạo chứng từ bất biến RETURN_RECEIPT gắn với phiên, snapshot đầy đủ theo FR Table RETURN_RECEIPT.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID đơn hàng thuê' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Khóa duy nhất để tránh gọi trùng',
    example: 'receipt-20261018-abc123',
  })
  @ApiBody({
    description:
      'Lấy returnSessionId và expectedVersion từ phiên nhận trả hiện tại của đơn. Chỉ gửi failureEvidenceId/evidenceIds khi đã có media ID hợp lệ. Retry cùng body với cùng Idempotency-Key.',
    schema: {
      type: 'object',
      required: ['returnSessionId', 'expectedVersion'],
      properties: {
        returnSessionId: { type: 'string', format: 'uuid', description: 'UUID phiên nhận trả cần chốt' },
        expectedVersion: { type: 'integer', minimum: 1, description: 'Phiên bản hiện tại của phiên nhận trả' },
        remarks: { type: 'string', maxLength: 1000, description: 'Ghi chú của nhân viên giao hàng, tùy chọn' },
        failureEvidenceId: {
          type: 'string',
          format: 'uuid',
          description: 'Minh chứng khi chốt phiên gặp ngoại lệ, tùy chọn',
        },
        evidenceIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
          description: 'Minh chứng đã tải lên, tùy chọn',
        },
      },
      example: { returnSessionId: '550e8400-e29b-41d4-a716-446655440020', expectedVersion: 1 },
    },
  })
  @ApiResponse({ status: 201, description: 'Biên nhận nhận trả (RETURN_RECEIPT) được phát hành thành công' })
  @ApiResponse({ status: 403, description: 'Nhân viên không được phân công hoặc không sở hữu phiên nhận trả' })
  @ApiResponse({ status: 404, description: 'Đơn hàng hoặc phiên nhận trả không tồn tại' })
  @ApiResponse({
    status: 409,
    description: 'Phiên nhận trả không ở trạng thái hợp lệ để chốt hoặc thiếu chứng từ gốc HANDOVER',
  })
  async finalizeReturnReceipt(
    @Param(new ZodValidationPipe(RentalOrderIdParamSchema)) params: RentalOrderIdParamDto,
    @Body(new ZodValidationPipe(FinalizeReturnReceiptBodySchema)) body: FinalizeReturnReceiptBodyDto,
    @Headers('idempotency-key') rawKey: string | undefined,
    @ActiveUser('id') actorUserId: string,
    @ActiveUser('role') actorRole: string,
  ) {
    return this.finalizeReturnReceiptUseCase.execute({
      actorUserId,
      actorRole,
      orderId: params.id,
      returnSessionId: body.returnSessionId,
      remarks: body.remarks,
      failureEvidenceId: body.failureEvidenceId,
      evidenceIds: body.evidenceIds,
      expectedVersion: body.expectedVersion,
      idempotencyKey: requireKey(rawKey),
      now: new Date(),
    })
  }

  @Get(':id/documents')
  @Roles(UserRole.USER, UserRole.LEADER, UserRole.STAFF_DELIVERY, UserRole.STAFF_INVENTORY, UserRole.ADMIN)
  @ApiOperation({
    summary: 'RB-API-1001 — Danh sách chứng từ của đơn hàng thuê',
    description:
      'Truy vấn danh sách tất cả các chứng từ (HANDOVER, RETURN_RECEIPT, EXTENSION_APPENDIX, ...) thuộc đơn hàng kèm phân trang.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID đơn hàng thuê' })
  @ApiQuery({ name: 'type', required: false, enum: RentalDocumentType, description: 'Lọc theo loại chứng từ' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Số trang (mặc định 1)' })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
    description: 'Kích thước trang (mặc định 20, tối đa 100)',
  })
  @ApiResponse({ status: 200, description: 'Danh sách chứng từ và phân trang' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập chứng từ của đơn hàng này' })
  @ApiResponse({ status: 404, description: 'Đơn hàng không tồn tại' })
  async listDocuments(
    @Param(new ZodValidationPipe(RentalOrderIdParamSchema)) params: RentalOrderIdParamDto,
    @Query(new ZodValidationPipe(ListRentalDocumentsQuerySchema)) query: ListRentalDocumentsQueryDto,
    @ActiveUser('id') actorUserId: string,
    @ActiveUser('role') actorRole: string,
  ) {
    return this.listRentalDocumentsUseCase.execute({
      orderId: params.id,
      actorUserId,
      actorRole,
      ...query,
    })
  }

  @Get(':id/documents/:documentId')
  @Roles(UserRole.USER, UserRole.LEADER, UserRole.STAFF_DELIVERY, UserRole.STAFF_INVENTORY, UserRole.ADMIN)
  @ApiOperation({
    summary: 'RB-API-1002 — Xem chi tiết chứng từ (bằng chứng từ ID thuộc đơn)',
    description:
      'Truy vấn chi tiết chứng từ gồm snapshot bất biến, hash, phiên bản chính sách, template, bảo vệ kiểm tra orderId.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID đơn hàng thuê' })
  @ApiParam({ name: 'documentId', type: String, format: 'uuid', description: 'UUID chứng từ' })
  @ApiResponse({ status: 200, description: 'Chi tiết chứng từ và snapshot bất biến' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập chứng từ này' })
  @ApiResponse({ status: 404, description: 'Chứng từ không tồn tại hoặc không thuộc đơn hàng' })
  async getDocument(
    @Param(new ZodValidationPipe(RentalOrderDocumentParamsSchema)) params: RentalOrderDocumentParamsDto,
    @ActiveUser('id') actorUserId: string,
    @ActiveUser('role') actorRole: string,
  ) {
    return this.getRentalDocumentUseCase.execute({
      documentId: params.documentId,
      expectedOrderId: params.id,
      actorUserId,
      actorRole,
    })
  }
}

function requireKey(raw: string | undefined) {
  const parsed = RentalReturnIdempotencyKeySchema.safeParse(raw)
  if (!parsed.success) throw AppError.fromCode(RR.IDEMPOTENCY_KEY_REQUIRED)
  return parsed.data
}
