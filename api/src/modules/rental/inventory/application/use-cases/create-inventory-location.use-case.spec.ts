import { Test, TestingModule } from '@nestjs/testing'
import { CreateInventoryLocationUseCase } from './create-inventory-location.use-case'
import { INVENTORY_LOCATION_PORT } from '../ports/inventory-location.port'
import { AppError, RENTAL_ERROR_CODES } from '../../../../../shared/errors'

describe('CreateInventoryLocationUseCase', () => {
  let useCase: CreateInventoryLocationUseCase
  const mockPort = {
    getLocationByCode: jest.fn(),
    createLocation: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateInventoryLocationUseCase,
        { provide: INVENTORY_LOCATION_PORT, useValue: mockPort },
      ],
    }).compile()

    useCase = module.get<CreateInventoryLocationUseCase>(CreateInventoryLocationUseCase)
    jest.clearAllMocks()
  })

  it('should create location successfully', async () => {
    mockPort.getLocationByCode.mockResolvedValue(null)
    const input = { code: 'NEW-01', name: 'New Loc', address: '123' }
    const expected = { id: 'uuid', ...input }
    mockPort.createLocation.mockResolvedValue(expected)

    const result = await useCase.execute(input)

    expect(mockPort.getLocationByCode).toHaveBeenCalledWith('NEW-01')
    expect(mockPort.createLocation).toHaveBeenCalledWith(input)
    expect(result).toEqual(expected)
  })

  it('should throw error if code exists', async () => {
    mockPort.getLocationByCode.mockResolvedValue({ id: 'existing' })
    const input = { code: 'EXISTING', name: 'Loc', address: '123' }

    await expect(useCase.execute(input)).rejects.toMatchObject({
      code: RENTAL_ERROR_CODES.INVENTORY_LOCATION_CODE_EXISTS,
    })
    expect(mockPort.createLocation).not.toHaveBeenCalled()
  })
})
