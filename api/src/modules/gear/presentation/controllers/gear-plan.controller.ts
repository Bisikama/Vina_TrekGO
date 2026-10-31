import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Auth } from '../../../../shared/decorators/auth.decorator';
import { ActiveUser } from '../../../../shared/decorators/active-user.decorator';
import { AuthType } from '../../../../shared/constants/auth.constant';
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe';
import { GearPlanService } from '../../application/services/gear-plan.service';
import {
  createPlanSchema,
  evaluatePlanSchema,
  planDiffQuerySchema,
  planPrefillQuerySchema,
  updateChecklistProgressSchema,
  updatePlanInputSchema,
  generatePlanOptionsSchema,
  generatePlanAdviceSchema,
  createQuoteIntentSchema,
  linkQuoteSchema,
} from '../../application/dtos/gear-plan.dto';
import type {
  CreatePlanInputDto,
  EvaluatePlanDto,
  PlanDiffQueryInput,
  PlanPrefillQueryInput,
  UpdateChecklistProgressDto,
  UpdatePlanInputDto,
  GeneratePlanOptionsDto,
  GeneratePlanAdviceDto,
  CreateQuoteIntentDto,
  LinkQuoteDto,
} from '../../application/dtos/gear-plan.dto';
import { ApiErrorResponse } from '../../../../shared/swagger/api-error-response.helper';
import { GEAR_ERROR_CODES } from '../../../../shared/errors/codes/gear.error-codes';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

const GRADE_SCHEMA_PROPERTIES: Record<string, SchemaObject> = {
  grade: {
    type: 'string',
    enum: ['LIKE_NEW', 'GOOD_USED'],
    nullable: true,
    example: 'GOOD_USED',
    description: 'Hạng thuê: LIKE_NEW (Rất mới) hoặc GOOD_USED (Đã sử dụng tốt). null với sản phẩm không chia hạng.',
  },
  gradeGroupId: {
    type: 'string',
    format: 'uuid',
    nullable: true,
    description: 'Nhóm hạng: các sản phẩm cùng gradeGroupId là các hạng của cùng một món đồ.',
  },
};

const DISPLAY_GUIDANCE_SCHEMA: SchemaObject = {
  type: 'object',
  properties: {
    state: { type: 'string', enum: ['READY', 'NEEDS_INFO', 'NEEDS_PREPARATION'] },
    actions: { type: 'array', items: { type: 'string', enum: ['SUPPLEMENT_INFO', 'VIEW_RENTAL_OPTIONS', 'SELF_PREPARE'] } },
    missingAttributes: { type: 'array', items: { type: 'object', properties: {
      key: { type: 'string', example: 'waterproof_mm' }, type: { type: 'string', example: 'number' },
      unit: { type: 'string', example: 'mm' }, requiredBy: { type: 'array', items: { type: 'string' }, example: ['R01'] },
    } } },
  },
  example: { state: 'NEEDS_INFO', actions: ['SUPPLEMENT_INFO'], missingAttributes: [{ key: 'waterproof_mm', type: 'number', unit: 'mm', requiredBy: ['R01'] }] },
};

const RENTAL_LINE_SCHEMA: SchemaObject = {
  type: 'object',
  properties: {
    requirementId: { type: 'string', example: 'req_tent' },
    category: { type: 'string', example: 'TENT' },
    productId: { type: 'string', format: 'uuid' },
    productName: { type: 'string', example: 'Lều 3 người – Đã sử dụng tốt' },
    quantity: { type: 'integer', example: 1 },
    dailyPrice: { type: 'number', example: 100000 },
    rentalFee: { type: 'number', example: 200000 },
    deposit: { type: 'number', example: 600000, deprecated: true, description: 'Tiền cọc cả dòng, ước tính. Deprecated: dùng `depositAmount`.' },
    depositAmount: { type: 'number', example: 600000, description: 'Tiền cọc cả dòng, ước tính (cùng giá trị với `deposit`, cùng tên với `items[].depositAmount` của quote/order).' },
    depositPerUnit: { type: 'number', example: 600000, description: 'Tiền cọc ước tính mỗi món.' },
    replacementValue: { type: 'number', example: 2000000, description: 'Giá trị thay thế mỗi món.' },
    depositExplanation: { type: 'object', properties: {
      percentageOfReplacementValue: { type: 'number', nullable: true, example: 30, description: 'Tỷ lệ cọc thực tế, làm tròn tối đa 2 chữ số thập phân; null nếu giá trị thay thế bằng 0.' },
      formula: { type: 'string', example: 'depositPerUnit / replacementValue * 100' },
    } },
    weight_g: { type: 'number', nullable: true, example: 2500 },
    availableCount: { type: 'integer', example: 3 },
    ...GRADE_SCHEMA_PROPERTIES,
  },
};

@ApiTags('Gear - Plan (Kế hoạch chuẩn bị đồ & Liên kết thuê)')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Controller('gear/plans')
export class GearPlanController {
  constructor(private readonly gearPlanService: GearPlanService) {}

  @Get('prefill')
  @ApiOperation({
    summary: 'Lấy dữ liệu gợi ý chuẩn bị trang bị ban đầu cho chuyến đi',
    description: `
Truy vấn thông số chuyến đi (độ dài ngày, độ khó, địa hình), ước tính thời tiết ban đầu, và danh sách các hạng mục trang bị cơ bản cần chuẩn bị.

**Cách test:** Truyền \`tripId\` của chuyến đi cần kiểm tra (ví dụ từ \`GET /api/v1/trips/{tripId}/rental-eligibility\`).
`,
  })
  @ApiQuery({
    name: 'tripId',
    type: String,
    format: 'uuid',
    required: true,
    description: 'ID chuyến đi cần lấy thông tin gợi ý',
    example: '550e8400-e29b-41d4-a716-446655440101',
  })
  @ApiResponse({
    status: 200,
    description: 'Dữ liệu ngữ cảnh chuyến đi và gợi ý trang bị ban đầu',
  })
  @ApiErrorResponse(404, 'Không tìm thấy chuyến đi', GEAR_ERROR_CODES.GEAR_TRIP_NOT_FOUND, 'Chuyến đi không tồn tại hoặc bạn không tham gia')
  async prefill(
    @ActiveUser('id') userId: string,
    @Query(new ZodValidationPipe(planPrefillQuerySchema)) query: PlanPrefillQueryInput,
  ) {
    return this.gearPlanService.getTripPrefill(query.tripId, userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Tạo Kế hoạch chuẩn bị đồ mới cho chuyến đi (inputRevision = 1)',
    description: `
Khởi tạo kế hoạch chuẩn bị đồ cá nhân gắn liền với một chuyến đi cụ thể.
- Kế hoạch bắt đầu ở phiên bản đầu vào \`inputRevision = 1\` và trạng thái \`DRAFT\`.
- Có thể chọn trước các món đồ đã có trong tủ đồ cá nhân qua \`selectedItemIds\`.
- Sau khi tạo thành công, sao chép \`id\` của kế hoạch để gọi endpoint Đánh giá (\`POST /api/v1/gear/plans/{id}/evaluate\`).
`,
  })
  @ApiBody({
    description: 'Thông tin kế hoạch và danh sách đồ cá nhân đã chọn',
    schema: {
      type: 'object',
      required: ['title', 'contextMode', 'tripId'],
      properties: {
        title: { type: 'string', example: 'Kế hoạch leo Bidoup 2N1Đ cuối tuần', description: 'Tên kế hoạch' },
        contextMode: { type: 'string', enum: ['TRIP'], example: 'TRIP', description: 'Chế độ ngữ cảnh (hiện tại bắt buộc TRIP)' },
        tripId: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440101', description: 'ID chuyến đi hợp lệ' },
        selectedItemIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
          description: 'Danh sách ID các món đồ trong tủ đồ cá nhân chọn mang theo',
          example: ['550e8400-e29b-41d4-a716-446655440201'],
        },
        preferences: {
          type: 'object',
          properties: {
            maxBudgetVnd: { type: 'number', example: 500000, description: 'Ngân sách tối đa dự kiến cho việc thuê đồ' },
            prioritizeWeight: { type: 'boolean', example: false, description: 'Ưu tiên tối ưu trọng lượng nhẹ thay vì tối ưu tiền' },
          },
        },
      },
      example: {
        title: 'Kế hoạch leo Bidoup 2N1Đ cuối tuần',
        contextMode: 'TRIP',
        tripId: '550e8400-e29b-41d4-a716-446655440101',
        selectedItemIds: ['550e8400-e29b-41d4-a716-446655440201'],
        preferences: {
          maxBudgetVnd: 500000,
          prioritizeWeight: false,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Kế hoạch được tạo thành công kèm inputRevision = 1',
  })
  @ApiErrorResponse(400, 'Chuyến đi không đủ điều kiện', GEAR_ERROR_CODES.GEAR_TRIP_NOT_ELIGIBLE, 'Chuyến đi đã kết thúc hoặc không còn khả dụng')
  @ApiErrorResponse(404, 'Món đồ không thuộc sở hữu', GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, 'Món đồ chọn không tồn tại hoặc không thuộc quyền sở hữu')
  async create(
    @ActiveUser('id') userId: string,
    @Body(new ZodValidationPipe(createPlanSchema)) body: CreatePlanInputDto,
  ) {
    return this.gearPlanService.createPlan(userId, body);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách các kế hoạch trang bị của người dùng' })
  @ApiResponse({ status: 200, description: 'Danh sách kế hoạch trang bị' })
  async list(@ActiveUser('id') userId: string) {
    return this.gearPlanService.listPlans(userId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Xem chi tiết kế hoạch trang bị (kèm cờ isStale phát hiện thay đổi ngữ cảnh)',
    description: 'Trả về toàn bộ thông tin kế hoạch, tiến độ đóng gói checklist, phiên bản đánh giá mới nhất, và cờ `isStale = true` nếu tủ đồ hoặc chuyến đi có thay đổi sau lần đánh giá cuối.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'ID kế hoạch trang bị', example: '550e8400-e29b-41d4-a716-446655440300' })
  @ApiResponse({ status: 200, description: 'Thông tin chi tiết kế hoạch' })
  @ApiErrorResponse(404, 'Không tìm thấy kế hoạch', GEAR_ERROR_CODES.GEAR_PLAN_NOT_FOUND, 'Kế hoạch không tồn tại hoặc không thuộc về bạn')
  async getDetail(
    @ActiveUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.gearPlanService.getPlan(id, userId);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Cập nhật dữ liệu đầu vào của kế hoạch (CAS expectedInputRevision)',
    description: `
Cập nhật tiêu đề, danh sách đồ đã chọn từ tủ đồ, hoặc tùy chọn ngân sách.
- **CAS Concurrency:** Bắt buộc truyền \`expectedInputRevision\` trùng khớp với \`inputRevision\` hiện tại.
- Thao tác này sẽ tăng \`inputRevision\` lên 1 và đánh dấu kế hoạch cần được đánh giá lại (\`isStale = true\`).
`,
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'ID kế hoạch trang bị', example: '550e8400-e29b-41d4-a716-446655440300' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['expectedInputRevision'],
      properties: {
        expectedInputRevision: { type: 'integer', minimum: 1, example: 1, description: 'Phiên bản đầu vào hiện tại' },
        title: { type: 'string', example: 'Kế hoạch leo Bidoup (Đã thêm đồ ấm)' },
        selectedItemIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
          example: ['550e8400-e29b-41d4-a716-446655440201', '550e8400-e29b-41d4-a716-446655440202'],
        },
      },
      example: {
        expectedInputRevision: 1,
        title: 'Kế hoạch leo Bidoup (Đã thêm đồ ấm)',
        selectedItemIds: ['550e8400-e29b-41d4-a716-446655440201', '550e8400-e29b-41d4-a716-446655440202'],
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công, inputRevision tăng lên 1' })
  @ApiErrorResponse(409, 'Xung đột phiên bản', GEAR_ERROR_CODES.GEAR_PLAN_CAS_CONFLICT, 'Phiên bản đầu vào của kế hoạch đã thay đổi')
  async updateInput(
    @ActiveUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updatePlanInputSchema)) body: UpdatePlanInputDto,
  ) {
    return this.gearPlanService.updatePlanInput(id, userId, body);
  }

  @Put(':id/checklist-progress')
  @ApiOperation({
    summary: 'Cập nhật tiến độ đóng gói checklist (CAS expectedProgressVersion)',
    description: `
Đánh dấu tick hoàn thành đóng gói cho từng món đồ trong checklist.
- Thao tác độc lập với phiên bản kỹ thuật (\`inputRevision\`), không làm thay đổi snapshot đánh giá.
- Sử dụng \`expectedProgressVersion\` để kiểm soát xung đột khi thao tác trên nhiều thiết bị.
`,
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'ID kế hoạch trang bị', example: '550e8400-e29b-41d4-a716-446655440300' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['expectedProgressVersion', 'items'],
      properties: {
        expectedProgressVersion: { type: 'integer', minimum: 0, example: 0, description: 'Phiên bản tiến độ đóng gói hiện tại' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            required: ['requirementId', 'isChecked'],
            properties: {
              requirementId: { type: 'string', example: 'req_jacket', description: 'Mã yêu cầu trong checklist' },
              isChecked: { type: 'boolean', example: true, description: 'Trạng thái đã đóng gói vào balo' },
            },
          },
        },
      },
      example: {
        expectedProgressVersion: 0,
        items: [
          { requirementId: 'req_jacket', isChecked: true },
          { requirementId: 'req_footwear', isChecked: true },
          { requirementId: 'req_backpack', isChecked: false },
        ],
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Tiến độ đóng gói được cập nhật thành công' })
  @ApiErrorResponse(409, 'Xung đột tiến độ', GEAR_ERROR_CODES.GEAR_PROGRESS_CAS_CONFLICT, 'Tiến độ checklist đã được cập nhật từ phiên khác')
  async updateProgress(
    @ActiveUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateChecklistProgressSchema)) body: UpdateChecklistProgressDto,
  ) {
    return this.gearPlanService.updateChecklistProgress(id, userId, body);
  }

  @Post(':id/evaluate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đánh giá kỹ thuật kế hoạch và lưu snapshot phiên bản bất biến (Evaluation)',
    description: `
Xác nhận điều kiện thời tiết của chuyến đi, đánh giá từng món đồ cá nhân với 28 quy tắc kiểm tra, tính toán danh sách đồ còn thiếu và chốt phiên bản đánh giá (\`evaluatedRevision = inputRevision\`).

**Cách test trên Swagger:**
1. Điền \`expectedInputRevision: 1\` (hoặc version hiện tại của plan).
2. Điền thông số thời tiết thực tế của chuyến đi (\`temp_min_c\`, \`temp_max_c\`, \`temp_min_night_c\`, \`rain_prob_pct\`).
3. Nhấn Execute để nhận kết quả đánh giá (Checklist các đồ cần mang, Đồ đạt chuẩn, Đồ còn thiếu).
4. Sau khi đánh giá thành công, tiếp tục gọi \`POST /api/v1/gear/plans/{id}/options\` để tìm phương án thuê bù đắp.
`,
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'ID kế hoạch trang bị', example: '550e8400-e29b-41d4-a716-446655440300' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['expectedInputRevision', 'confirmedClimate'],
      properties: {
        expectedInputRevision: { type: 'integer', minimum: 1, example: 1, description: 'Phiên bản đầu vào hiện tại của kế hoạch' },
        confirmedClimate: {
          type: 'object',
          required: ['temp_min_c', 'temp_max_c', 'temp_min_night_c', 'rain_prob_pct'],
          properties: {
            temp_min_c: { type: 'number', example: 12, description: 'Nhiệt độ ngày thấp nhất (°C)' },
            temp_max_c: { type: 'number', example: 24, description: 'Nhiệt độ ngày cao nhất (°C)' },
            temp_min_night_c: { type: 'number', example: 8, description: 'Nhiệt độ đêm thấp nhất (°C)' },
            rain_prob_pct: { type: 'number', minimum: 0, maximum: 100, example: 60, description: 'Xác suất mưa (%)' },
          },
        },
      },
      example: {
        expectedInputRevision: 1,
        confirmedClimate: {
          temp_min_c: 12,
          temp_max_c: 24,
          temp_min_night_c: 8,
          rain_prob_pct: 60,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Đánh giá thành công, trả về Checklist, Coverage Summary và lưu immutable snapshot revision',
    schema: { type: 'object', properties: {
      itemVerdicts: { type: 'array', items: { type: 'object', properties: { itemId: { type: 'string', format: 'uuid' }, verdict: { type: 'string', enum: ['SUITABLE', 'NOT_SUITABLE'] }, reasons: { type: 'array', items: { type: 'string' } }, displayGuidance: DISPLAY_GUIDANCE_SCHEMA } } },
      coreCheck: { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: { displayGuidance: DISPLAY_GUIDANCE_SCHEMA } } } } },
    } },
  })
  @ApiErrorResponse(400, 'Thiếu thông số thời tiết', GEAR_ERROR_CODES.GEAR_NEEDS_CONTEXT, 'Thời tiết chưa được xác nhận')
  @ApiErrorResponse(409, 'Xung đột phiên bản', GEAR_ERROR_CODES.GEAR_PLAN_CAS_CONFLICT, 'Kế hoạch đã thay đổi dữ liệu đầu vào')
  async evaluate(
    @ActiveUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(evaluatePlanSchema)) body: EvaluatePlanDto,
  ) {
    return this.gearPlanService.evaluatePlan(id, userId, body);
  }

  @Get(':id/revisions')
  @ApiOperation({ summary: 'Danh sách các phiên bản đã đánh giá của kế hoạch' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'ID kế hoạch trang bị', example: '550e8400-e29b-41d4-a716-446655440300' })
  @ApiResponse({ status: 200, description: 'Danh sách các snapshot phiên bản kèm SHA256 contentHash' })
  async listRevisions(
    @ActiveUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.gearPlanService.getPlanRevisions(id, userId);
  }

  @Get(':id/revisions/:revision')
  @ApiOperation({ summary: 'Xem chi tiết một phiên bản snapshot bất biến' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'ID kế hoạch trang bị', example: '550e8400-e29b-41d4-a716-446655440300' })
  @ApiParam({ name: 'revision', type: Number, example: 1, description: 'Số phiên bản đánh giá' })
  @ApiResponse({ status: 200, description: 'Chi tiết snapshot kết quả đánh giá tại thời điểm chốt' })
  @ApiErrorResponse(404, 'Không tìm thấy phiên bản', GEAR_ERROR_CODES.GEAR_REVISION_NOT_FOUND, 'Phiên bản đánh giá không tồn tại')
  async getRevisionDetail(
    @ActiveUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('revision', ParseIntPipe) revision: number,
  ) {
    return this.gearPlanService.getPlanRevisionDetail(id, revision, userId);
  }

  @Get(':id/revisions/:revision/guidance')
  @ApiOperation({
    summary: 'Hướng dẫn bổ sung thông tin còn thiếu cho từng món đồ đã đánh giá',
    description: 'Hướng dẫn thuộc snapshot được yêu cầu. isLatestEvaluation cho biết snapshot có phải lần đánh giá mới nhất; needsReevaluation phản ánh thay đổi phiên bản hoặc isStale theo kiểm tra hiện có của kế hoạch.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'ID kế hoạch' })
  @ApiParam({ name: 'revision', type: Number, description: 'Phiên bản đánh giá' })
  @ApiResponse({ status: 200, description: 'Hướng dẫn đọc từ snapshot, không thay đổi kết quả đánh giá', schema: {
    type: 'object', properties: {
      contextQuestions: { type: 'object', description: 'Câu hỏi theo món được chọn và constraint chưa đủ dữ liệu trong snapshot; không phải verdict.', properties: {
        available: { type: 'boolean' }, items: { type: 'array', items: { type: 'object', properties: {
          itemId: { type: 'string', format: 'uuid' }, nameAtEvaluation: { type: 'string', nullable: true }, category: { type: 'string' },
          questions: { type: 'array', items: { type: 'object', properties: {
            field: { type: 'string' }, question: { type: 'string' }, valueType: { type: 'string' }, requirementId: { type: 'string' },
            constraintIds: { type: 'array', items: { type: 'string' } }, allowUnknown: { type: 'boolean' },
          } } },
        } } },
      } },
    },
  } })
  @ApiErrorResponse(404, 'Không tìm thấy kế hoạch hoặc phiên bản', GEAR_ERROR_CODES.GEAR_REVISION_NOT_FOUND, 'Phiên bản đánh giá không tồn tại')
  async getRevisionGuidance(
    @ActiveUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('revision', ParseIntPipe) revision: number,
  ) {
    return this.gearPlanService.getPlanRevisionGuidance(id, revision, userId);
  }

  @Get(':id/diff')
  @ApiOperation({ summary: 'So sánh sự khác biệt giữa hai phiên bản đánh giá (Plan Diff)' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'ID kế hoạch trang bị', example: '550e8400-e29b-41d4-a716-446655440300' })
  @ApiQuery({ name: 'from', required: false, type: Number, example: 1, description: 'Phiên bản nguồn' })
  @ApiQuery({ name: 'to', required: false, type: Number, example: 2, description: 'Phiên bản đích' })
  @ApiResponse({ status: 200, description: 'Bảng so sánh chi tiết các thay đổi trong checklist và thông số' })
  async getDiff(
    @ActiveUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(planDiffQuerySchema)) query: PlanDiffQueryInput,
  ) {
    const fromRev = query.from ?? query.fromRevision;
    const toRev = query.to ?? query.toRevision;
    return this.gearPlanService.getPlanDiff(id, userId, fromRev, toRev);
  }

  @Post(':id/options')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Tìm phương án thuê bù đắp tối ưu (Branch & Bound Deterministic Planner)',
    description: `
Thuật toán tối ưu hóa đối chiếu các món đồ còn thiếu với kho hàng thực tế trong module Rental, sinh ra 2 phương án:
1. **MIN_RENTAL_FEE:** Phương án thuê tối ưu chi phí thấp nhất.
2. **MIN_KNOWN_TOTAL_WEIGHT:** Phương án thuê tối ưu trọng lượng nhẹ nhất.

**KẾT QUẢ TRẢ VỀ:**
- Trả về \`optionRef\` (\`{ setId, optionId }\`) và danh sách \`rentalLines\`.
- \`optionRef\` này sẽ được dùng tiếp ở bước xin lời khuyên AI (\`POST /api/v1/gear/plans/{id}/advice\`) hoặc tạo báo giá (\`POST /api/v1/gear/plans/{id}/quote-intents\`).
`,
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'ID kế hoạch trang bị', example: '550e8400-e29b-41d4-a716-446655440300' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['expectedRevision'],
      properties: {
        expectedRevision: { type: 'integer', minimum: 1, example: 1, description: 'Phiên bản đánh giá hiện tại' },
        budgetLimit: { type: 'number', example: 500000, description: 'Giới hạn ngân sách thuê (tùy chọn)' },
        objective: { type: 'string', enum: ['BALANCED', 'MIN_RENTAL_FEE', 'MIN_KNOWN_TOTAL_WEIGHT'], example: 'BALANCED' },
        candidateLimit: {
          type: 'integer',
          minimum: 1,
          maximum: 50,
          default: 20,
          description: 'Số sản phẩm thuê tối đa xét cho mỗi danh mục (lấy theo giá ngày tăng dần)',
        },
      },
      example: {
        expectedRevision: 1,
        budgetLimit: 500000,
        objective: 'BALANCED',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description:
      'Tập phương án tối ưu được sinh ra kèm optionRef (thời hạn hiệu lực 15 phút). Mỗi rentalLine có grade/gradeGroupId để hiện hạng sản phẩm.',
    schema: {
      type: 'object',
      properties: {
        setId: { type: 'string', format: 'uuid' },
        planRevisionId: { type: 'string', format: 'uuid' },
        revision: { type: 'integer', example: 1 },
        objective: { type: 'string', example: 'ECONOMICAL' },
        expiresAt: { type: 'string', format: 'date-time' },
        options: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'opt_min_fee' },
              rentalLines: { type: 'array', items: RENTAL_LINE_SCHEMA },
              summary: { type: 'object' },
            },
          },
        },
        optionRef: {
          type: 'object',
          properties: { setId: { type: 'string', format: 'uuid' }, optionId: { type: 'string', example: 'opt_min_fee' } },
        },
      },
    },
  })
  @ApiErrorResponse(400, 'Chưa đánh giá kế hoạch', GEAR_ERROR_CODES.GEAR_PLAN_NOT_EVALUATED, 'Kế hoạch cần được đánh giá trước khi tìm phương án thuê')
  @ApiErrorResponse(409, 'Kế hoạch đã bị sửa', GEAR_ERROR_CODES.GEAR_PLAN_STALE, 'Kế hoạch đã thay đổi sau lần đánh giá cuối')
  async generateOptions(
    @ActiveUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(generatePlanOptionsSchema)) body: GeneratePlanOptionsDto,
  ) {
    return this.gearPlanService.generatePlanOptions(id, userId, body);
  }

  @Post(':id/advice')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sinh lời khuyên an toàn dựa trên phương án đã chọn (bộ quy tắc, AI tuỳ chọn)',
    description: `
Tổng hợp lời khuyên trang bị từ dữ kiện thật của chuyến đi và phương án đã chọn. **Luôn trả lời khuyên, không báo lỗi vì AI.**
- Mặc định (\`GEAR_AI_ADVICE_ENABLED=false\`) hoặc AI chưa cấu hình/lỗi/hết giờ: lời khuyên theo bộ quy tắc, \`source = RULE_FALLBACK\`.
- Khi bật AI: Gemini chỉ chọn trong các nhận định đã được server kiểm chứng (\`fact grounding\`); nếu AI bịa đặt hoặc thiếu an toàn, hệ thống tự chuyển sang \`RULE_FALLBACK\`.
`,
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'ID kế hoạch trang bị', example: '550e8400-e29b-41d4-a716-446655440300' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['expectedRevision', 'optionRef'],
      properties: {
        expectedRevision: { type: 'integer', minimum: 1, example: 1, description: 'Phiên bản đánh giá' },
        optionRef: {
          type: 'object',
          required: ['setId', 'optionId'],
          properties: {
            setId: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440301', description: 'ID tập phương án vừa sinh' },
            optionId: { type: 'string', example: 'opt_min_fee', description: 'ID phương án được chọn (opt_min_fee hoặc opt_min_weight)' },
          },
        },
      },
      example: {
        expectedRevision: 1,
        optionRef: {
          setId: '550e8400-e29b-41d4-a716-446655440301',
          optionId: 'opt_min_fee',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Lời khuyên an toàn tiếng Việt kèm các trích dẫn dữ kiện có thật (source: AI hoặc RULE_FALLBACK)',
  })
  @ApiErrorResponse(404, 'Không tìm thấy tập phương án', GEAR_ERROR_CODES.GEAR_OPTION_SET_NOT_FOUND, 'Tập phương án không tồn tại hoặc đã hết hạn')
  async generateAdvice(
    @ActiveUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(generatePlanAdviceSchema)) body: GeneratePlanAdviceDto,
  ) {
    return this.gearPlanService.generatePlanAdvice(id, userId, body);
  }

  @Post(':id/quote-intents')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Tạo ý định báo giá và sinh payload prefill gửi sang module Rental',
    description: `
Chuyển đổi phương án trang bị đã chọn thành payload chuẩn \`prefillRentalQuote\` để sẵn sàng tạo Báo giá thuê thiết bị.

**HƯỚNG DẪN TEST TÍCH HỢP VỚI MODULE RENTAL:**
1. Thực thi endpoint này với \`optionRef\` đã chọn.
2. Sao chép khối dữ liệu \`prefillRentalQuote\` trong response (gồm \`tripId\` và mảng \`items\`).
3. Mở endpoint \`POST /api/v1/rentals/quote\` (mục **Rental Ordering**) trên Swagger, dán dữ liệu đó vào để tạo Báo giá thuê (Quote) chính thức.
4. Lấy \`id\` của báo giá vừa tạo, quay lại endpoint \`POST /api/v1/gear/plans/{id}/quote-links\` bên dưới để gắn báo giá vào kế hoạch!
`,
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'ID kế hoạch trang bị', example: '550e8400-e29b-41d4-a716-446655440300' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['expectedRevision', 'optionRef'],
      properties: {
        expectedRevision: { type: 'integer', minimum: 1, example: 1, description: 'Phiên bản đánh giá' },
        optionRef: {
          type: 'object',
          required: ['setId', 'optionId'],
          properties: {
            setId: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440301' },
            optionId: { type: 'string', example: 'opt_min_fee' },
          },
        },
      },
      example: {
        expectedRevision: 1,
        optionRef: {
          setId: '550e8400-e29b-41d4-a716-446655440301',
          optionId: 'opt_min_fee',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Payload prefillRentalQuote hoàn chỉnh để gửi sang POST /api/v1/rentals/quote',
    schema: {
      type: 'object',
      properties: {
        planId: { type: 'string', format: 'uuid' },
        planRevision: { type: 'number', example: 1 },
        tripId: { type: 'string', format: 'uuid' },
        lines: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string', format: 'uuid' },
              productName: { type: 'string', example: 'Lều 3 người – Đã sử dụng tốt' },
              category: { type: 'string', example: 'TENT' },
              quantity: { type: 'integer', example: 1 },
              dailyPrice: { type: 'number', example: 100000 },
              rentalFee: { type: 'number', example: 200000 },
              deposit: { type: 'number', example: 600000, deprecated: true, description: 'Deprecated: dùng `depositAmount`.' },
              depositAmount: { type: 'number', example: 600000, description: 'Tiền cọc cả dòng (cùng giá trị với `deposit`).' },
              ...GRADE_SCHEMA_PROPERTIES,
            },
          },
        },
        prefillRentalQuote: {
          type: 'object',
          properties: {
            tripId: { type: 'string', format: 'uuid' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  productId: { type: 'string', format: 'uuid' },
                  quantity: { type: 'number', example: 1 },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiErrorResponse(404, 'Không tìm thấy tập phương án', GEAR_ERROR_CODES.GEAR_OPTION_SET_NOT_FOUND, 'Tập phương án không tồn tại hoặc đã hết hạn')
  @ApiErrorResponse(409, 'Kế hoạch đã thay đổi', GEAR_ERROR_CODES.GEAR_PLAN_STALE, 'Kế hoạch đã thay đổi sau khi tạo phương án')
  async createQuoteIntent(
    @ActiveUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createQuoteIntentSchema)) body: CreateQuoteIntentDto,
  ) {
    return this.gearPlanService.createQuoteIntent(id, userId, body);
  }

  @Post(':id/quote-links')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Liên kết Báo giá thuê (Rental Quote) đã tạo vào Kế hoạch trang bị',
    description: `
Gắn kết báo giá thuê (\`quoteId\`) vừa tạo từ module Rental vào phiên bản kế hoạch trang bị.
- Hệ thống kiểm tra tính hợp lệ: Báo giá phải thuộc về chính user, cùng chuyến đi và danh sách sản phẩm khớp với phương án đã chọn.

**BƯỚC TIẾP THEO:**
Sau khi liên kết báo giá thành công, người dùng có thể mở endpoint \`POST /api/v1/rental-orders\` (mục **Rental Orders - Đơn thuê thiết bị**) trên Swagger, truyền \`quoteId\` và header \`Idempotency-Key\` để tiến hành tạo đơn thuê và thanh toán!
`,
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'ID kế hoạch trang bị', example: '550e8400-e29b-41d4-a716-446655440300' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['expectedRevision', 'quoteId'],
      properties: {
        expectedRevision: { type: 'integer', minimum: 1, example: 1, description: 'Phiên bản đánh giá của kế hoạch' },
        quoteId: {
          type: 'string',
          format: 'uuid',
          description: 'ID của báo giá thuê (Rental Quote) nhận được từ POST /api/v1/rentals/quote',
          example: '550e8400-e29b-41d4-a716-446655440401',
        },
      },
      example: {
        expectedRevision: 1,
        quoteId: '550e8400-e29b-41d4-a716-446655440401',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Liên kết báo giá thành công, trả về trạng thái linked = true',
  })
  @ApiErrorResponse(400, 'Báo giá không hợp lệ', GEAR_ERROR_CODES.GEAR_QUOTE_NOT_ELIGIBLE, 'Báo giá đã hết hạn hoặc không khớp sản phẩm với phương án')
  @ApiErrorResponse(403, 'Báo giá không thuộc sở hữu', GEAR_ERROR_CODES.GEAR_QUOTE_NOT_OWNED, 'Báo giá không thuộc về bạn')
  @ApiErrorResponse(404, 'Không tìm thấy báo giá', GEAR_ERROR_CODES.GEAR_QUOTE_NOT_FOUND, 'Báo giá không tồn tại')
  async linkQuote(
    @ActiveUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(linkQuoteSchema)) body: LinkQuoteDto,
  ) {
    return this.gearPlanService.linkQuote(id, userId, body);
  }
}
