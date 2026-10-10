import { Inject, Injectable } from '@nestjs/common'
import { INVENTORY_LOCATION_PORT, type InventoryLocationPort } from '../ports/inventory-location.port'
import { AppError, RENTAL_ERROR_CODES } from '../../../../../shared/errors'
import type { UpdateInventoryLocationDto } from '../../presentation/dtos/update-inventory-location.dto'

@Injectable()
export class UpdateInventoryLocationUseCase {
  constructor(
    @Inject(INVENTORY_LOCATION_PORT)
    private readonly inventoryLocationPort: InventoryLocationPort,
  ) {}

  async execute(id: string, input: UpdateInventoryLocationDto) {
    const existing = await this.inventoryLocationPort.getLocationById(id)
    if (!existing) {
      throw AppError.fromCode(RENTAL_ERROR_CODES.INVENTORY_LOCATION_NOT_FOUND, { details: { id } })
    }

    return this.inventoryLocationPort.updateLocation(id, {
      name: input.name,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
      status: input.status,
    })
  }
}
