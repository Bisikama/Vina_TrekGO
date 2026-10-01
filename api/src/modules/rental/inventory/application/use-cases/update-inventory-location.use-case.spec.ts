import { Test, TestingModule } from '@nestjs/testing'
import { UpdateInventoryLocationUseCase } from './update-inventory-location.use-case'
import { INVENTORY_LOCATION_PORT } from '../ports/inventory-location.port'
import { AppError, RENTAL_ERROR_CODES } from '../../../../../shared/errors'

describe('UpdateInventoryLocationUseCase', () => {
  let useCase: UpdateInventoryLocationUseCase
  const mockPort = {
    getLocationById: jest.fn(),
    getLocationByCode: jest.fn(),
    updateLocation: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateInventoryLocationUseCase,
        { provide: INVENTORY_LOCATION_PORT, useValue: mockPort },
      ],
    }).compile()

    useCase = module.get<UpdateInventoryLocationUseCase>(UpdateInventoryLocationUseCase)
    jest.clearAllMocks()
  })

  it('should throw error if location not found', async () => {
    mockPort.getLocationById.mockResolvedValue(null)
    await expect(useCase.execute({ id: 'missing' })).rejects.toMatchObject({
      code: RENTAL_ERROR_CODES.INVENTORY_LOCATION_NOT_FOUND,
    })
  })

  it('should throw error if new code exists', async () => {
    mockPort.getLocationById.mockResolvedValue({ id: 'loc-1', code: 'OLD-01' })
    mockPort.getLocationByCode.mockResolvedValue({ id: 'loc-2' }) // Another location has this code

    await expect(useCase.execute({ id: 'loc-1', code: 'NEW-01' })).rejects.toMatchObject({
      code: RENTAL_ERROR_CODES.INVENTORY_LOCATION_CODE_EXISTS,
    })
  })

  it('should update successfully without code change', async () => {
    mockPort.getLocationById.mockResolvedValue({ id: 'loc-1', code: 'OLD-01' })
    const expected = { id: 'loc-1', code: 'OLD-01', name: 'Updated' }
    mockPort.updateLocation.mockResolvedValue(expected)

    const result = await useCase.execute({ id: 'loc-1', name: 'Updated' })

    expect(mockPort.getLocationByCode).not.toHaveBeenCalled()
    expect(mockPort.updateLocation).toHaveBeenCalledWith('loc-1', { name: 'Updated' })
    expect(result).toEqual(expected)
  })

  it('should update successfully with code change', async () => {
    mockPort.getLocationById.mockResolvedValue({ id: 'loc-1', code: 'OLD-01' })
    mockPort.getLocationByCode.mockResolvedValue(null) // Code is free
    const expected = { id: 'loc-1', code: 'NEW-01', name: 'Updated' }
    mockPort.updateLocation.mockResolvedValue(expected)

    const result = await useCase.execute({ id: 'loc-1', code: 'NEW-01', name: 'Updated' })

    expect(mockPort.getLocationByCode).toHaveBeenCalledWith('NEW-01')
    expect(mockPort.updateLocation).toHaveBeenCalledWith('loc-1', { code: 'NEW-01', name: 'Updated' })
    expect(result).toEqual(expected)
  })
})
