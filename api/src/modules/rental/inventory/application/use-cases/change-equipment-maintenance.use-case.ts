import { Inject, Injectable } from '@nestjs/common'
import { AppError, RENTAL_ERROR_CODES } from '../../../../../shared/errors'
import { EQUIPMENT_UNIT_PORT, type EquipmentUnitPort, type EquipmentConditionValue } from '../ports/equipment-unit.port'

export type ChangeEquipmentMaintenanceInput =
  | { action: 'START'; reason: string; notes?: string; expectedVersion: number; staffId: string }
  | { action: 'COMPLETE'; resultingCondition: EquipmentConditionValue; expectedVersion: number }

@Injectable()
export class ChangeEquipmentMaintenanceUseCase {
  constructor(
    @Inject(EQUIPMENT_UNIT_PORT)
    private readonly equipmentUnitPort: EquipmentUnitPort,
  ) {}

  async execute(id: string, input: ChangeEquipmentMaintenanceInput) {
    const unit = await this.equipmentUnitPort.getUnitById(id)
    if (!unit) {
      throw AppError.fromCode(RENTAL_ERROR_CODES.EQUIPMENT_UNIT_NOT_FOUND, { details: { id } })
    }

    if (input.action === 'START') {
      if (unit.status === 'RENTED') {
        throw AppError.fromCode(RENTAL_ERROR_CODES.EQUIPMENT_UNIT_RENTED)
      }

      const allowedStatuses = ['AVAILABLE', 'CLEANING', 'DAMAGED']
      if (!allowedStatuses.includes(unit.status)) {
        throw AppError.fromCode(RENTAL_ERROR_CODES.EQUIPMENT_UNIT_NOT_MAINTAINABLE, {
          details: { message: `Cannot start maintenance from status ${unit.status}` },
        })
      }

      if (!unit.currentInventoryLocation) {
        throw AppError.fromCode(RENTAL_ERROR_CODES.EQUIPMENT_UNIT_NOT_MAINTAINABLE, {
          details: { message: `Cannot start maintenance because the unit lacks a current physical location.` },
        })
      }

      const result = await this.equipmentUnitPort.startMaintenance({
        unitId: id,
        expectedVersion: input.expectedVersion,
        inventoryLocationId: unit.currentInventoryLocation.id,
        staffId: input.staffId,
        reason: input.reason,
        notes: input.notes,
      })

      return {
        unit: result.unit,
        maintenance: result.maintenance,
        affectedOrders: [],
        affectedOrdersEvaluated: false,
      }
    } else {
      if (unit.status !== 'MAINTENANCE') {
        throw AppError.fromCode(RENTAL_ERROR_CODES.INVALID_EQUIPMENT_STATE_TRANSITION, {
          details: {
            message: `Cannot complete maintenance because unit status is ${unit.status}, expected MAINTENANCE.`,
          },
        })
      }

      const result = await this.equipmentUnitPort.completeMaintenance({
        unitId: id,
        expectedVersion: input.expectedVersion,
        resultingCondition: input.resultingCondition,
      })

      return {
        unit: result.unit,
        maintenance: result.maintenance,
        affectedOrders: [],
        affectedOrdersEvaluated: false,
      }
    }
  }
}
