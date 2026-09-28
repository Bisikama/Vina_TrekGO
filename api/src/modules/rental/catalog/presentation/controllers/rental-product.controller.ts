import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { Auth } from 'src/shared/decorators/auth.decorator';
import { AuthType } from 'src/shared/constants/auth.constant';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import { ActiveUser } from 'src/shared/decorators/active-user.decorator';
import type { ActiveUserData } from 'src/shared/types/user.type';
import { ListRentalProductsUseCase } from '../../application/use-cases/list-rental-products.use-case';
import { GetRentalProductUseCase } from '../../application/use-cases/get-rental-product.use-case';
import { ListRentalProductsSchema, type ListRentalProductsDto } from '../dtos/list-rental-products.dto';

@ApiTags('Rental Catalog')
@Controller('rental-products')
export class RentalProductController {
  constructor(
    private readonly listRentalProductsUseCase: ListRentalProductsUseCase,
    private readonly getRentalProductUseCase: GetRentalProductUseCase,
  ) {}

  @Auth([AuthType.None])
  @ApiOperation({ summary: 'Lấy danh sách sản phẩm thuê (public)' })
  @ApiResponse({ status: 200, description: 'Danh sách sản phẩm đang hoạt động kèm phân trang' })
  @ApiQuery({ name: 'search', required: false, description: 'Tìm kiếm theo tên hoặc SKU' })
  @ApiQuery({ name: 'categoryId', required: false, description: 'Lọc theo ID danh mục' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 20 })
  @Get()
  async listProducts(@Query(new ZodValidationPipe(ListRentalProductsSchema)) query: ListRentalProductsDto) {
    return this.listRentalProductsUseCase.execute(query);
  }

  @Auth([AuthType.None])
  @ApiOperation({ summary: 'Lấy thông tin chi tiết sản phẩm thuê (public)' })
  @ApiResponse({ status: 200, description: 'Thông tin sản phẩm' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hoặc sản phẩm không ở trạng thái ACTIVE' })
  @Get(':id')
  async getProduct(@Param('id') id: string, @ActiveUser() user?: ActiveUserData) {
    return this.getRentalProductUseCase.execute(id, user?.role);
  }
}
