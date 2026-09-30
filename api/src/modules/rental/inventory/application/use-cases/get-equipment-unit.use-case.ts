import { Inject, Injectable } from '@nestjs/common'
import { EQUIPMENT_UNIT_PORT, type EquipmentUnitPort } from '../ports/equipment-unit.port'
import { AppError, RENTAL_ERROR_CODES } from '../../../../../shared/errors'

@Injectable()
export class GetEquipmentUnitUseCase {
  constructor(
    @Inject(EQUIPMENT_UNIT_PORT)
    private readonly equipmentUnitPort: EquipmentUnitPort,
  ) {}

  async execute(id: string) {
    const unit = await this.equipmentUnitPort.getUnitById(id)
    if (!unit) {
      throw AppError.fromCode(RENTAL_ERROR_CODES.EQUIPMENT_UNIT_NOT_FOUND, { details: { id } })
    }

    const history = await this.equipmentUnitPort.getHistory(id)

    return {
      unit,
      history,
    }
  }
}
