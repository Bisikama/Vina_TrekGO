import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Lấy danh sách các danh mục thuê đồ' })
  @ApiResponse({ status: 200, description: 'Danh sách các danh mục đang hoạt động kèm phân trang' })
  @Get()
  async listCategories(@Query(new ZodValidationPipe(ListRentalCategoriesSchema)) query: ListRentalCategoriesDto) {
    return this.listRentalCategoriesUseCase.execute({ page: query.page, pageSize: query.pageSize });
  }
}
