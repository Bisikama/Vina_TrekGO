import { Inject, Injectable } from '@nestjs/common'
import { AppError, RENTAL_ERROR_CODES, COMMON_ERROR_CODES } from '../../../../../shared/errors'
import { EQUIPMENT_UNIT_PORT, type EquipmentUnitPort } from '../ports/equipment-unit.port'
import { INVENTORY_LOCATION_PORT, type InventoryLocationPort } from '../ports/inventory-location.port'
export interface UpdateEquipmentUnitInput {
  expectedVersion: number
  homeInventoryLocationId?: string
  serialNumber?: string | null
  acquiredAt?: string | null
}

@Injectable()
export class UpdateEquipmentUnitUseCase {
  constructor(
    @Inject(EQUIPMENT_UNIT_PORT)
    private readonly equipmentUnitPort: EquipmentUnitPort,
    @Inject(INVENTORY_LOCATION_PORT)
    private readonly inventoryLocationPort: InventoryLocationPort,
  ) {}

  async execute(id: string, input: UpdateEquipmentUnitInput) {
    if (
      input.homeInventoryLocationId === undefined &&
      input.serialNumber === undefined &&
      input.acquiredAt === undefined
    ) {
      throw AppError.fromCode(COMMON_ERROR_CODES.VALIDATION_ERROR, {
        details: { message: 'No editable fields provided' },
      })
    }

    if (input.homeInventoryLocationId) {
      const location = await this.inventoryLocationPort.getLocationById(input.homeInventoryLocationId)
      if (!location) {
        throw AppError.fromCode(RENTAL_ERROR_CODES.INVENTORY_LOCATION_NOT_FOUND, {
          details: { locationId: input.homeInventoryLocationId },
        })
      }
      if (location.status !== 'ACTIVE') {
        throw AppError.fromCode(RENTAL_ERROR_CODES.INVENTORY_LOCATION_INACTIVE, {
          details: { locationId: input.homeInventoryLocationId },
        })
      }
    }

    return await this.equipmentUnitPort.updateMetadata({
      id,
      expectedVersion: input.expectedVersion,
      homeInventoryLocationId: input.homeInventoryLocationId,
      serialNumber: input.serialNumber,
      acquiredAt: input.acquiredAt,
    })
  }
}
