import { Inject, Injectable } from '@nestjs/common'
import { AppError, RENTAL_ERROR_CODES } from '../../../../../shared/errors'
import {
  EQUIPMENT_UNIT_PORT,
  type EquipmentUnitPort,
  type BatchCreateEquipmentUnitItem,
  type EquipmentConditionValue,
} from '../ports/equipment-unit.port'
import { RENTAL_PRODUCT_PORT, type RentalProductPort } from '../../../catalog/application/ports/rental-product.port'
import { INVENTORY_LOCATION_PORT, type InventoryLocationPort } from '../ports/inventory-location.port'
export interface BatchCreateEquipmentUnitsInput {
  productId: string
  homeInventoryLocationId: string
  quantity: number
  assetCodeMode: 'AUTO' | 'PROVIDED'
  assetCodes?: string[]
  condition?: EquipmentConditionValue
  acquiredAt?: string
}
import { randomBytes } from 'crypto'

@Injectable()
export class BatchCreateEquipmentUnitsUseCase {
  constructor(
    @Inject(EQUIPMENT_UNIT_PORT)
    private readonly equipmentUnitPort: EquipmentUnitPort,
    @Inject(RENTAL_PRODUCT_PORT)
    private readonly rentalProductPort: RentalProductPort,
    @Inject(INVENTORY_LOCATION_PORT)
    private readonly inventoryLocationPort: InventoryLocationPort,
  ) {}

  async execute(input: BatchCreateEquipmentUnitsInput) {
    // Kiểm tra tính hợp lệ của Product
    const product = await this.rentalProductPort.getProductById(input.productId)
    if (!product) {
      throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_PRODUCT_NOT_FOUND, { details: { productId: input.productId } })
    }
    if (product.status === 'ARCHIVED') {
      throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_PRODUCT_ARCHIVED, {
        details: { message: 'Product is archived. Cannot batch create physical units for archived catalog items.' },
      })
    }

    if (input.quantity <= 0) {
      throw AppError.fromCode(RENTAL_ERROR_CODES.BATCH_QUANTITY_INVALID)
    }

    // Kiểm tra tính hợp lệ của Inventory Location
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

    const resolvedCondition = input.condition ?? 'GOOD'
    if (resolvedCondition === 'DAMAGED' || resolvedCondition === 'LOST') {
      throw AppError.fromCode(RENTAL_ERROR_CODES.INVALID_EQUIPMENT_CONDITION, {
        details: {
          message: `Cannot batch create units with condition ${resolvedCondition} while starting as AVAILABLE.`,
        },
      })
    }

    if (input.assetCodeMode === 'PROVIDED') {
      if (!input.assetCodes || input.assetCodes.length !== input.quantity) {
        throw AppError.fromCode(RENTAL_ERROR_CODES.BATCH_ASSET_CODE_COUNT_MISMATCH)
      }
      const uniqueCodes = new Set(input.assetCodes)
      if (uniqueCodes.size !== input.assetCodes.length) {
        throw AppError.fromCode(RENTAL_ERROR_CODES.BATCH_ASSET_CODE_DUPLICATE)
      }
    }

    let attempts = 0
    const maxAttempts = input.assetCodeMode === 'AUTO' ? 3 : 1

    while (attempts < maxAttempts) {
      attempts++

      const payloads: BatchCreateEquipmentUnitItem[] = []
      const generatedCodes = new Set<string>()

      for (let i = 0; i < input.quantity; i++) {
        let assetCode = ''
        if (input.assetCodeMode === 'PROVIDED' && input.assetCodes) {
          assetCode = input.assetCodes[i]
        } else {
          let safe = false
          let genAttempts = 0
          while (!safe && genAttempts < 10) {
            assetCode = `${product.sku}-${randomBytes(3).toString('hex').toUpperCase()}`
            if (!generatedCodes.has(assetCode)) {
              generatedCodes.add(assetCode)
              safe = true
            }
            genAttempts++
          }
          if (!safe) {
            throw AppError.fromCode(RENTAL_ERROR_CODES.EQUIPMENT_ASSET_CODE_EXISTS, {
              details: { message: 'Failed to generate unique asset codes in memory' },
            })
          }
        }

        payloads.push({
          productId: input.productId,
          homeInventoryLocationId: input.homeInventoryLocationId,
          currentInventoryLocationId: input.homeInventoryLocationId,
          assetCode,
          qrCode: `TG-EU:${assetCode}`,
          status: 'AVAILABLE',
          condition: resolvedCondition,
          acquiredAt: input.acquiredAt,
        })
      }

      try {
        const createdUnits = await this.equipmentUnitPort.createBatch(payloads)
        return { createdUnits }
      } catch (error: unknown) {
        if (
          error instanceof AppError &&
          (error.code === RENTAL_ERROR_CODES.EQUIPMENT_ASSET_CODE_EXISTS ||
            error.code === RENTAL_ERROR_CODES.EQUIPMENT_QR_CODE_EXISTS)
        ) {
          if (attempts >= maxAttempts) {
            throw error
          }
        } else {
          throw error
        }
      }
    }

    // Không thể đạt đến nhánh này
    throw AppError.fromCode(RENTAL_ERROR_CODES.EQUIPMENT_ASSET_CODE_EXISTS)
  }
}
