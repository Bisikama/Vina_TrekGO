import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { Auth } from 'src/shared/decorators/auth.decorator';
import { AuthType } from 'src/shared/constants/auth.constant';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import { ListRentalCategoriesUseCase } from '../../application/use-cases/list-rental-categories.use-case';
import { ListRentalCategoriesSchema } from '../dtos/list-rental-categories.dto';
import type { ListRentalCategoriesDto } from '../dtos/list-rental-categories.dto';

@ApiTags('Rental Catalog')
@Controller('rental-categories')
export class RentalCategoryController {
  constructor(private readonly listRentalCategoriesUseCase: ListRentalCategoriesUseCase) {}

  @Auth([AuthType.None])
  @ApiOperation({ 
    summary: 'Lấy danh sách các danh mục thuê đồ (public)',
    description: `
Lấy danh sách các danh mục sản phẩm đang hoạt động.
- Trả về thông tin cơ bản để hiển thị menu hoặc bộ lọc.
- Hỗ trợ phân trang cơ bản.
`
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Danh sách các danh mục đang hoạt động kèm phân trang',
    schema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object' } },
        pagination: { type: 'object', properties: { page: { type: 'number' }, pageSize: { type: 'number' }, totalItems: { type: 'number' }, totalPages: { type: 'number' } } },
      },
    }
  })
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1, default: 1, example: 1, description: 'Trang hiện tại' })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, minimum: 1, maximum: 100, default: 20, example: 20, description: 'Số lượng item trên mỗi trang' })
  @Get()
  async listCategories(@Query(new ZodValidationPipe(ListRentalCategoriesSchema)) query: ListRentalCategoriesDto) {
    return this.listRentalCategoriesUseCase.execute({ page: query.page, pageSize: query.pageSize });
  }
}
