import { Inject, Injectable } from '@nestjs/common'
import { AppError, RENTAL_ERROR_CODES } from '../../../../../shared/errors'
import { EQUIPMENT_UNIT_PORT, type EquipmentUnitPort } from '../ports/equipment-unit.port'
export interface GenerateEquipmentLabelsInput {
  unitIds: string[]
}

@Injectable()
export class GenerateEquipmentLabelsUseCase {
  constructor(
    @Inject(EQUIPMENT_UNIT_PORT)
    private readonly equipmentUnitPort: EquipmentUnitPort,
  ) {}

  async execute(input: GenerateEquipmentLabelsInput) {
    const uniqueIds = Array.from(new Set(input.unitIds))

    const units = await this.equipmentUnitPort.getUnitsByIds(uniqueIds)
    if (units.length !== uniqueIds.length) {
      // Từ chối toàn bộ yêu cầu nếu có thiết bị không tồn tại
      throw AppError.fromCode(RENTAL_ERROR_CODES.EQUIPMENT_UNIT_NOT_FOUND, {
        details: { message: 'One or more requested units were not found.' },
      })
    }

    const unitMap = new Map(units.map((u) => [u.id, u]))

    const labels = uniqueIds.map((id) => {
      const unit = unitMap.get(id)!
      return {
        unitId: unit.id,
        assetCode: unit.assetCode,
        qrPayload: unit.qrCode || `TG-EU:${unit.assetCode}`,
        printText: unit.assetCode,
      }
    })

    return { labels }
  }
}
