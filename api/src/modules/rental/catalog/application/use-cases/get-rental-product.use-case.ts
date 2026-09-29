import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_PRODUCT_PORT } from '../ports/rental-product.port';
import type { RentalProductPort, RentalProductView } from '../ports/rental-product.port';
import { AppError, RENTAL_ERROR_CODES } from '../../../../../shared/errors';
import { UserRole } from '../../../../../shared/constants/enum.constant';

@Injectable()
export class GetRentalProductUseCase {
  constructor(
    @Inject(RENTAL_PRODUCT_PORT)
    private readonly rentalProductPort: RentalProductPort,
  ) {}

  async execute(id: string, viewerRole?: string): Promise<RentalProductView> {
    const product = await this.rentalProductPort.getProductById(id);
    if (!product) {
      throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_PRODUCT_NOT_FOUND, { details: { id } });
    }

    const canViewInactive = viewerRole === UserRole.STAFF_INVENTORY || viewerRole === UserRole.ADMIN;
    if (product.status !== 'ACTIVE' && !canViewInactive) {
      throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_PRODUCT_NOT_FOUND, { details: { id } });
    }

    return product;
  }
}
