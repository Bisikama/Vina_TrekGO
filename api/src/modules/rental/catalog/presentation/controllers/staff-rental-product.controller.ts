import { Controller, Get, Param, Patch, Body, Query, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiBody, ApiQuery } from '@nestjs/swagger';
import { Auth } from 'src/shared/decorators/auth.decorator';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { AuthType } from 'src/shared/constants/auth.constant';
import { UserRole } from 'src/shared/constants/enum.constant';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import { ListStaffRentalProductsUseCase } from '../../application/use-cases/list-staff-rental-products.use-case';
import { ChangeRentalProductStatusUseCase } from '../../application/use-cases/change-rental-product-status.use-case';
import { CreateRentalProductUseCase } from '../../application/use-cases/create-rental-product.use-case';
import { UpdateRentalProductUseCase } from '../../application/use-cases/update-rental-product.use-case';
import { ListStaffRentalProductsSchema, type ListStaffRentalProductsDto } from '../dtos/list-staff-rental-products.dto';
import { ChangeRentalProductStatusSchema, type ChangeRentalProductStatusDto } from '../dtos/change-rental-product-status.dto';
import { CreateRentalProductSchema, type CreateRentalProductDto } from '../dtos/create-rental-product.dto';
import { UpdateRentalProductSchema, type UpdateRentalProductDto } from '../dtos/update-rental-product.dto';

@ApiTags('Staff Rental Catalog')
@ApiBearerAuth()
@Auth([AuthType.Bearer])
@Roles(UserRole.STAFF_INVENTORY, UserRole.ADMIN)
@Controller('staff/rental-products')
export class StaffRentalProductController {
  constructor(
    private readonly listStaffRentalProductsUseCase: ListStaffRentalProductsUseCase,
    private readonly changeRentalProductStatusUseCase: ChangeRentalProductStatusUseCase,
    private readonly createRentalProductUseCase: CreateRentalProductUseCase,
    private readonly updateRentalProductUseCase: UpdateRentalProductUseCase,
  ) {}

  @ApiOperation({ summary: 'Lấy danh sách sản phẩm thuê (staff)' })
  @ApiResponse({ status: 200, description: 'Danh sách sản phẩm kèm phân trang, hỗ trợ lọc theo trạng thái' })
  @ApiQuery({ name: 'status', required: false, description: 'Lọc theo trạng thái (ACTIVE, INACTIVE, ARCHIVED)', example: 'ACTIVE' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 20 })
  @Get()
  async listProducts(@Query(new ZodValidationPipe(ListStaffRentalProductsSchema)) query: ListStaffRentalProductsDto) {
    return this.listStaffRentalProductsUseCase.execute(query);
  }

  @ApiOperation({ summary: 'Thay đổi trạng thái sản phẩm thuê (staff)' })
  @ApiResponse({ status: 200, description: 'Trạng thái đã được cập nhật' })
  @ApiResponse({ status: 409, description: 'Lỗi phiên bản (VERSION_CONFLICT)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'INACTIVE', description: 'ACTIVE, INACTIVE, ARCHIVED' },
        expectedVersion: { type: 'number', example: 1 }
      }
    }
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
    });
  }

  @ApiOperation({ summary: 'Tạo mới sản phẩm thuê (staff)' })
  @ApiResponse({ status: 201, description: 'Sản phẩm thuê được tạo thành công' })
  @ApiResponse({ status: 409, description: 'SKU đã tồn tại' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        categoryId: { type: 'string', example: 'uuid-of-category' },
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
            percentage: { type: 'number', example: 50 }
          }
        },
        imageMediaIds: { type: 'array', items: { type: 'string' }, example: ['uuid-media-1', 'uuid-media-2'] },
        spec: { type: 'object', example: { weight: '2.5kg', capacity: '4 persons' } },
        recommendationTags: { type: 'array', items: { type: 'string' }, example: ['camping', 'family'] }
      }
    }
  })
  @Post()
  async createProduct(@Body(new ZodValidationPipe(CreateRentalProductSchema)) body: CreateRentalProductDto) {
    return this.createRentalProductUseCase.execute(body);
  }

  @ApiOperation({ summary: 'Cập nhật thông tin sản phẩm thuê (staff)' })
  @ApiResponse({ status: 200, description: 'Sản phẩm thuê được cập nhật thành công' })
  @ApiResponse({ status: 409, description: 'Lỗi phiên bản (VERSION_CONFLICT)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        expectedVersion: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Lều cắm trại 4 người (Updated)' },
        description: { type: 'string', example: 'Đã cập nhật mô tả' },
        dailyPrice: { type: 'number', example: 180000 },
        replacementValue: { type: 'number', example: 2200000 },
        depositPolicy: {
          type: 'object',
          properties: {
            type: { type: 'string', example: 'FIXED' },
            amount: { type: 'number', example: 1000000 },
            percentage: { type: 'number', example: 0 }
          }
        },
        imageMediaIds: { type: 'array', items: { type: 'string' }, example: ['uuid-media-new'] },
        spec: { type: 'object', example: { weight: '2.5kg' } },
        recommendationTags: { type: 'array', items: { type: 'string' }, example: ['sale'] }
      }
    }
  })
  @Patch(':id')
  async updateProduct(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateRentalProductSchema)) body: UpdateRentalProductDto,
  ) {
    return this.updateRentalProductUseCase.execute({
      id,
      ...body,
    });
  }
}
