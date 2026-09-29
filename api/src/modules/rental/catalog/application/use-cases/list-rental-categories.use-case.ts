import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_CATEGORY_PORT } from '../ports/rental-category.port';
import type {
  RentalCategoryPort,
  PaginatedResult,
  RentalCategoryView,
} from '../ports/rental-category.port';

@Injectable()
export class ListRentalCategoriesUseCase {
  constructor(
    @Inject(RENTAL_CATEGORY_PORT)
    private readonly rentalCategoryPort: RentalCategoryPort,
  ) {}

  async execute(params: { page: number; pageSize: number }): Promise<PaginatedResult<RentalCategoryView>> {
    const { page, pageSize } = params;
    const { items, total } = await this.rentalCategoryPort.listActiveCategories({ page, pageSize });

    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

    return {
      items,
      pagination: {
        page,
        pageSize,
        totalItems: total,
        totalPages,
      },
    };
  }
}
