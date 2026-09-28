import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_PRODUCT_PORT } from '../ports/rental-product.port';
import type { RentalProductPort, RentalProductView } from '../ports/rental-product.port';

@Injectable()
export class ChangeRentalProductStatusUseCase {
  constructor(
    @Inject(RENTAL_PRODUCT_PORT)
    private readonly rentalProductPort: RentalProductPort,
  ) {}

  async execute(params: { id: string; status: string; expectedVersion: number }): Promise<RentalProductView> {
    return this.rentalProductPort.changeStatus(params);
  }
}
