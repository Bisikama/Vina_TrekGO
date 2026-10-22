import { Controller, Get, Param, Patch, Body, Query, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiBody, ApiQuery, ApiParam } from '@nestjs/swagger'
import { Auth } from 'src/shared/decorators/auth.decorator'
import { Roles } from 'src/shared/decorators/roles.decorator'
import { AuthType } from 'src/shared/constants/auth.constant'
import { UserRole } from 'src/shared/constants/enum.constant'
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe'
import { ListStaffRentalProductsUseCase } from '../../application/use-cases/list-staff-rental-products.use-case'
import { GetRentalProductUseCase } from '../../application/use-cases/get-rental-product.use-case'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'
import type { ActiveUserData } from 'src/shared/types/user.type'
import { ChangeRentalProductStatusUseCase } from '../../application/use-cases/change-rental-product-status.use-case'
import { CreateRentalProductUseCase } from '../../application/use-cases/create-rental-product.use-case'
import { UpdateRentalProductUseCase } from '../../application/use-cases/update-rental-product.use-case'
import { ListStaffRentalProductsSchema, type ListStaffRentalProductsDto } from '../dtos/list-staff-rental-products.dto'
import {
  ChangeRentalProductStatusSchema,
  type ChangeRentalProductStatusDto,
} from '../dtos/change-rental-product-status.dto'
import { CreateRentalProductSchema, type CreateRentalProductDto } from '../dtos/create-rental-product.dto'
import { UpdateRentalProductSchema, type UpdateRentalProductDto } from '../dtos/update-rental-product.dto'
import { ApiErrorResponse } from 'src/shared/swagger/api-error-response.helper'

@ApiTags('Staff Rental Products')
@ApiBearerAuth()
@Auth([AuthType.Bearer])
@Roles(UserRole.STAFF_INVENTORY, UserRole.ADMIN)
@Controller('staff/rental-products')
export class StaffRentalProductController {
  constructor(
    private readonly listStaffRentalProductsUseCase: ListStaffRentalProductsUseCase,
    private readonly getRentalProductUseCase: GetRentalProductUseCase,
    private readonly changeRentalProductStatusUseCase: ChangeRentalProductStatusUseCase,
    private readonly createRentalProductUseCase: CreateRentalProductUseCase,
    private readonly updateRentalProductUseCase: UpdateRentalProductUseCase,
  ) {}

  @ApiOperation({
    summary: 'Lấy danh sách sản phẩm thuê (staff)',
    description: `
Danh sách toàn bộ sản phẩm thuê dành cho nhân viên quản lý.
- Hiển thị cả các sản phẩm INACTIVE và ARCHIVED.
- Hỗ trợ lọc theo trạng thái và phân trang.
`,
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách sản phẩm kèm phân trang, hỗ trợ lọc theo trạng thái',
    schema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object' } },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            pageSize: { type: 'number' },
            totalItems: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'],
    description: 'Lọc theo trạng thái (ACTIVE, INACTIVE, ARCHIVED)',
    example: 'ACTIVE',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1, default: 1, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, minimum: 1, maximum: 100, default: 20, example: 20 })
  @Get()
  async listProducts(@Query(new ZodValidationPipe(ListStaffRentalProductsSchema)) query: ListStaffRentalProductsDto) {
    return this.listStaffRentalProductsUseCase.execute(query)
  }

  @ApiOperation({
    summary: 'Lấy thông tin chi tiết sản phẩm thuê (staff)',
    description: `
Chi tiết thông tin sản phẩm dành cho nhân viên quản lý kho / admin.
- Hiển thị sản phẩm ở mọi trạng thái (ACTIVE, INACTIVE, ARCHIVED).
- Không tồn tại -> 404 RENTAL_PRODUCT_NOT_FOUND.
`,
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'RentalProduct UUID',
    example: '11111111-1111-4111-8111-111111111111',
  })
  @ApiResponse({
    status: 200,
    description: 'Thông tin chi tiết sản phẩm thuê (mọi trạng thái)',
  })
  @ApiErrorResponse(404, 'Không tìm thấy sản phẩm', 'RENTAL_PRODUCT_NOT_FOUND', 'Sản phẩm không tồn tại')
  @Get(':id')
  async getProduct(@Param('id') id: string, @ActiveUser() user?: ActiveUserData) {
    return this.getRentalProductUseCase.execute(id, user?.role)
  }

  @ApiOperation({
    summary: 'Thay đổi trạng thái sản phẩm thuê (staff)',
    description: `
Cho phép thay đổi lifecycle status của sản phẩm (ACTIVE, INACTIVE, ARCHIVED).
- Yêu cầu \`expectedVersion\` để kiểm soát đồng thời.
- Archive một sản phẩm đồng nghĩa với việc sản phẩm đó không còn public nữa.
`,
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'RentalProduct UUID',
    example: '11111111-1111-4111-8111-111111111111',
  })
  @ApiResponse({
    status: 200,
    description: 'Trạng thái đã được cập nhật',
    schema: {
      type: 'object',
      properties: { id: { type: 'string', format: 'uuid' }, version: { type: 'integer' }, status: { type: 'string' } },
    },
  })
  @ApiErrorResponse(409, 'Xung đột phiên bản', 'VERSION_CONFLICT', 'Sản phẩm đã thay đổi; lấy version mới rồi thử lại')
  @ApiBody({
    description: 'Lấy expectedVersion từ kết quả xem hoặc liệt kê sản phẩm. Chọn một trạng thái mới.',
    schema: {
      type: 'object',
      required: ['status', 'expectedVersion'],
      properties: {
        status: {
          type: 'string',
          enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'],
          example: 'ACTIVE',
          description: 'Trạng thái muốn chuyển sang',
        },
        expectedVersion: { type: 'integer', minimum: 1, example: 1, description: 'Phiên bản hiện tại của sản phẩm' },
      },
      example: { status: 'ACTIVE', expectedVersion: 1 },
    },
  })
  @HttpCode(HttpStatus.OK)
  @Patch(':id/status')
  async changeStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ChangeRentalProductStatusSchema)) body: ChangeRentalProductStatusDto,
  ) {
    return this.changeRentalProductStatusUseCase.execute({
      id,
      status: body.status,
      expectedVersion: body.expectedVersion,
    })
  }

  @ApiOperation({
    summary: 'Tạo mới sản phẩm thuê (staff)',
    description: `
Tạo một sản phẩm (catalog item) mới.
- Khởi tạo mặc định ở trạng thái ACTIVE để sẵn sàng phục vụ thuê.
- Nếu muốn tạm ẩn, nhân viên có thể gọi PATCH /api/v1/staff/rental-products/{id}/status để chuyển sang INACTIVE.
`,
  })
  @ApiResponse({
    status: 201,
    description: 'Sản phẩm thuê được tạo thành công',
    schema: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, sku: { type: 'string' } } },
  })
  @ApiErrorResponse(409, 'SKU đã tồn tại', 'RENTAL_PRODUCT_SKU_EXISTS', 'Hãy dùng mã SKU chưa được tạo')
  @ApiBody({
    description:
      'Dùng categoryId có thật từ GET /api/v1/rental-categories. SKU phải duy nhất; ảnh chỉ gửi khi đã có media ID.',
    schema: {
      type: 'object',
      required: ['categoryId', 'sku', 'name', 'dailyPrice', 'replacementValue', 'depositPolicy'],
      properties: {
        categoryId: {
          type: 'string',
          format: 'uuid',
          example: '550e8400-e29b-41d4-a716-446655440010',
          description: 'Thay bằng ID danh mục có thật',
        },
        sku: { type: 'string', example: 'TENT-4P-001' },
        name: { type: 'string', example: 'Lều cắm trại 4 người' },
        description: { type: 'string', example: 'Lều chống nước 2 lớp' },
        dailyPrice: { type: 'number', example: 150000 },
        currency: { type: 'string', example: 'VND' },
        replacementValue: { type: 'number', example: 2000000 },
        depositPolicy: {
          type: 'object',
          properties: {
            type: { type: 'string', example: 'PERCENT_REPLACEMENT_VALUE' },
            amount: { type: 'number', example: 0 },
            percentage: { type: 'number', example: 50 },
          },
        },
        imageMediaIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
          description: 'ID media đã tải lên; có thể bỏ qua khi test tạo sản phẩm',
        },
        spec: { type: 'object', example: { weight: '2.5kg', capacity: '4 persons' } },
        recommendationTags: { type: 'array', items: { type: 'string' }, example: ['camping', 'family'] },
        requiresDeepInspectionAfterReturn: {
          type: 'boolean',
          example: false,
          description: 'Bật kiểm tra sâu sau khi khách hoàn trả thiết bị (mặc định false)',
        },
      },
      example: {
        categoryId: '550e8400-e29b-41d4-a716-446655440010',
        sku: 'TENT-4P-001',
        name: 'Lều cắm trại 4 người',
        dailyPrice: 150000,
        currency: 'VND',
        replacementValue: 2000000,
        depositPolicy: { type: 'PERCENT_REPLACEMENT_VALUE', percentage: 50 },
      },
    },
  })
  @Post()
  async createProduct(@Body(new ZodValidationPipe(CreateRentalProductSchema)) body: CreateRentalProductDto) {
    return this.createRentalProductUseCase.execute(body)
  }

  @ApiOperation({
    summary: 'Cập nhật thông tin sản phẩm thuê (staff)',
    description: `
Cập nhật các thuộc tính của sản phẩm.
- Hỗ trợ optimistic locking thông qua \`expectedVersion\`.
- Lưu ý: imageMediaIds thay thế hoàn toàn mảng cũ bằng mảng mới (nếu gửi lên).
`,
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'RentalProduct UUID',
    example: '11111111-1111-4111-8111-111111111111',
  })
  @ApiResponse({
    status: 200,
    description: 'Sản phẩm thuê được cập nhật thành công',
    schema: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, version: { type: 'integer' } } },
  })
  @ApiErrorResponse(409, 'Xung đột phiên bản', 'VERSION_CONFLICT', 'Sản phẩm đã thay đổi; lấy version mới rồi thử lại')
  @ApiBody({
    description:
      'Gửi expectedVersion hiện tại và ít nhất một trường cần đổi; imageMediaIds nếu gửi sẽ thay toàn bộ danh sách ảnh.',
    schema: {
      type: 'object',
      required: ['expectedVersion'],
      properties: {
        expectedVersion: { type: 'integer', minimum: 1, example: 1 },
        name: { type: 'string', example: 'Lều cắm trại 4 người (Updated)' },
        description: { type: 'string', example: 'Đã cập nhật mô tả' },
        dailyPrice: { type: 'number', example: 180000 },
        replacementValue: { type: 'number', example: 2200000 },
        depositPolicy: {
          type: 'object',
          properties: {
            type: { type: 'string', example: 'FIXED' },
            amount: { type: 'number', example: 1000000 },
            percentage: { type: 'number', example: 0 },
          },
        },
        imageMediaIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
          description: 'ID media đã tải lên; bỏ qua nếu không đổi ảnh',
        },
        spec: { type: 'object', example: { weight: '2.5kg' } },
        recommendationTags: { type: 'array', items: { type: 'string' }, example: ['sale'] },
        requiresDeepInspectionAfterReturn: {
          type: 'boolean',
          example: true,
          description: 'Cập nhật cờ kiểm tra sâu sau khi khách hoàn trả thiết bị',
        },
      },
      example: { expectedVersion: 1, name: 'Lều cắm trại 4 người bản mới', dailyPrice: 180000 },
    },
  })
  @Patch(':id')
  async updateProduct(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateRentalProductSchema)) body: UpdateRentalProductDto,
  ) {
    return this.updateRentalProductUseCase.execute({
      id,
      ...body,
    })
  }
}
