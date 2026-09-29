import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_PRODUCT_PORT } from '../ports/rental-product.port';
import type { RentalProductPort, RentalProductView, CreateRentalProductParams } from '../ports/rental-product.port';
import { RENTAL_CATEGORY_PORT } from '../ports/rental-category.port';
import type { RentalCategoryPort } from '../ports/rental-category.port';
import { AppError, RENTAL_ERROR_CODES } from '../../../../../shared/errors';

@Injectable()
export class CreateRentalProductUseCase {
  constructor(
    @Inject(RENTAL_PRODUCT_PORT)
    private readonly rentalProductPort: RentalProductPort,
    @Inject(RENTAL_CATEGORY_PORT)
    private readonly rentalCategoryPort: RentalCategoryPort,
  ) {}

  async execute(params: CreateRentalProductParams): Promise<RentalProductView> {
    if (params.dailyPrice < 0) {
      throw AppError.fromCode(RENTAL_ERROR_CODES.INVALID_DAILY_PRICE);
    }
    if (params.replacementValue < 0) {
      throw AppError.fromCode(RENTAL_ERROR_CODES.INVALID_REPLACEMENT_VALUE);
    }
    if (params.depositPolicy.type === 'FIXED' && (params.depositPolicy.amount === undefined || params.depositPolicy.amount < 0)) {
      throw AppError.fromCode(RENTAL_ERROR_CODES.INVALID_DEPOSIT_POLICY);
    }
    if (params.depositPolicy.type === 'PERCENT_REPLACEMENT_VALUE' && (params.depositPolicy.percentage === undefined || params.depositPolicy.percentage < 0 || params.depositPolicy.percentage > 100)) {
      throw AppError.fromCode(RENTAL_ERROR_CODES.INVALID_DEPOSIT_POLICY);
    }

    const category = await this.rentalCategoryPort.getCategoryById(params.categoryId);
    if (!category) {
      throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_CATEGORY_NOT_FOUND, { details: { categoryId: params.categoryId } });
    }
    if (category.status !== 'ACTIVE') {
      throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_CATEGORY_INACTIVE, { details: { categoryId: params.categoryId } });
    }

    return this.rentalProductPort.createProduct(params);
  }
}
