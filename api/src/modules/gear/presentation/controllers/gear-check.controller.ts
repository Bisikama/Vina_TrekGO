import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../../../shared/decorators/auth.decorator';
import { ActiveUser } from '../../../../shared/decorators/active-user.decorator';
import { AuthType } from '../../../../shared/constants/auth.constant';
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe';
import { GearCheckService } from '../../application/services/gear-check.service';
import {
  gearCheckRequestSchema,
} from '../../application/dtos/gear-check.dto';
import type {
  GearCheckRequestInput,
} from '../../application/dtos/gear-check.dto';
import { ApiErrorResponse } from '../../../../shared/swagger/api-error-response.helper';
import { GEAR_ERROR_CODES } from '../../../../shared/errors/codes/gear.error-codes';

@ApiTags('Gear - Quick Check (Đánh giá nhanh đồ cá nhân)')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Controller('gear/check')
export class GearCheckController {
  constructor(private readonly gearCheckService: GearCheckService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đánh giá nhanh danh sách đồ cá nhân đối chiếu với thời tiết chuyến đi',
    description: `
Đánh giá kỹ thuật nhanh theo 28 quy tắc thẩm định bất biến (R01 - R28) cho **5 danh mục cốt lõi** (\`JACKET\`, \`FOOTWEAR\`, \`PANTS\`, \`BACKPACK\`, \`SLEEPING_BAG\`).

**Cách thử nghiệm trên Swagger:**
1. Lấy \`tripId\` của chuyến đi bạn tham gia (từ \`GET /api/v1/trips/{tripId}/rental-eligibility\`).
2. Lấy danh sách \`itemIds\` từ tủ đồ cá nhân của bạn (\`GET /api/v1/gear/items\`).
3. Điền thông số thời tiết dự kiến (\`temp_min_c\`, \`temp_max_c\`, \`temp_min_night_c\`, \`rain_prob_pct\`).
4. Nhấn Execute để nhận kết quả phân tích từng món: Đạt chuẩn (\`SUITABLE\`), Thiếu tiêu chuẩn (\`NOT_SUITABLE\`), Cần chú ý, và danh mục còn thiếu.
*(Ghi chú: Nếu cần lưu kế hoạch dài hạn, sinh checklist và tìm đồ thuê bù đắp, vui lòng dùng nhóm API **Gear - Plan**).*
`,
  })
  @ApiBody({
    description: 'Thông tin chuyến đi, thời tiết và danh sách ID đồ cá nhân cần thẩm định',
    schema: {
      type: 'object',
      required: ['tripId', 'itemIds', 'confirmedClimate'],
      properties: {
        tripId: {
          type: 'string',
          format: 'uuid',
          description: 'ID chuyến đi cần đánh giá trang bị',
          example: '550e8400-e29b-41d4-a716-446655440101',
        },
        itemIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
          description: 'Danh sách ID các món đồ trong tủ đồ của user (không trùng lặp)',
          example: [
            '550e8400-e29b-41d4-a716-446655440201',
            '550e8400-e29b-41d4-a716-446655440202',
          ],
        },
        confirmedClimate: {
          type: 'object',
          required: ['temp_min_c', 'temp_max_c', 'temp_min_night_c', 'rain_prob_pct'],
          properties: {
            temp_min_c: { type: 'number', description: 'Nhiệt độ thấp nhất ban ngày (°C)', example: 12 },
            temp_max_c: { type: 'number', description: 'Nhiệt độ cao nhất ban ngày (°C)', example: 24 },
            temp_min_night_c: { type: 'number', description: 'Nhiệt độ thấp nhất ban đêm (°C)', example: 8 },
            rain_prob_pct: { type: 'number', minimum: 0, maximum: 100, description: 'Xác suất mưa (%)', example: 60 },
          },
        },
      },
      example: {
        tripId: '550e8400-e29b-41d4-a716-446655440101',
        itemIds: [
          '550e8400-e29b-41d4-a716-446655440201',
          '550e8400-e29b-41d4-a716-446655440202',
        ],
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
    description: 'Kết quả thẩm định chi tiết từng món đồ và các trang bị còn thiếu',
    schema: {
      type: 'object',
      properties: {
        summary: {
          type: 'object',
          properties: {
            totalItems: { type: 'number', example: 2 },
            suitableCount: { type: 'number', example: 1 },
            notSuitableCount: { type: 'number', example: 1 },
            missingCoreCategories: {
              type: 'array',
              items: { type: 'string' },
              example: ['BACKPACK', 'SLEEPING_BAG'],
            },
          },
        },
        evaluations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              itemId: { type: 'string', format: 'uuid' },
              category: { type: 'string', example: 'JACKET' },
              verdict: { type: 'string', enum: ['SUITABLE', 'NOT_SUITABLE', 'CONDITIONAL'] },
              triggeredRules: { type: 'array', items: { type: 'string' }, example: ['R01'] },
              feedbackVi: { type: 'string', example: 'Áo khoác chống nước đạt chuẩn mưa lớn (10.000mm)' },
            },
          },
        },
      },
    },
  })
  @ApiErrorResponse(400, 'Dữ liệu không hợp lệ', 'VALIDATION_ERROR', 'Nhiệt độ min phải nhỏ hơn hoặc bằng nhiệt độ max')
  @ApiErrorResponse(400, 'Thời tiết chưa xác nhận', GEAR_ERROR_CODES.GEAR_CLIMATE_NOT_CONFIRMED, 'Điều kiện thời tiết chưa được xác nhận')
  @ApiErrorResponse(400, 'Món đồ cần tạo kế hoạch', GEAR_ERROR_CODES.GEAR_CATEGORY_REQUIRES_PLAN, 'Món đồ thuộc nhóm mở rộng, cần dùng chức năng Kế hoạch')
  @ApiErrorResponse(401, 'Chưa đăng nhập', 'UNAUTHORIZED', 'Token không hợp lệ hoặc đã hết hạn')
  @ApiErrorResponse(404, 'Không tìm thấy chuyến đi', GEAR_ERROR_CODES.GEAR_TRIP_NOT_FOUND, 'Chuyến đi không tồn tại hoặc bạn không tham gia')
  async check(
    @ActiveUser('id') userId: string,
    @Body(new ZodValidationPipe(gearCheckRequestSchema)) body: GearCheckRequestInput,
  ) {
    return this.gearCheckService.checkGear(userId, body);
  }
}
