import { Inject, Injectable } from '@nestjs/common'
import {
  INVENTORY_LOCATION_PORT,
  type InventoryLocationPort,
  type InventoryLocationView,
  type UpdateInventoryLocationInput,
} from '../ports/inventory-location.port'
import { AppError, RENTAL_ERROR_CODES } from '../../../../../shared/errors'

export interface UpdateLocationUseCaseInput extends UpdateInventoryLocationInput {
  id: string
}

@Injectable()
export class UpdateInventoryLocationUseCase {
  constructor(
    @Inject(INVENTORY_LOCATION_PORT)
    private readonly inventoryLocationPort: InventoryLocationPort,
  ) {}

  async execute(input: UpdateLocationUseCaseInput): Promise<InventoryLocationView> {
    const { id, ...data } = input

    const location = await this.inventoryLocationPort.getLocationById(id)
    if (!location) {
      throw AppError.fromCode(RENTAL_ERROR_CODES.INVENTORY_LOCATION_NOT_FOUND, { details: { id } })
    }

    if (data.code && data.code !== location.code) {
      const existingCode = await this.inventoryLocationPort.getLocationByCode(data.code)
      if (existingCode) {
        throw AppError.fromCode(RENTAL_ERROR_CODES.INVENTORY_LOCATION_CODE_EXISTS, { details: { code: data.code } })
      }
    }

    return this.inventoryLocationPort.updateLocation(id, data)
  }
}
