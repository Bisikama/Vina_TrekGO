import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_PRODUCT_PORT } from '../ports/rental-product.port';
import type { RentalProductPort, RentalProductView, UpdateRentalProductParams } from '../ports/rental-product.port';
import { AppError, RENTAL_ERROR_CODES } from '../../../../../shared/errors';

@Injectable()
export class UpdateRentalProductUseCase {
  constructor(
    @Inject(RENTAL_PRODUCT_PORT)
    private readonly rentalProductPort: RentalProductPort,
  ) {}

  async execute(params: UpdateRentalProductParams): Promise<RentalProductView> {
    if (params.dailyPrice !== undefined && params.dailyPrice < 0) {
      throw AppError.fromCode(RENTAL_ERROR_CODES.INVALID_DAILY_PRICE);
    }
    if (params.replacementValue !== undefined && params.replacementValue < 0) {
      throw AppError.fromCode(RENTAL_ERROR_CODES.INVALID_REPLACEMENT_VALUE);
    }
    if (params.depositPolicy !== undefined) {
      if (params.depositPolicy.type === 'FIXED' && (params.depositPolicy.amount === undefined || params.depositPolicy.amount < 0)) {
        throw AppError.fromCode(RENTAL_ERROR_CODES.INVALID_DEPOSIT_POLICY);
      }
      if (params.depositPolicy.type === 'PERCENT_REPLACEMENT_VALUE' && (params.depositPolicy.percentage === undefined || params.depositPolicy.percentage < 0 || params.depositPolicy.percentage > 100)) {
        throw AppError.fromCode(RENTAL_ERROR_CODES.INVALID_DEPOSIT_POLICY);
      }
    }

    return this.rentalProductPort.updateProduct(params);
  }
}
