import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiQuery, ApiParam } from '@nestjs/swagger';
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
- **Dùng để test với Gear Advisor & Rental Quotes:** Lấy id sản phẩm làm productId cho POST /api/v1/rentals/quote và cấu hình thông số kỹ thuật tại PUT /api/v1/staff/gear/product-profiles/{productId}.
`
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Danh sách sản phẩm đang hoạt động kèm phân trang',
    schema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object' } },
        pagination: { type: 'object', properties: { page: { type: 'number' }, pageSize: { type: 'number' }, totalItems: { type: 'number' }, totalPages: { type: 'number' } } },
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

  @Auth([AuthType.Optional])
  @ApiBearerAuth('bearer')
  @ApiOperation({ 
    summary: 'Lấy thông tin chi tiết sản phẩm thuê (public)',
    description: `
Chi tiết thông tin sản phẩm dành cho khách hàng.
- Chỉ trả về sản phẩm nếu nó đang ở trạng thái ACTIVE.
- Endpoint công khai này chỉ hiển thị sản phẩm ACTIVE; nhân viên dùng danh sách sản phẩm tại /api/v1/staff/rental-products để xem các trạng thái khác.
`
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'RentalProduct UUID', example: '11111111-1111-4111-8111-111111111111' })
  @ApiResponse({ status: 200, description: 'Thông tin chi tiết sản phẩm', schema: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, sku: { type: 'string' }, name: { type: 'string' }, depositPerUnit: { type: 'integer', nullable: true, example: 400000, description: 'Cọc mỗi món theo giá catalog; null nếu dữ liệu không hợp lệ.' }, replacementValue: { type: 'number', example: 2000000 }, depositExplanation: { type: 'object', properties: { percentageOfReplacementValue: { type: 'number', nullable: true, example: 20, description: 'Tỷ lệ cọc thực tế, làm tròn 2 chữ số; null nếu không tính được.' }, formula: { type: 'string', example: 'depositPerUnit / replacementValue * 100' } } } } } })
  @ApiErrorResponse(404, 'Không tìm thấy sản phẩm', 'RENTAL_PRODUCT_NOT_FOUND', 'Sản phẩm không tồn tại hoặc không hoạt động')
  @Get(':id')
  async getProduct(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @ActiveUser() user?: ActiveUserData,
  ) {
    return this.getRentalProductUseCase.execute(id, user?.role);
  }
}
