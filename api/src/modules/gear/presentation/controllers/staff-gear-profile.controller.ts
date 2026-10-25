import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Auth } from '../../../../shared/decorators/auth.decorator';
import { Roles } from '../../../../shared/decorators/roles.decorator';
import { ActiveUser } from '../../../../shared/decorators/active-user.decorator';
import { AuthType } from '../../../../shared/constants/auth.constant';
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe';
import { StaffProductProfileService } from '../../application/services/staff-product-profile.service';
import {
  upsertProductTechnicalProfileSchema,
} from '../../application/dtos/product-technical-profile.dto';
import type {
  UpsertProductTechnicalProfileInput,
} from '../../application/dtos/product-technical-profile.dto';
import { ApiErrorResponse } from '../../../../shared/swagger/api-error-response.helper';
import { GEAR_ERROR_CODES } from '../../../../shared/errors/codes/gear.error-codes';

@ApiTags('Gear - Staff Product Profiles (Cấu hình kỹ thuật sản phẩm thuê)')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Roles(UserRole.STAFF_INVENTORY, UserRole.ADMIN)
@Controller('staff/gear/product-profiles')
export class StaffGearProfileController {
  constructor(private readonly staffProductProfileService: StaffProductProfileService) {}

  @Get(':productId')
  @ApiOperation({
    summary: 'Xem hồ sơ thông số kỹ thuật trang bị của sản phẩm thuê trong Catalog (Staff / Admin)',
    description: 'Truy vấn các thuộc tính kỹ thuật (chống nước, nhiệt độ, chất liệu...) đã gán cho sản phẩm thuê trong bảng RentalProduct.',
  })
  @ApiParam({
    name: 'productId',
    type: String,
    format: 'uuid',
    description: 'ID của sản phẩm thuê (RentalProduct UUID)',
    example: '550e8400-e29b-41d4-a716-446655440102',
  })
  @ApiResponse({ status: 200, description: 'Hồ sơ thông số kỹ thuật của sản phẩm' })
  @ApiErrorResponse(404, 'Không tìm thấy sản phẩm', GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, 'Sản phẩm thuê không tồn tại')
  async getProfile(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.staffProductProfileService.getProfile(productId);
  }

  @Put(':productId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cấu hình/cập nhật thông số kỹ thuật cho sản phẩm thuê (Hỗ trợ CAS expectedVersion)',
    description: `
Gán danh mục trang bị (\`category\`) và các thông số kỹ thuật (\`attributes\`) cho sản phẩm thuê.
- Sau khi được cấu hình hồ sơ kỹ thuật, sản phẩm này sẽ được thuật toán Gear Advisor tự động tìm kiếm, đối chiếu và đưa vào các phương án gợi ý thuê (\`MIN_RENTAL_FEE\` / \`MIN_KNOWN_TOTAL_WEIGHT\`).
- Hỗ trợ CAS concurrency qua \`expectedVersion\` (truyền 0 nếu tạo mới lần đầu).
`,
  })
  @ApiParam({
    name: 'productId',
    type: String,
    format: 'uuid',
    description: 'ID của sản phẩm thuê',
    example: '550e8400-e29b-41d4-a716-446655440102',
  })
  @ApiBody({
    description: 'Thông số kỹ thuật trang bị cần thiết lập cho sản phẩm thuê',
    schema: {
      type: 'object',
      required: ['category', 'attributes'],
      properties: {
        category: {
          type: 'string',
          enum: ['JACKET', 'FOOTWEAR', 'PANTS', 'BACKPACK', 'SLEEPING_BAG', 'TENT', 'TREKKING_POLE', 'RAIN_GEAR'],
          example: 'JACKET',
          description: 'Danh mục trang bị kỹ thuật',
        },
        attributes: {
          type: 'object',
          description: 'Các thuộc tính kỹ thuật phục vụ thẩm định an toàn',
          example: {
            waterproof_mm: 12000,
            temp_rating_c: -5,
            windproof: true,
            weight_g: 550,
          },
        },
        expectedVersion: {
          type: 'integer',
          minimum: 0,
          example: 0,
          description: 'Phiên bản hồ sơ hiện tại (0 nếu tạo mới lần đầu)',
        },
        schemaVersion: {
          type: 'string',
          example: '3.1.5',
          description: 'Phiên bản schema quy chuẩn',
        },
      },
      example: {
        category: 'JACKET',
        attributes: {
          waterproof_mm: 12000,
          temp_rating_c: -5,
          windproof: true,
          weight_g: 550,
        },
        expectedVersion: 0,
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Cập nhật hồ sơ kỹ thuật sản phẩm thành công' })
  @ApiErrorResponse(404, 'Không tìm thấy sản phẩm', GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, 'Sản phẩm thuê không tồn tại')
  @ApiErrorResponse(409, 'Xung đột phiên bản', GEAR_ERROR_CODES.GEAR_ITEM_VERSION_CONFLICT, 'Phiên bản hồ sơ đã thay đổi')
  async upsertProfile(
    @Param('productId', ParseUUIDPipe) productId: string,
    @ActiveUser('id') actorId: string,
    @Body(new ZodValidationPipe(upsertProductTechnicalProfileSchema)) body: UpsertProductTechnicalProfileInput,
  ) {
    return this.staffProductProfileService.upsertProfile(productId, body, actorId);
  }
}
