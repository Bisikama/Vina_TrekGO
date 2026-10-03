import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiQuery, ApiParam } from '@nestjs/swagger';
import { Auth } from 'src/shared/decorators/auth.decorator';
import { AuthType } from 'src/shared/constants/auth.constant';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import { ActiveUser } from 'src/shared/decorators/active-user.decorator';
import type { ActiveUserData } from 'src/shared/types/user.type';
import { ListRentalProductsUseCase } from '../../application/use-cases/list-rental-products.use-case';
import { GetRentalProductUseCase } from '../../application/use-cases/get-rental-product.use-case';
import { ListRentalProductsSchema, type ListRentalProductsDto } from '../dtos/list-rental-products.dto';
import { ApiErrorResponse } from 'src/shared/swagger/api-error-response.helper';

@ApiTags('Rental Catalog')
@Controller('rental-products')
export class RentalProductController {
  constructor(
    private readonly listRentalProductsUseCase: ListRentalProductsUseCase,
    private readonly getRentalProductUseCase: GetRentalProductUseCase,
  ) {}

  @Auth([AuthType.None])
  @ApiOperation({ 
    summary: 'Lấy danh sách sản phẩm thuê (public)',
    description: `
Lấy danh sách sản phẩm hiển thị cho người dùng cuối.
- Chỉ hiển thị sản phẩm đang ACTIVE và danh mục (category) cũng phải đang ACTIVE.
- Hỗ trợ tìm kiếm cơ bản và lọc theo category.
`
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Danh sách sản phẩm đang hoạt động kèm phân trang',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { type: 'object' } },
            pagination: { type: 'object', properties: { page: { type: 'number' }, pageSize: { type: 'number' }, totalItems: { type: 'number' }, totalPages: { type: 'number' } } }
          }
        }
      }
    }
  })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Tìm kiếm theo tên hoặc SKU' })
  @ApiQuery({ name: 'categoryId', required: false, type: String, format: 'uuid', description: 'Lọc theo ID danh mục' })
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1, default: 1, example: 1, description: 'Trang hiện tại' })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, minimum: 1, maximum: 100, default: 20, example: 20, description: 'Số lượng item trên mỗi trang' })
  @Get()
  async listProducts(@Query(new ZodValidationPipe(ListRentalProductsSchema)) query: ListRentalProductsDto) {
    return this.listRentalProductsUseCase.execute(query);
  }

  @Auth([AuthType.None])
  @ApiOperation({ 
    summary: 'Lấy thông tin chi tiết sản phẩm thuê (public)',
    description: `
Chi tiết thông tin sản phẩm dành cho khách hàng.
- Chỉ trả về sản phẩm nếu nó đang ở trạng thái ACTIVE.
- Staff được phép xem cả sản phẩm đang INACTIVE hoặc ARCHIVED.
`
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'RentalProduct UUID', example: '11111111-1111-4111-8111-111111111111' })
  @ApiResponse({ status: 200, description: 'Thông tin chi tiết sản phẩm', schema: { type: 'object', properties: { data: { type: 'object' } } } })
  @ApiErrorResponse(404, 'Not Found', 'RENTAL_PRODUCT_NOT_FOUND', 'Product not found or not active')
  @Get(':id')
  async getProduct(@Param('id') id: string, @ActiveUser() user?: ActiveUserData) {
    return this.getRentalProductUseCase.execute(id, user?.role);
  }
}
