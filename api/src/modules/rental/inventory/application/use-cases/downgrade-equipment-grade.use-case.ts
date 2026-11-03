import { Inject, Injectable } from '@nestjs/common'
import {
  EQUIPMENT_UNIT_PORT,
  type DowngradeUnitGradePayload,
  type EquipmentUnitPort,
} from '../ports/equipment-unit.port'

/**
 * Hạ hạng (LIKE_NEW → GOOD_USED) cho một món đang AVAILABLE trong kho.
 * Mọi điều kiện được kiểm trong adapter sau khi khoá unit, để tránh đua với preparation.
 */
@Injectable()
export class DowngradeEquipmentGradeUseCase {
  constructor(
    @Inject(EQUIPMENT_UNIT_PORT)
    private readonly equipmentUnitPort: EquipmentUnitPort,
  ) {}

  execute(input: DowngradeUnitGradePayload) {
    return this.equipmentUnitPort.downgradeGrade(input)
  }
}
