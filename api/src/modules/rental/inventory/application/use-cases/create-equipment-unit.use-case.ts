import { Inject, Injectable } from '@nestjs/common'
import { AppError, RENTAL_ERROR_CODES } from '../../../../../shared/errors'
import { EQUIPMENT_UNIT_PORT, type EquipmentUnitPort } from '../ports/equipment-unit.port'
import { RENTAL_PRODUCT_PORT, type RentalProductPort } from '../../../catalog/application/ports/rental-product.port'
import { INVENTORY_LOCATION_PORT, type InventoryLocationPort } from '../ports/inventory-location.port'
import { type EquipmentConditionValue } from '../ports/equipment-unit.port'

export interface CreateEquipmentUnitInput {
  productId: string
  homeInventoryLocationId: string
  assetCode?: string
  serialNumber?: string
  condition?: EquipmentConditionValue
  acquiredAt?: string
}
import { randomBytes } from 'crypto'

@Injectable()
export class CreateEquipmentUnitUseCase {
  constructor(
    @Inject(EQUIPMENT_UNIT_PORT)
    private readonly equipmentUnitPort: EquipmentUnitPort,
    @Inject(RENTAL_PRODUCT_PORT)
    private readonly rentalProductPort: RentalProductPort,
    @Inject(INVENTORY_LOCATION_PORT)
    private readonly inventoryLocationPort: InventoryLocationPort,
  ) {}

  async execute(input: CreateEquipmentUnitInput) {
    // Kiểm tra tính hợp lệ của Product
    const product = await this.rentalProductPort.getProductById(input.productId)
    if (!product) {
      throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_PRODUCT_NOT_FOUND, { details: { productId: input.productId } })
    }
    // Từ chối trạng thái ARCHIVED, cho phép trạng thái INACTIVE
    if (product.status === 'ARCHIVED') {
      throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_PRODUCT_ARCHIVED, {
        details: { message: 'Product is archived. Cannot create physical units for archived catalog items.' },
      })
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

    // Ràng buộc trạng thái khởi tạo
    const resolvedCondition = input.condition ?? 'GOOD'
    if (resolvedCondition === 'DAMAGED' || resolvedCondition === 'LOST') {
      throw AppError.fromCode(RENTAL_ERROR_CODES.INVALID_EQUIPMENT_CONDITION, {
        details: {
          message: `Cannot create a new unit with condition ${resolvedCondition} while starting as AVAILABLE.`,
        },
      })
    }

    // Sinh hoặc kiểm tra mã tài sản (Asset Code)
    let assetCode = input.assetCode
    let qrCode = ''
    const isAuto = !assetCode
    let createdUnit
    let attempts = 0
    const maxAttempts = isAuto ? 3 : 1

    while (attempts < maxAttempts) {
      attempts++
      if (isAuto) {
        assetCode = `${product.sku}-${randomBytes(3).toString('hex').toUpperCase()}`
      }
      qrCode = `TG-EU:${assetCode}`

      try {
        createdUnit = await this.equipmentUnitPort.createUnit({
          productId: input.productId,
          homeInventoryLocationId: input.homeInventoryLocationId,
          currentInventoryLocationId: input.homeInventoryLocationId,
          assetCode: assetCode as string,
          qrCode,
          serialNumber: input.serialNumber,
          status: 'AVAILABLE',
          condition: resolvedCondition,
          acquiredAt: input.acquiredAt,
        })
        break // Thành công
      } catch (error: unknown) {
        if (
          error instanceof AppError &&
          (error.code === RENTAL_ERROR_CODES.EQUIPMENT_ASSET_CODE_EXISTS ||
            error.code === RENTAL_ERROR_CODES.EQUIPMENT_QR_CODE_EXISTS)
        ) {
          if (attempts >= maxAttempts) {
            throw error
          }
          // Tự động thử lại
        } else {
          throw error
        }
      }
    }

    return createdUnit
  }
}
