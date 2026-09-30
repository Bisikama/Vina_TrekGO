import { Inject, Injectable } from '@nestjs/common'
import {
  INVENTORY_LOCATION_PORT,
  type InventoryLocationPort,
  type InventoryLocationView,
} from '../ports/inventory-location.port'
import { AppError, RENTAL_ERROR_CODES } from '../../../../../shared/errors'

@Injectable()
export class GetInventoryLocationUseCase {
  constructor(
    @Inject(INVENTORY_LOCATION_PORT)
    private readonly inventoryLocationPort: InventoryLocationPort,
  ) {}

  async execute(id: string): Promise<InventoryLocationView> {
    const location = await this.inventoryLocationPort.getLocationById(id)
    if (!location) {
      throw AppError.fromCode(RENTAL_ERROR_CODES.INVENTORY_LOCATION_NOT_FOUND, { details: { id } })
    }
    return location
  }
}
