import { Inject, Injectable } from '@nestjs/common'
import { INVENTORY_LOCATION_PORT, type InventoryLocationPort } from '../ports/inventory-location.port'
import { AppError, COMMON_ERROR_CODES } from '../../../../../shared/errors'
import type { CreateInventoryLocationDto } from '../../presentation/dtos/create-inventory-location.dto'

@Injectable()
export class CreateInventoryLocationUseCase {
  constructor(
    @Inject(INVENTORY_LOCATION_PORT)
    private readonly inventoryLocationPort: InventoryLocationPort,
  ) {}

  async execute(input: CreateInventoryLocationDto) {
    const existing = await this.inventoryLocationPort.getLocationByCode(input.code)
    if (existing) {
      throw AppError.fromCode(COMMON_ERROR_CODES.VALIDATION_ERROR, {
        message: 'Mã kho đã tồn tại trong hệ thống',
        details: { code: input.code },
      })
    }

    return this.inventoryLocationPort.createLocation({
      code: input.code,
      name: input.name,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
    })
  }
}
