import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { UserGearService } from '../../application/services/user-gear.service';
import {
  createUserGearItemSchema,
  patchUserGearItemSchema,
  addPhotoSchema,
  reorderPhotosSchema,
} from '../../application/dtos/user-gear.dto';
import type {
  CreateUserGearItemInput,
  PatchUserGearItemInput,
  AddPhotoInput,
  ReorderPhotosInput,
} from '../../application/dtos/user-gear.dto';
import type { GearCategory, UserGearItemDomain } from '../../domain/gear.types';
import { GearMappers } from '../../domain/gear-mappers';
import { AppError } from '../../../../shared/errors/app-error';
import { GEAR_ERROR_CODES } from '../../../../shared/errors/codes/gear.error-codes';
import { ApiErrorResponse } from '../../../../shared/swagger/api-error-response.helper';

export function toWireUserGearItem(item: UserGearItemDomain) {
  return {
    id: item.id,
    userId: item.userId,
    name: item.name,
    category: item.category,
    brand: item.brand,
    condition: GearMappers.condition.toWire(item.condition),
    attributes: item.attributes,
    photoRef: item.photoRef,
    photos: (item.photos || []).map((p) => ({
      id: p.id,
      storageRef: p.storageRef,
      position: p.position,
    })),
    source: GearMappers.source.toWire(item.source),
    version: item.version,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

@ApiTags('Gear - Closet (Tủ đồ cá nhân)')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Controller('gear/items')
export class UserGearController {
  constructor(private readonly userGearService: UserGearService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Thêm món đồ vào tủ đồ cá nhân (Giới hạn 50 món, tự phát hiện trùng lặp)',
    description: `
Lưu một món đồ vào tủ đồ cá nhân của người dùng.
- **Giới hạn số lượng:** Mỗi tài khoản lưu tối đa 50 món đồ.
- **8 Danh mục hỗ trợ:** \`JACKET\`, \`FOOTWEAR\`, \`PANTS\`, \`BACKPACK\`, \`SLEEPING_BAG\`, \`TENT\`, \`TREKKING_POLE\`, \`RAIN_GEAR\`.
- **Tình trạng món đồ (condition):** \`EXCELLENT\`, \`GOOD\`, \`FAIR\`, \`POOR\`.
- **Phát hiện trùng lặp:** Hệ thống cảnh báo hoặc chặn trùng lặp nếu trùng tên, thương hiệu và danh mục.

**Gợi ý test trên Swagger:** Chọn một trong các ví dụ mẫu bên dưới (Áo khoác chống nước, Giày leo núi, Balo trợ lực, Túi ngủ) và nhấn Execute. Sau đó sao chép ID món đồ để sử dụng trong Kế hoạch trang bị (\`POST /api/v1/gear/plans\`).
`,
  })
  @ApiBody({
    description: 'Thông tin chi tiết món đồ trang bị dã ngoại',
    schema: {
      type: 'object',
      required: ['name', 'category', 'condition'],
      properties: {
        name: { type: 'string', example: 'Áo khoác chống nước Quechua MH500', description: 'Tên món đồ (1 - 100 ký tự)' },
        category: {
          type: 'string',
          enum: ['JACKET', 'FOOTWEAR', 'PANTS', 'BACKPACK', 'SLEEPING_BAG', 'TENT', 'TREKKING_POLE', 'RAIN_GEAR'],
          example: 'JACKET',
          description: 'Danh mục trang bị',
        },
        brand: { type: 'string', example: 'Quechua', description: 'Thương hiệu sản xuất' },
        condition: {
          type: 'string',
          enum: ['EXCELLENT', 'GOOD', 'FAIR', 'POOR'],
          example: 'GOOD',
          description: 'Tình trạng món đồ (POOR sẽ kích hoạt quy tắc R24 đánh giá không phù hợp)',
        },
        attributes: {
          type: 'object',
          description: 'Các thuộc tính kỹ thuật chuyên sâu theo danh mục',
          properties: {
            waterproof_mm: { type: 'number', example: 10000, description: 'Độ chống nước theo cột nước (mm)' },
            temp_rating_c: { type: 'number', example: -2, description: 'Nhiệt độ chịu đựng danh định (°C)' },
            windproof: { type: 'boolean', example: true, description: 'Khả năng cản gió' },
            weight_g: { type: 'number', example: 520, description: 'Trọng lượng món đồ (gram)' },
            capacity_l: { type: 'number', example: 50, description: 'Dung tích balo (lít)' },
            rain_cover: { type: 'boolean', example: true, description: 'Có áo mưa bọc balo đi kèm' },
            waterproof: { type: 'boolean', example: true, description: 'Có tính năng chống thấm nước' },
            ankle_support: { type: 'boolean', example: true, description: 'Cổ giày hỗ trợ bảo vệ cổ chân' },
            grip_level: { type: 'number', minimum: 1, maximum: 5, example: 4, description: 'Cấp độ bám gai đế giày (1-5)' },
          },
        },
        photoUploadIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
          description: 'Danh sách ID ảnh đã tải lên từ Media upload-intents (tối đa 3 ảnh)',
          example: [],
        },
      },
    },
    examples: {
      jacket: {
        summary: 'Mẫu 1: Áo khoác leo núi (JACKET)',
        value: {
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
      footwear: {
        summary: 'Mẫu 2: Giày trekking cổ lửng (FOOTWEAR)',
        value: {
          name: 'Giày trekking chống trượt Salomon X Ultra 4',
          category: 'FOOTWEAR',
          brand: 'Salomon',
          condition: 'EXCELLENT',
          attributes: {
            waterproof: true,
            ankle_support: true,
            grip_level: 4,
            weight_g: 780,
          },
        },
      },
      backpack: {
        summary: 'Mẫu 3: Balo trợ lực 55L (BACKPACK)',
        value: {
          name: 'Balo trợ lực Osprey Atmos AG 50',
          category: 'BACKPACK',
          brand: 'Osprey',
          condition: 'EXCELLENT',
          attributes: {
            capacity_l: 50,
            rain_cover: true,
            waterproof: false,
            weight_g: 1900,
          },
        },
      },
      sleepingBag: {
        summary: 'Mẫu 4: Túi ngủ lông vũ (SLEEPING_BAG)',
        value: {
          name: 'Túi ngủ dã ngoại siêu nhẹ Naturehike CW400',
          category: 'SLEEPING_BAG',
          brand: 'Naturehike',
          condition: 'GOOD',
          attributes: {
            temp_rating_c: 0,
            weight_g: 910,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Thêm món đồ thành công, trả về thông tin chi tiết kèm version = 1',
  })
  @ApiErrorResponse(400, 'Dữ liệu không hợp lệ', 'VALIDATION_ERROR', 'Tên món đồ không được để trống hoặc danh mục không hợp lệ')
  @ApiErrorResponse(401, 'Chưa đăng nhập', 'UNAUTHORIZED', 'Token không hợp lệ hoặc đã hết hạn')
  @ApiErrorResponse(409, 'Tủ đồ đã đầy', GEAR_ERROR_CODES.GEAR_ITEM_LIMIT_EXCEEDED, 'Tủ đồ cá nhân đã đạt giới hạn tối đa 50 món')
  @ApiErrorResponse(409, 'Món đồ bị trùng', GEAR_ERROR_CODES.GEAR_ITEM_POSSIBLE_DUPLICATE, 'Món đồ có cùng tên và thương hiệu đã tồn tại trong tủ đồ')
  async create(
    @ActiveUser('id') userId: string,
    @Body(new ZodValidationPipe(createUserGearItemSchema)) body: CreateUserGearItemInput,
  ) {
    const item = await this.userGearService.createItem(userId, body);
    return toWireUserGearItem(item);
  }

  @Get()
  @ApiOperation({
    summary: 'Xem danh sách tủ đồ cá nhân (Lọc theo danh mục & Phân trang)',
    description: 'Truy vấn danh sách các món đồ trong tủ đồ của người dùng hiện tại. Có thể lọc theo 1 trong 8 danh mục và chỉ định phân trang.',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: ['JACKET', 'FOOTWEAR', 'PANTS', 'BACKPACK', 'SLEEPING_BAG', 'TENT', 'TREKKING_POLE', 'RAIN_GEAR'],
    description: 'Lọc danh sách theo danh mục trang bị',
    example: 'JACKET',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Trang hiện tại (mặc định 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20, description: 'Số lượng món trên mỗi trang (1-100, mặc định 20)' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách các món đồ kèm metadata phân trang',
  })
  async list(
    @ActiveUser('id') userId: string,
    @Query('category') category?: GearCategory,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const validCategories = [
      'JACKET',
      'FOOTWEAR',
      'PANTS',
      'BACKPACK',
      'SLEEPING_BAG',
      'TENT',
      'TREKKING_POLE',
      'RAIN_GEAR',
    ];

    if (category && !validCategories.includes(category)) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CATEGORY_MISMATCH, {
        message: `Danh mục truy vấn '${category}' không hợp lệ`,
      });
    }

    if (page !== undefined && (!/^\d+$/.test(page) || parseInt(page, 10) < 1)) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CATEGORY_MISMATCH, {
        message: 'Tham số page phải là số nguyên dương',
      });
    }

    if (limit !== undefined && (!/^\d+$/.test(limit) || parseInt(limit, 10) < 1 || parseInt(limit, 10) > 100)) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CATEGORY_MISMATCH, {
        message: 'Tham số limit phải là số nguyên từ 1 đến 100',
      });
    }

    const items = await this.userGearService.listItems(userId, category);
    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit || '20', 10) || 20));
    const start = (pageNum - 1) * limitNum;
    const paginated = items.slice(start, start + limitNum);

    return {
      items: paginated.map(toWireUserGearItem),
      meta: {
        total: items.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(items.length / limitNum) || 1,
      },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết một món đồ trong tủ đồ' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'ID của món đồ cần xem', example: '550e8400-e29b-41d4-a716-446655440201' })
  @ApiResponse({ status: 200, description: 'Thông tin chi tiết món đồ' })
  @ApiErrorResponse(404, 'Không tìm thấy', GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, 'Món đồ không tồn tại hoặc không thuộc quyền sở hữu của bạn')
  async get(
    @ActiveUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const item = await this.userGearService.getItem(id, userId);
    return toWireUserGearItem(item);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Cập nhật món đồ (Hỗ trợ Optimistic CAS qua expectedVersion)',
    description: `
Cập nhật tên, tình trạng, hoặc các thuộc tính kỹ thuật.
- **CAS Concurrency:** Bắt buộc truyền \`expectedVersion\` trùng khớp với \`version\` hiện tại của món đồ. Sau khi cập nhật, \`version\` tự động tăng lên 1.
- **Xóa thuộc tính:** Gửi giá trị \`null\` cho một thuộc tính trong \`attributes\` để xóa thuộc tính đó.
`,
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'ID của món đồ cần sửa', example: '550e8400-e29b-41d4-a716-446655440201' })
  @ApiBody({
    description: 'Dữ liệu cần cập nhật kèm phiên bản kỳ vọng',
    schema: {
      type: 'object',
      required: ['expectedVersion'],
      properties: {
        expectedVersion: { type: 'integer', minimum: 1, example: 1, description: 'Phiên bản hiện tại của món đồ' },
        name: { type: 'string', example: 'Áo khoác gió Quechua MH500 (Đã giặt sấy)' },
        condition: { type: 'string', enum: ['EXCELLENT', 'GOOD', 'FAIR', 'POOR'], example: 'EXCELLENT' },
        attributes: {
          type: 'object',
          example: { waterproof_mm: 12000, temp_rating_c: -5 },
          description: 'Cập nhật hoặc xóa thuộc tính (truyền null để xóa)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công, trả về món đồ với version mới' })
  @ApiErrorResponse(404, 'Không tìm thấy', GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, 'Món đồ không tồn tại hoặc không thuộc về bạn')
  @ApiErrorResponse(409, 'Xung đột phiên bản', GEAR_ERROR_CODES.GEAR_ITEM_VERSION_CONFLICT, 'Phiên bản món đồ đã thay đổi, vui lòng tải lại trước khi sửa')
  async patch(
    @ActiveUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(patchUserGearItemSchema)) body: PatchUserGearItemInput,
  ) {
    const updated = await this.userGearService.patchItem(id, userId, body);
    return toWireUserGearItem(updated);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa món đồ khỏi tủ đồ cá nhân' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'ID của món đồ cần xóa', example: '550e8400-e29b-41d4-a716-446655440201' })
  @ApiResponse({ status: 200, description: 'Xóa món đồ thành công' })
  @ApiErrorResponse(404, 'Không tìm thấy', GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, 'Món đồ không tồn tại hoặc không thuộc về bạn')
  async delete(
    @ActiveUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.userGearService.deleteItem(id, userId);
    return { success: true };
  }

  @Post(':id/photos')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Thêm ảnh cho món đồ (Tối đa 3 ảnh, vị trí 0..2)' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'ID của món đồ' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['storageRef', 'position'],
      properties: {
        storageRef: { type: 'string', example: 'gear/user-photos/jacket-front.jpg', description: 'Đường dẫn lưu trữ ảnh' },
        position: { type: 'integer', minimum: 0, maximum: 2, example: 0, description: 'Vị trí sắp xếp (0 là ảnh bìa)' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Thêm ảnh thành công' })
  async addPhoto(
    @ActiveUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) itemId: string,
    @Body(new ZodValidationPipe(addPhotoSchema)) body: AddPhotoInput,
  ) {
    const photo = await this.userGearService.addPhoto(itemId, userId, body.storageRef, body.position);
    return {
      id: photo.id,
      storageRef: photo.storageRef,
      position: photo.position,
    };
  }

  @Delete(':id/photos/:photoId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa ảnh khỏi món đồ' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'ID của món đồ' })
  @ApiParam({ name: 'photoId', format: 'uuid', description: 'ID của ảnh cần xóa' })
  @ApiResponse({ status: 200, description: 'Xóa ảnh thành công' })
  async deletePhoto(
    @ActiveUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) itemId: string,
    @Param('photoId', new ParseUUIDPipe()) photoId: string,
  ) {
    await this.userGearService.deletePhoto(itemId, photoId, userId);
    return { success: true };
  }

  @Put(':id/photos/reorder')
  @ApiOperation({ summary: 'Thay đổi thứ tự hiển thị các ảnh của món đồ' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'ID của món đồ' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['photoOrders'],
      properties: {
        photoOrders: {
          type: 'array',
          items: {
            type: 'object',
            required: ['photoId', 'position'],
            properties: {
              photoId: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440299' },
              position: { type: 'integer', minimum: 0, maximum: 2, example: 0 },
            },
          },
        },
      },
      example: {
        photoOrders: [
          { photoId: '550e8400-e29b-41d4-a716-446655440299', position: 0 },
        ],
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Sắp xếp ảnh thành công' })
  async reorderPhotos(
    @ActiveUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) itemId: string,
    @Body(new ZodValidationPipe(reorderPhotosSchema)) body: ReorderPhotosInput,
  ) {
    const photos = await this.userGearService.reorderPhotos(itemId, userId, body.photoOrders);
    return {
      photos: photos.map((p) => ({
        id: p.id,
        storageRef: p.storageRef,
        position: p.position,
      })),
    };
  }
}
