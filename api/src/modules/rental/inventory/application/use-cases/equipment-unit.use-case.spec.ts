import { Test, TestingModule } from '@nestjs/testing'
import { CreateEquipmentUnitUseCase } from './create-equipment-unit.use-case'
import { GetEquipmentUnitUseCase } from './get-equipment-unit.use-case'
import { ListEquipmentUnitsUseCase } from './list-equipment-units.use-case'
import { UpdateEquipmentUnitUseCase } from './update-equipment-unit.use-case'
import { BatchCreateEquipmentUnitsUseCase } from './batch-create-equipment-units.use-case'
import { GenerateEquipmentLabelsUseCase } from './generate-equipment-labels.use-case'
import { ChangeEquipmentMaintenanceUseCase } from './change-equipment-maintenance.use-case'

import {
  EQUIPMENT_UNIT_PORT,
  type EquipmentUnitView,
  type ChangeMaintenancePortResult,
} from '../ports/equipment-unit.port'
import { RENTAL_PRODUCT_PORT } from '../../../catalog/application/ports/rental-product.port'
import { INVENTORY_LOCATION_PORT } from '../ports/inventory-location.port'
import { AppError, RENTAL_ERROR_CODES, COMMON_ERROR_CODES } from '../../../../../shared/errors'

describe('Equipment Unit Use Cases', () => {
  let createUseCase: CreateEquipmentUnitUseCase
  let getUseCase: GetEquipmentUnitUseCase
  let listUseCase: ListEquipmentUnitsUseCase
  let updateUseCase: UpdateEquipmentUnitUseCase
  let batchUseCase: BatchCreateEquipmentUnitsUseCase
  let labelsUseCase: GenerateEquipmentLabelsUseCase
  let changeMaintenanceUseCase: ChangeEquipmentMaintenanceUseCase

  const mockEquipmentUnitPort = {
    listUnits: jest.fn(),
    getUnitById: jest.fn(),
    getUnitsByIds: jest.fn(),
    findByAssetCode: jest.fn(),
    createUnit: jest.fn(),
    createBatch: jest.fn(),
    updateMetadata: jest.fn(),
    getHistory: jest.fn(),
    startMaintenance: jest.fn(),
    completeMaintenance: jest.fn(),
  }

  const mockRentalProductPort = {
    getProductById: jest.fn(),
  }

  const mockInventoryLocationPort = {
    getLocationById: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateEquipmentUnitUseCase,
        GetEquipmentUnitUseCase,
        ListEquipmentUnitsUseCase,
        UpdateEquipmentUnitUseCase,
        BatchCreateEquipmentUnitsUseCase,
        GenerateEquipmentLabelsUseCase,
        ChangeEquipmentMaintenanceUseCase,
        { provide: EQUIPMENT_UNIT_PORT, useValue: mockEquipmentUnitPort },
        { provide: RENTAL_PRODUCT_PORT, useValue: mockRentalProductPort },
        { provide: INVENTORY_LOCATION_PORT, useValue: mockInventoryLocationPort },
      ],
    }).compile()

    createUseCase = module.get<CreateEquipmentUnitUseCase>(CreateEquipmentUnitUseCase)
    getUseCase = module.get<GetEquipmentUnitUseCase>(GetEquipmentUnitUseCase)
    listUseCase = module.get<ListEquipmentUnitsUseCase>(ListEquipmentUnitsUseCase)
    updateUseCase = module.get<UpdateEquipmentUnitUseCase>(UpdateEquipmentUnitUseCase)
    batchUseCase = module.get<BatchCreateEquipmentUnitsUseCase>(BatchCreateEquipmentUnitsUseCase)
    labelsUseCase = module.get<GenerateEquipmentLabelsUseCase>(GenerateEquipmentLabelsUseCase)
    changeMaintenanceUseCase = module.get<ChangeEquipmentMaintenanceUseCase>(ChangeEquipmentMaintenanceUseCase)

    jest.clearAllMocks()
  })

  describe('CreateEquipmentUnitUseCase', () => {
    it('should throw RENTAL_PRODUCT_NOT_FOUND if product does not exist', async () => {
      mockRentalProductPort.getProductById.mockResolvedValue(null)
      await expect(
        createUseCase.execute({ productId: 'prod-1', homeInventoryLocationId: 'loc-1', condition: 'GOOD' }),
      ).rejects.toThrow(expect.objectContaining({ code: RENTAL_ERROR_CODES.RENTAL_PRODUCT_NOT_FOUND }))
    })

    it('should throw RENTAL_PRODUCT_ARCHIVED if product is ARCHIVED', async () => {
      mockRentalProductPort.getProductById.mockResolvedValue({ status: 'ARCHIVED' })
      await expect(
        createUseCase.execute({ productId: 'prod-1', homeInventoryLocationId: 'loc-1', condition: 'GOOD' }),
      ).rejects.toThrow(expect.objectContaining({ code: RENTAL_ERROR_CODES.RENTAL_PRODUCT_ARCHIVED }))
    })

    it('should throw INVENTORY_LOCATION_INACTIVE if location is not ACTIVE', async () => {
      mockRentalProductPort.getProductById.mockResolvedValue({ status: 'ACTIVE', sku: 'SKU1' })
      mockInventoryLocationPort.getLocationById.mockResolvedValue({ status: 'INACTIVE' })
      await expect(
        createUseCase.execute({ productId: 'prod-1', homeInventoryLocationId: 'loc-1', condition: 'GOOD' }),
      ).rejects.toThrow(expect.objectContaining({ code: RENTAL_ERROR_CODES.INVENTORY_LOCATION_INACTIVE }))
    })

    it('should allow INACTIVE products', async () => {
      mockRentalProductPort.getProductById.mockResolvedValue({ status: 'INACTIVE', sku: 'SKU1' })
      mockInventoryLocationPort.getLocationById.mockResolvedValue({ status: 'ACTIVE' })
      mockEquipmentUnitPort.findByAssetCode.mockResolvedValue(null)
      mockEquipmentUnitPort.createUnit.mockResolvedValue({ id: 'unit-1', assetCode: 'SKU1-ABCDEF' })

      const result = await createUseCase.execute({
        productId: 'prod-1',
        homeInventoryLocationId: 'loc-1',
        condition: 'GOOD',
      })
      expect(result.id).toBe('unit-1')
    })

    it('should create unit and generate canonical QR', async () => {
      mockRentalProductPort.getProductById.mockResolvedValue({ status: 'ACTIVE', sku: 'SKU1' })
      mockInventoryLocationPort.getLocationById.mockResolvedValue({ status: 'ACTIVE' })
      mockEquipmentUnitPort.findByAssetCode.mockResolvedValue(null)
      mockEquipmentUnitPort.createUnit.mockResolvedValue({ id: 'unit-1', assetCode: 'SKU1-ABCDEF' })

      await createUseCase.execute({
        productId: 'prod-1',
        homeInventoryLocationId: 'loc-1',
        condition: 'GOOD',
        acquiredAt: '2023-01-01',
      })

      expect(mockEquipmentUnitPort.createUnit).toHaveBeenCalledWith(
        expect.objectContaining({ qrCode: expect.stringMatching(/^TG-EU:SKU1-/) }),
      )
    })

    it('should default condition to GOOD', async () => {
      mockRentalProductPort.getProductById.mockResolvedValue({ status: 'ACTIVE', sku: 'SKU1' })
      mockInventoryLocationPort.getLocationById.mockResolvedValue({ status: 'ACTIVE' })
      mockEquipmentUnitPort.createUnit.mockResolvedValue({ id: 'unit-1' })

      await createUseCase.execute({ productId: 'prod-1', homeInventoryLocationId: 'loc-1' })

      expect(mockEquipmentUnitPort.createUnit).toHaveBeenCalledWith(expect.objectContaining({ condition: 'GOOD' }))
    })

    it('should reject DAMAGED or LOST initial condition', async () => {
      mockRentalProductPort.getProductById.mockResolvedValue({ status: 'ACTIVE', sku: 'SKU1' })
      mockInventoryLocationPort.getLocationById.mockResolvedValue({ status: 'ACTIVE' })
      await expect(
        createUseCase.execute({ productId: 'prod-1', homeInventoryLocationId: 'loc-1', condition: 'DAMAGED' }),
      ).rejects.toThrow(expect.objectContaining({ code: RENTAL_ERROR_CODES.INVALID_EQUIPMENT_CONDITION }))
      await expect(
        createUseCase.execute({ productId: 'prod-1', homeInventoryLocationId: 'loc-1', condition: 'LOST' }),
      ).rejects.toThrow(expect.objectContaining({ code: RENTAL_ERROR_CODES.INVALID_EQUIPMENT_CONDITION }))
    })

    it('should auto-retry on AUTO single QR collision', async () => {
      mockRentalProductPort.getProductById.mockResolvedValue({ status: 'ACTIVE', sku: 'SKU1' })
      mockInventoryLocationPort.getLocationById.mockResolvedValue({ status: 'ACTIVE' })

      mockEquipmentUnitPort.createUnit
        .mockRejectedValueOnce(AppError.fromCode(RENTAL_ERROR_CODES.EQUIPMENT_QR_CODE_EXISTS))
        .mockResolvedValueOnce({ id: '1' })

      await createUseCase.execute({ productId: 'prod-1', homeInventoryLocationId: 'loc-1' })
      expect(mockEquipmentUnitPort.createUnit).toHaveBeenCalledTimes(2)
    })
  })

  describe('UpdateEquipmentUnitUseCase', () => {
    it('should update successfully', async () => {
      mockEquipmentUnitPort.getUnitById.mockResolvedValue({ id: 'unit-1' })
      mockInventoryLocationPort.getLocationById.mockResolvedValue({ status: 'ACTIVE' })
      mockEquipmentUnitPort.updateMetadata.mockResolvedValue({ id: 'unit-1' })

      await updateUseCase.execute('unit-1', { expectedVersion: 1, homeInventoryLocationId: 'loc-1' })
      expect(mockEquipmentUnitPort.updateMetadata).toHaveBeenCalled()
    })

    it('should allow nullable serialNumber clear and acquiredAt clear', async () => {
      mockEquipmentUnitPort.getUnitById.mockResolvedValue({ id: 'unit-1' })
      mockEquipmentUnitPort.updateMetadata.mockResolvedValue({ id: 'unit-1' })

      await updateUseCase.execute('unit-1', { expectedVersion: 1, serialNumber: null, acquiredAt: null })
      expect(mockEquipmentUnitPort.updateMetadata).toHaveBeenCalledWith(
        expect.objectContaining({ serialNumber: null, acquiredAt: null }),
      )
    })

    it('should throw if home location missing or inactive', async () => {
      mockEquipmentUnitPort.getUnitById.mockResolvedValue({ id: 'unit-1' })
      mockInventoryLocationPort.getLocationById.mockResolvedValue({ status: 'INACTIVE' })
      await expect(
        updateUseCase.execute('unit-1', { expectedVersion: 1, homeInventoryLocationId: 'loc-inactive' }),
      ).rejects.toThrow(expect.objectContaining({ code: RENTAL_ERROR_CODES.INVENTORY_LOCATION_INACTIVE }))
    })

    it('should throw if unit not found', async () => {
      mockEquipmentUnitPort.updateMetadata.mockRejectedValue(
        AppError.fromCode(RENTAL_ERROR_CODES.EQUIPMENT_UNIT_NOT_FOUND),
      )
      await expect(updateUseCase.execute('unit-1', { expectedVersion: 1, serialNumber: 'ABC' })).rejects.toThrow(
        expect.objectContaining({ code: RENTAL_ERROR_CODES.EQUIPMENT_UNIT_NOT_FOUND }),
      )
    })

    it('should throw on version conflict', async () => {
      mockEquipmentUnitPort.updateMetadata.mockRejectedValue(AppError.fromCode(RENTAL_ERROR_CODES.VERSION_CONFLICT))

      await expect(updateUseCase.execute('unit-1', { expectedVersion: 1, serialNumber: 'ABC' })).rejects.toThrow(
        expect.objectContaining({ code: RENTAL_ERROR_CODES.VERSION_CONFLICT }),
      )
    })

    it('should reject empty patch', async () => {
      await expect(updateUseCase.execute('unit-1', { expectedVersion: 1 })).rejects.toThrow(
        expect.objectContaining({ code: COMMON_ERROR_CODES.VALIDATION_ERROR }),
      )
    })

    it('should reject empty patch with explicit undefined', async () => {
      await expect(updateUseCase.execute('unit-1', { expectedVersion: 1, serialNumber: undefined })).rejects.toThrow(
        expect.objectContaining({ code: COMMON_ERROR_CODES.VALIDATION_ERROR }),
      )
    })
  })

  describe('BatchCreateEquipmentUnitsUseCase', () => {
    it('should process AUTO success', async () => {
      mockRentalProductPort.getProductById.mockResolvedValue({ status: 'ACTIVE', sku: 'SKU1' })
      mockInventoryLocationPort.getLocationById.mockResolvedValue({ status: 'ACTIVE' })
      mockEquipmentUnitPort.createBatch.mockResolvedValue([{ id: '1' }])

      await batchUseCase.execute({
        productId: 'prod-1',
        homeInventoryLocationId: 'loc-1',
        quantity: 2,
        condition: 'GOOD',
        assetCodeMode: 'AUTO',
      })
      expect(mockEquipmentUnitPort.createBatch).toHaveBeenCalled()
    })

    it('should process PROVIDED success', async () => {
      mockRentalProductPort.getProductById.mockResolvedValue({ status: 'ACTIVE', sku: 'SKU1' })
      mockInventoryLocationPort.getLocationById.mockResolvedValue({ status: 'ACTIVE' })
      mockEquipmentUnitPort.createBatch.mockResolvedValue([{ id: '1' }])

      await batchUseCase.execute({
        productId: 'prod-1',
        homeInventoryLocationId: 'loc-1',
        quantity: 2,
        condition: 'GOOD',
        assetCodeMode: 'PROVIDED',
        assetCodes: ['A', 'B'],
      })
      expect(mockEquipmentUnitPort.createBatch).toHaveBeenCalled()
    })

    it('should throw if quantity is invalid', async () => {
      mockRentalProductPort.getProductById.mockResolvedValue({ status: 'ACTIVE', sku: 'SKU1' })
      await expect(
        batchUseCase.execute({
          productId: 'prod-1',
          homeInventoryLocationId: 'loc-1',
          quantity: 0,
          condition: 'GOOD',
          assetCodeMode: 'AUTO',
        }),
      ).rejects.toThrow(expect.objectContaining({ code: RENTAL_ERROR_CODES.BATCH_QUANTITY_INVALID }))
    })

    it('should throw missing PROVIDED codes', async () => {
      mockRentalProductPort.getProductById.mockResolvedValue({ status: 'ACTIVE', sku: 'SKU1' })
      mockInventoryLocationPort.getLocationById.mockResolvedValue({ status: 'ACTIVE' })
      await expect(
        batchUseCase.execute({
          productId: 'prod-1',
          homeInventoryLocationId: 'loc-1',
          quantity: 2,
          condition: 'GOOD',
          assetCodeMode: 'PROVIDED',
        }),
      ).rejects.toThrow(expect.objectContaining({ code: RENTAL_ERROR_CODES.BATCH_ASSET_CODE_COUNT_MISMATCH }))
    })

    it('should throw duplicate request codes', async () => {
      mockRentalProductPort.getProductById.mockResolvedValue({ status: 'ACTIVE', sku: 'SKU1' })
      mockInventoryLocationPort.getLocationById.mockResolvedValue({ status: 'ACTIVE' })
      await expect(
        batchUseCase.execute({
          productId: 'prod-1',
          homeInventoryLocationId: 'loc-1',
          quantity: 2,
          condition: 'GOOD',
          assetCodeMode: 'PROVIDED',
          assetCodes: ['A', 'A'],
        }),
      ).rejects.toThrow(expect.objectContaining({ code: RENTAL_ERROR_CODES.BATCH_ASSET_CODE_DUPLICATE }))
    })

    it('should retry AUTO DB collision retries full transaction', async () => {
      mockRentalProductPort.getProductById.mockResolvedValue({ status: 'ACTIVE', sku: 'SKU1' })
      mockInventoryLocationPort.getLocationById.mockResolvedValue({ status: 'ACTIVE' })

      mockEquipmentUnitPort.createBatch
        .mockRejectedValueOnce(AppError.fromCode(RENTAL_ERROR_CODES.EQUIPMENT_ASSET_CODE_EXISTS))
        .mockResolvedValueOnce([{ id: '1' }])

      await batchUseCase.execute({
        productId: 'prod-1',
        homeInventoryLocationId: 'loc-1',
        quantity: 1,
        condition: 'GOOD',
        assetCodeMode: 'AUTO',
      })
      expect(mockEquipmentUnitPort.createBatch).toHaveBeenCalledTimes(2)
    })

    it('should throw DB collision if PROVIDED', async () => {
      mockRentalProductPort.getProductById.mockResolvedValue({ status: 'ACTIVE', sku: 'SKU1' })
      mockInventoryLocationPort.getLocationById.mockResolvedValue({ status: 'ACTIVE' })
      mockEquipmentUnitPort.createBatch.mockRejectedValue(
        AppError.fromCode(RENTAL_ERROR_CODES.EQUIPMENT_ASSET_CODE_EXISTS),
      )

      await expect(
        batchUseCase.execute({
          productId: 'prod-1',
          homeInventoryLocationId: 'loc-1',
          quantity: 1,
          condition: 'GOOD',
          assetCodeMode: 'PROVIDED',
          assetCodes: ['A'],
        }),
      ).rejects.toThrow(expect.objectContaining({ code: RENTAL_ERROR_CODES.EQUIPMENT_ASSET_CODE_EXISTS }))
      expect(mockEquipmentUnitPort.createBatch).toHaveBeenCalledTimes(1) // No retries for PROVIDED
    })

    it('should reject DAMAGED or LOST initial condition', async () => {
      mockRentalProductPort.getProductById.mockResolvedValue({ status: 'ACTIVE', sku: 'SKU1' })
      mockInventoryLocationPort.getLocationById.mockResolvedValue({ status: 'ACTIVE' })
      await expect(
        batchUseCase.execute({
          productId: 'prod-1',
          homeInventoryLocationId: 'loc-1',
          quantity: 1,
          condition: 'DAMAGED',
          assetCodeMode: 'AUTO',
        }),
      ).rejects.toThrow(expect.objectContaining({ code: RENTAL_ERROR_CODES.INVALID_EQUIPMENT_CONDITION }))
    })
  })

  describe('GenerateEquipmentLabelsUseCase', () => {
    it('should generate labels', async () => {
      mockEquipmentUnitPort.getUnitsByIds.mockResolvedValue([
        { id: '1', assetCode: 'A', qrCode: 'TG-EU:A', product: { name: 'P' } },
      ])
      const res = await labelsUseCase.execute({ unitIds: ['1'] })
      expect(res.labels[0].qrPayload).toBe('TG-EU:A')
    })

    it('should use fallback QR if null', async () => {
      mockEquipmentUnitPort.getUnitsByIds.mockResolvedValue([
        { id: '1', assetCode: 'A', qrCode: null, product: { name: 'P' } },
      ])
      const res = await labelsUseCase.execute({ unitIds: ['1'] })
      expect(res.labels[0].qrPayload).toBe('TG-EU:A')
    })

    it('should preserve requested label order', async () => {
      mockEquipmentUnitPort.getUnitsByIds.mockResolvedValue([
        { id: '2', assetCode: 'B', qrCode: 'TG-EU:B', product: { name: 'P' } },
        { id: '1', assetCode: 'A', qrCode: 'TG-EU:A', product: { name: 'P' } },
      ])
      const res = await labelsUseCase.execute({ unitIds: ['1', '2'] })
      expect(res.labels[0].unitId).toBe('1')
      expect(res.labels[1].unitId).toBe('2')
    })

    it('should throw if any unit missing', async () => {
      mockEquipmentUnitPort.getUnitsByIds.mockResolvedValue([{ id: '1' }])
      await expect(labelsUseCase.execute({ unitIds: ['1', '2'] })).rejects.toThrow(
        expect.objectContaining({ code: RENTAL_ERROR_CODES.EQUIPMENT_UNIT_NOT_FOUND }),
      )
    })
  })

  describe('GetEquipmentUnitUseCase', () => {
    it('should throw EQUIPMENT_UNIT_NOT_FOUND if not found', async () => {
      mockEquipmentUnitPort.getUnitById.mockResolvedValue(null)
      await expect(getUseCase.execute('unit-1')).rejects.toThrow(
        expect.objectContaining({ code: RENTAL_ERROR_CODES.EQUIPMENT_UNIT_NOT_FOUND }),
      )
    })

    it('should return unit and history if found', async () => {
      mockEquipmentUnitPort.getUnitById.mockResolvedValue({ id: 'unit-1' })
      mockEquipmentUnitPort.getHistory.mockResolvedValue([{ type: 'MAINTENANCE', occurredAt: '2023' }])

      const res = await getUseCase.execute('unit-1')
      expect(res.unit.id).toBe('unit-1')
      expect(res.history.length).toBe(1)
    })
  })

  describe('ChangeEquipmentMaintenanceUseCase', () => {
    const mockMaintenanceResult = {
      unit: { id: 'unit-1', status: 'MAINTENANCE' },
      maintenance: {
        id: 'm-1',
        status: 'IN_PROGRESS',
        reason: 'reason',
        notes: null,
        startAt: '2026-09-28T00:00:00Z',
        completedAt: null,
        version: 1,
      },
    }

    it('should start maintenance successfully from ALLOWED states', async () => {
      const allowed = ['AVAILABLE', 'CLEANING', 'DAMAGED']
      for (const status of allowed) {
        mockEquipmentUnitPort.getUnitById.mockResolvedValue({
          id: 'unit-1',
          status,
          currentInventoryLocation: { id: 'loc-1' },
        } as unknown as EquipmentUnitView)
        mockEquipmentUnitPort.startMaintenance.mockResolvedValue(
          mockMaintenanceResult as unknown as ChangeMaintenancePortResult,
        )

        const res = await changeMaintenanceUseCase.execute('unit-1', {
          action: 'START',
          reason: 'fix',
          staffId: 'staff-1',
          expectedVersion: 1,
        })
        expect(res.unit.id).toBe('unit-1')
        expect(res.affectedOrders).toEqual([])
        expect(res.affectedOrdersEvaluated).toBe(false)
        expect(mockEquipmentUnitPort.startMaintenance).toHaveBeenCalledWith({
          unitId: 'unit-1',
          expectedVersion: 1,
          inventoryLocationId: 'loc-1',
          staffId: 'staff-1',
          reason: 'fix',
          notes: undefined,
        })
      }
    })

    it('should reject START from RENTED status', async () => {
      mockEquipmentUnitPort.getUnitById.mockResolvedValue({
        id: 'unit-1',
        status: 'RENTED',
        currentInventoryLocation: { id: 'loc-1' },
      } as unknown as EquipmentUnitView)
      await expect(
        changeMaintenanceUseCase.execute('unit-1', {
          action: 'START',
          reason: 'fix',
          staffId: 's',
          expectedVersion: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: RENTAL_ERROR_CODES.EQUIPMENT_UNIT_RENTED }))
    })

    it('should reject START from unmaintainable states', async () => {
      const blocked = ['PICKED', 'PACKED', 'RETURN_PENDING', 'MAINTENANCE', 'LOST', 'RETIRED']
      for (const status of blocked) {
        mockEquipmentUnitPort.getUnitById.mockResolvedValue({
          id: 'unit-1',
          status,
          currentInventoryLocation: { id: 'loc-1' },
        } as unknown as EquipmentUnitView)
        await expect(
          changeMaintenanceUseCase.execute('unit-1', {
            action: 'START',
            reason: 'fix',
            staffId: 's',
            expectedVersion: 1,
          }),
        ).rejects.toThrow(expect.objectContaining({ code: RENTAL_ERROR_CODES.EQUIPMENT_UNIT_NOT_MAINTAINABLE }))
      }
    })

    it('should reject START if unit has no physical location', async () => {
      mockEquipmentUnitPort.getUnitById.mockResolvedValue({
        id: 'unit-1',
        status: 'AVAILABLE',
        currentInventoryLocation: null,
      } as unknown as EquipmentUnitView)
      await expect(
        changeMaintenanceUseCase.execute('unit-1', {
          action: 'START',
          reason: 'fix',
          staffId: 's',
          expectedVersion: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: RENTAL_ERROR_CODES.EQUIPMENT_UNIT_NOT_MAINTAINABLE }))
    })

    it('should complete maintenance and set status to AVAILABLE for NEW/GOOD/FAIR', async () => {
      mockEquipmentUnitPort.getUnitById.mockResolvedValue({
        id: 'unit-1',
        status: 'MAINTENANCE',
      } as unknown as EquipmentUnitView)
      const completeMockResult = {
        unit: { id: 'unit-1', status: 'AVAILABLE', condition: 'NEW' },
        maintenance: {
          id: 'm-1',
          status: 'COMPLETED',
          reason: 'fix',
          notes: null,
          startAt: '2026-09-28T00:00:00Z',
          completedAt: '2026-09-28T01:00:00Z',
          version: 2,
        },
      }
      mockEquipmentUnitPort.completeMaintenance.mockResolvedValue(
        completeMockResult as unknown as ChangeMaintenancePortResult,
      )

      const res = await changeMaintenanceUseCase.execute('unit-1', {
        action: 'COMPLETE',
        resultingCondition: 'NEW',
        expectedVersion: 1,
      })
      expect(res.unit.status).toBe('AVAILABLE')
      expect(mockEquipmentUnitPort.completeMaintenance).toHaveBeenCalledWith({
        unitId: 'unit-1',
        expectedVersion: 1,
        resultingCondition: 'NEW',
      })
    })

    it('should complete maintenance and set status to DAMAGED if resulting condition is DAMAGED', async () => {
      mockEquipmentUnitPort.getUnitById.mockResolvedValue({
        id: 'unit-1',
        status: 'MAINTENANCE',
      } as unknown as EquipmentUnitView)
      const completeMockResult = {
        unit: { id: 'unit-1', status: 'DAMAGED', condition: 'DAMAGED' },
        maintenance: {
          id: 'm-1',
          status: 'COMPLETED',
          reason: 'fix',
          notes: null,
          startAt: '2026-09-28T00:00:00Z',
          completedAt: '2026-09-28T01:00:00Z',
          version: 2,
        },
      }
      mockEquipmentUnitPort.completeMaintenance.mockResolvedValue(
        completeMockResult as unknown as ChangeMaintenancePortResult,
      )

      const res = await changeMaintenanceUseCase.execute('unit-1', {
        action: 'COMPLETE',
        resultingCondition: 'DAMAGED',
        expectedVersion: 1,
      })
      expect(res.unit.status).toBe('DAMAGED')
    })

    it('should complete maintenance and set status to LOST if resulting condition is LOST', async () => {
      mockEquipmentUnitPort.getUnitById.mockResolvedValue({
        id: 'unit-1',
        status: 'MAINTENANCE',
      } as unknown as EquipmentUnitView)
      const completeMockResult = {
        unit: { id: 'unit-1', status: 'LOST', condition: 'LOST' },
        maintenance: {
          id: 'm-1',
          status: 'COMPLETED',
          reason: 'fix',
          notes: null,
          startAt: '2026-09-28T00:00:00Z',
          completedAt: '2026-09-28T01:00:00Z',
          version: 2,
        },
      }
      mockEquipmentUnitPort.completeMaintenance.mockResolvedValue(
        completeMockResult as unknown as ChangeMaintenancePortResult,
      )

      const res = await changeMaintenanceUseCase.execute('unit-1', {
        action: 'COMPLETE',
        resultingCondition: 'LOST',
        expectedVersion: 1,
      })
      expect(res.unit.status).toBe('LOST')
    })

    it('should throw EQUIPMENT_UNIT_NOT_FOUND if unit missing on START', async () => {
      mockEquipmentUnitPort.getUnitById.mockResolvedValue(null)
      await expect(
        changeMaintenanceUseCase.execute('unit-1', {
          action: 'START',
          reason: 'fix',
          staffId: 's',
          expectedVersion: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: RENTAL_ERROR_CODES.EQUIPMENT_UNIT_NOT_FOUND }))
    })

    it('should propagate EQUIPMENT_MAINTENANCE_NOT_ACTIVE from completeMaintenance port', async () => {
      mockEquipmentUnitPort.getUnitById.mockResolvedValue({
        id: 'unit-1',
        status: 'MAINTENANCE',
      } as unknown as EquipmentUnitView)
      mockEquipmentUnitPort.completeMaintenance.mockRejectedValue(
        AppError.fromCode(RENTAL_ERROR_CODES.EQUIPMENT_MAINTENANCE_NOT_ACTIVE),
      )

      await expect(
        changeMaintenanceUseCase.execute('unit-1', {
          action: 'COMPLETE',
          resultingCondition: 'NEW',
          expectedVersion: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: RENTAL_ERROR_CODES.EQUIPMENT_MAINTENANCE_NOT_ACTIVE }))
    })

    it('should propagate EQUIPMENT_MAINTENANCE_STATE_CONFLICT from startMaintenance port', async () => {
      mockEquipmentUnitPort.getUnitById.mockResolvedValue({
        id: 'unit-1',
        status: 'AVAILABLE',
        currentInventoryLocation: { id: 'loc-1' },
      } as unknown as EquipmentUnitView)
      mockEquipmentUnitPort.startMaintenance.mockRejectedValue(
        AppError.fromCode(RENTAL_ERROR_CODES.EQUIPMENT_MAINTENANCE_STATE_CONFLICT),
      )

      await expect(
        changeMaintenanceUseCase.execute('unit-1', {
          action: 'START',
          reason: 'fix',
          staffId: 's',
          expectedVersion: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: RENTAL_ERROR_CODES.EQUIPMENT_MAINTENANCE_STATE_CONFLICT }))
    })

    it('should propagate VERSION_CONFLICT from startMaintenance port', async () => {
      mockEquipmentUnitPort.getUnitById.mockResolvedValue({
        id: 'unit-1',
        status: 'AVAILABLE',
        currentInventoryLocation: { id: 'loc-1' },
      } as unknown as EquipmentUnitView)
      mockEquipmentUnitPort.startMaintenance.mockRejectedValue(AppError.fromCode(RENTAL_ERROR_CODES.VERSION_CONFLICT))

      await expect(
        changeMaintenanceUseCase.execute('unit-1', {
          action: 'START',
          reason: 'fix',
          staffId: 's',
          expectedVersion: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: RENTAL_ERROR_CODES.VERSION_CONFLICT }))
    })

    it('should reject COMPLETE if unit is not in MAINTENANCE status', async () => {
      mockEquipmentUnitPort.getUnitById.mockResolvedValue({
        id: 'unit-1',
        status: 'AVAILABLE',
      } as unknown as EquipmentUnitView)
      await expect(
        changeMaintenanceUseCase.execute('unit-1', {
          action: 'COMPLETE',
          resultingCondition: 'NEW',
          expectedVersion: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: RENTAL_ERROR_CODES.INVALID_EQUIPMENT_STATE_TRANSITION }))
    })
  })

  describe('ListEquipmentUnitsUseCase', () => {
    it('should return paginated result with counts', async () => {
      mockEquipmentUnitPort.listUnits.mockResolvedValue({
        items: [{ id: '1' }],
        total: 1,
        counts: { total: 1, available: 1 },
      })

      const res = await listUseCase.execute({ page: 1, pageSize: 20 })
      expect(res.pagination.totalItems).toBe(1)
      expect(res.counts.available).toBe(1)
    })
  })
})
