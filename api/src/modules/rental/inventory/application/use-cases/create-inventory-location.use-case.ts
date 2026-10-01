import { Inject, Injectable } from '@nestjs/common'
import {
  INVENTORY_LOCATION_PORT,
  type InventoryLocationPort,
  type InventoryLocationView,
  type CreateInventoryLocationInput,
} from '../ports/inventory-location.port'
import { AppError, RENTAL_ERROR_CODES } from '../../../../../shared/errors'

@Injectable()
export class CreateInventoryLocationUseCase {
  constructor(
    @Inject(INVENTORY_LOCATION_PORT)
    private readonly inventoryLocationPort: InventoryLocationPort,
  ) {}

  async execute(input: CreateInventoryLocationInput): Promise<InventoryLocationView> {
    const existingCode = await this.inventoryLocationPort.getLocationByCode(input.code)
    if (existingCode) {
      throw AppError.fromCode(RENTAL_ERROR_CODES.INVENTORY_LOCATION_CODE_EXISTS, { details: { code: input.code } })
    }

    return this.inventoryLocationPort.createLocation(input)
  }
}
