import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody, ApiParam, ApiResponse } from '@nestjs/swagger';
import { Auth } from '../../../../shared/decorators/auth.decorator';
import { AuthType } from '../../../../shared/constants/auth.constant';
import { ActiveUser } from '../../../../shared/decorators/active-user.decorator';
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe';
import { GearExtractionService } from '../../application/services/gear-extraction.service';
import {
  createExtractionSchema,
  confirmExtractionDraftSchema,
} from '../../application/dtos/gear-extraction.dto';
import type {
  CreateExtractionDto,
  ConfirmExtractionDraftDto,
} from '../../application/dtos/gear-extraction.dto';
import { toWireUserGearItem } from './user-gear.controller';
import { ApiErrorResponse } from '../../../../shared/swagger/api-error-response.helper';
import { GEAR_ERROR_CODES } from '../../../../shared/errors/codes/gear.error-codes';

@ApiTags('Gear - Extractions (Trích xuất thông số đồ bằng AI)')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Controller('gear/extractions')
export class GearExtractionController {
  constructor(private readonly extractionService: GearExtractionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Khởi tạo trích xuất thông số trang bị (từ Ảnh tag/mác hoặc Link Web)',
    description: `
Trích xuất tự động thông số kỹ thuật (chống nước, nhiệt độ, chất liệu, dung tích...) bằng **Gemini Vision** hoặc bộ đọc trang web **Firecrawl**.

**Hạn ngạch & Giới hạn:**
- Mỗi người dùng có **20 lượt trích xuất/ngày** (tính theo múi giờ \`Asia/Saigon\`).
- Bản nháp trích xuất có thời hạn hiệu lực **24 giờ**.

**Hướng dẫn test trên Swagger:**
- **Cách 1 (Từ Link Web):** Chọn ví dụ \`linkExtraction\`, điền một đường link trang web sản phẩm leo núi dã ngoại (ví dụ: Decathlon, Naturehike...) và Execute.
- **Cách 2 (Từ Ảnh):** Tải ảnh nhãn mác quần áo/balo lên qua \`POST /api/v1/media/upload-intents\`, lấy \`uploadId\` và chọn ví dụ \`imageExtraction\`.
- Sau khi nhận được kết quả (kèm \`id\` của bản nháp), sao chép \`id\` sang endpoint \`POST /api/v1/gear/extractions/{id}/confirm\` để lưu vào tủ đồ cá nhân.
`,
  })
  @ApiBody({
    description: 'Nguồn trích xuất: Ảnh (uploadId) hoặc Đường link sản phẩm (url)',
    schema: {
      type: 'object',
      required: ['sourceType'],
      properties: {
        sourceType: {
          type: 'string',
          enum: ['IMAGE', 'LINK'],
          example: 'LINK',
          description: 'Nguồn dữ liệu trích xuất (IMAGE hoặc LINK)',
        },
        uploadId: {
          type: 'string',
          format: 'uuid',
          description: 'ID file ảnh đã upload (bắt buộc khi sourceType = IMAGE)',
          example: '550e8400-e29b-41d4-a716-446655440101',
        },
        url: {
          type: 'string',
          format: 'uri',
          description: 'URL sản phẩm dã ngoại (bắt buộc khi sourceType = LINK)',
          example: 'https://www.decathlon.vn/p/ao-khoac-trekking-chong-nuoc-nam-nhap-khau-8739191',
        },
        forceRefresh: {
          type: 'boolean',
          example: false,
          description: 'Bỏ qua cache và trích xuất lại từ đầu (mặc định false)',
        },
      },
    },
    examples: {
      linkExtraction: {
        summary: 'Mẫu 1: Trích xuất từ Link Web Decathlon (sourceType = LINK)',
        value: {
          sourceType: 'LINK',
          url: 'https://www.decathlon.vn/p/ao-khoac-trekking-chong-nuoc-nam-nhap-khau-8739191',
        },
      },
      imageExtraction: {
        summary: 'Mẫu 2: Trích xuất từ Ảnh tem mác (sourceType = IMAGE)',
        value: {
          sourceType: 'IMAGE',
          uploadId: '550e8400-e29b-41d4-a716-446655440101',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Bản nháp trích xuất được tạo thành công kèm thông số kỹ thuật (status = READY)',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440199' },
        sourceType: { type: 'string', example: 'LINK' },
        status: { type: 'string', example: 'READY' },
        extractedData: {
          type: 'object',
          properties: {
            name: { type: 'string', example: 'Áo khoác leo núi chống nước Quechua MH500' },
            category: { type: 'string', example: 'JACKET' },
            brand: { type: 'string', example: 'Quechua' },
            condition: { type: 'string', example: 'GOOD' },
            attributes: {
              type: 'object',
              example: { waterproof_mm: 10000, temp_rating_c: -2, windproof: true, weight_g: 520 },
            },
          },
        },
        expiresAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiErrorResponse(400, 'Dữ liệu không hợp lệ', 'VALIDATION_ERROR', 'URL không hợp lệ hoặc thiếu uploadId')
  @ApiErrorResponse(401, 'Chưa đăng nhập', 'UNAUTHORIZED', 'Token không hợp lệ hoặc đã hết hạn')
  @ApiErrorResponse(409, 'Hết lượt trích xuất trong ngày', GEAR_ERROR_CODES.GEAR_EXTRACTION_QUOTA_EXCEEDED, 'Đã đạt giới hạn 20 lượt trích xuất/ngày')
  @ApiErrorResponse(503, 'Trình đọc web không khả dụng', GEAR_ERROR_CODES.GEAR_PAGE_READER_UNAVAILABLE, 'Dịch vụ trích xuất web tạm thời không khả dụng')
  async createExtraction(
    @ActiveUser('id') userId: string,
    @Body(new ZodValidationPipe(createExtractionSchema)) body: CreateExtractionDto,
  ) {
    const draft = await this.extractionService.createExtraction(userId, body);
    return {
      id: draft.id,
      userId: draft.userId,
      sourceType: draft.sourceType,
      sourceHash: draft.sourceHash,
      status: draft.status,
      extractedData: draft.extractedData,
      version: draft.version,
      expiresAt: draft.expiresAt,
      createdAt: draft.createdAt,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết bản nháp trích xuất' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'ID của bản nháp trích xuất', example: '550e8400-e29b-41d4-a716-446655440199' })
  @ApiResponse({ status: 200, description: 'Thông tin chi tiết bản nháp trích xuất' })
  @ApiErrorResponse(404, 'Không tìm thấy', GEAR_ERROR_CODES.GEAR_EXTRACTION_DRAFT_NOT_FOUND, 'Bản nháp trích xuất không tồn tại hoặc đã hết hạn')
  async getDraft(
    @ActiveUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const draft = await this.extractionService.getDraft(id, userId);
    return {
      id: draft.id,
      userId: draft.userId,
      sourceType: draft.sourceType,
      sourceHash: draft.sourceHash,
      status: draft.status,
      extractedData: draft.extractedData,
      confirmedItemId: draft.confirmedItemId,
      version: draft.version,
      expiresAt: draft.expiresAt,
      createdAt: draft.createdAt,
    };
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Xác nhận bản nháp trích xuất và thêm món đồ vào tủ đồ cá nhân',
    description: `
Người dùng kiểm tra thông số AI đã trích xuất, chỉnh sửa thông tin (nếu cần) và xác nhận để tạo món đồ (\`UserGearItem\`) trong tủ đồ cá nhân.
- Hỗ trợ gọi lại an toàn (Idempotent replay).
- Áp dụng kiểm tra dung lượng tủ đồ (tối đa 50 món).
`,
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'ID bản nháp trích xuất', example: '550e8400-e29b-41d4-a716-446655440199' })
  @ApiBody({
    description: 'Dữ liệu món đồ đã được người dùng kiểm tra/chỉnh sửa',
    schema: {
      type: 'object',
      required: ['item'],
      properties: {
        item: {
          type: 'object',
          required: ['name', 'category', 'condition'],
          properties: {
            name: { type: 'string', example: 'Áo khoác leo núi chống nước Quechua MH500' },
            category: { type: 'string', enum: ['JACKET', 'FOOTWEAR', 'PANTS', 'BACKPACK', 'SLEEPING_BAG', 'TENT', 'TREKKING_POLE', 'RAIN_GEAR'], example: 'JACKET' },
            brand: { type: 'string', example: 'Quechua' },
            condition: { type: 'string', enum: ['EXCELLENT', 'GOOD', 'FAIR', 'POOR'], example: 'GOOD' },
            attributes: {
              type: 'object',
              example: {
                waterproof_mm: 10000,
                temp_rating_c: -2,
                windproof: true,
                weight_g: 520,
              },
            },
          },
        },
      },
      example: {
        item: {
          name: 'Áo khoác leo núi chống nước Quechua MH500',
          category: 'JACKET',
          brand: 'Quechua',
          condition: 'GOOD',
          attributes: {
            waterproof_mm: 10000,
            temp_rating_c: -2,
            windproof: true,
            weight_g: 520,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Xác nhận thành công, trả về thông tin món đồ đã lưu vào tủ đồ',
  })
  @ApiErrorResponse(404, 'Không tìm thấy bản nháp', GEAR_ERROR_CODES.GEAR_EXTRACTION_DRAFT_NOT_FOUND, 'Bản nháp không tồn tại hoặc đã hết hạn')
  @ApiErrorResponse(409, 'Tủ đồ đã đầy', GEAR_ERROR_CODES.GEAR_ITEM_LIMIT_EXCEEDED, 'Tủ đồ đã đạt giới hạn tối đa 50 món')
  async confirmDraft(
    @ActiveUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(confirmExtractionDraftSchema)) body: ConfirmExtractionDraftDto,
  ) {
    const res = await this.extractionService.confirmDraft(id, userId, body);
    return {
      item: toWireUserGearItem(res.item),
      replayed: res.replayed,
    };
  }
}
