import { Inject, Injectable } from '@nestjs/common'
import {
  EQUIPMENT_UNIT_PORT,
  type EquipmentUnitPort,
  type PaginatedEquipmentUnitResult,
} from '../ports/equipment-unit.port'
import { type EquipmentUnitStatusValue, type EquipmentConditionValue } from '../ports/equipment-unit.port'

export interface ListEquipmentUnitsInput {
  page: number
  pageSize: number
  productId?: string
  status?: EquipmentUnitStatusValue
  condition?: EquipmentConditionValue
  inventoryLocationId?: string
  q?: string
}

@Injectable()
export class ListEquipmentUnitsUseCase {
  constructor(
    @Inject(EQUIPMENT_UNIT_PORT)
    private readonly equipmentUnitPort: EquipmentUnitPort,
  ) {}

  async execute(input: ListEquipmentUnitsInput): Promise<PaginatedEquipmentUnitResult> {
    const { items, total, counts } = await this.equipmentUnitPort.listUnits(input)
    const totalPages = Math.ceil(total / input.pageSize)

    return {
      items,
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        totalItems: total,
        totalPages,
      },
      counts,
    }
  }
}
