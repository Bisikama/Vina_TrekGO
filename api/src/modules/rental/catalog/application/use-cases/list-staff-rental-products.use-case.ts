import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_PRODUCT_PORT } from '../ports/rental-product.port';
import type { RentalProductPort, PaginatedResult, RentalProductView } from '../ports/rental-product.port';

@Injectable()
export class ListStaffRentalProductsUseCase {
  constructor(
    @Inject(RENTAL_PRODUCT_PORT)
    private readonly rentalProductPort: RentalProductPort,
  ) {}

  async execute(params: { page: number; pageSize: number; status?: string }): Promise<PaginatedResult<RentalProductView>> {
    const { page, pageSize, status } = params;
    const { items, total } = await this.rentalProductPort.listStaffProducts({ page, pageSize, status });

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
