import { ConflictException } from '@nestjs/common'
import { CreateDestinationUseCase } from './use-cases/create-destination.use-case'
import { UpdateDestinationUseCase } from './use-cases/update-destination.use-case'
import { DestinationPort, DestinationSummary } from './ports/destination.port'
import { RecordStatus } from '@prisma/client'

describe('Destination with Pickup Points Use Cases', () => {
  let destinationPort: jest.Mocked<DestinationPort>
  let createUseCase: CreateDestinationUseCase
  let updateUseCase: UpdateDestinationUseCase

  const mockDestination: DestinationSummary = {
    id: 'dest-1',
    name: 'Tà Xùa',
    description: 'Thiên đường săn mây',
    region: 'NORTH',
    centerLat: 21.2833,
    centerLng: 104.3833,
    status: RecordStatus.ACTIVE,
    trailCount: 0,
    pickupPointCount: 1,
    pickupPoints: [
      {
        id: 'pup-1',
        destinationId: 'dest-1',
        code: 'PKP-TAXUA-1',
        name: 'Bến xe Mỹ Đình',
        address: '20 Phạm Hùng, Hà Nội',
        latitude: 21.0285,
        longitude: 105.7781,
        note: null,
        status: RecordStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    destinationPort = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countRelated: jest.fn(),
    }

    createUseCase = new CreateDestinationUseCase(destinationPort)
    updateUseCase = new UpdateDestinationUseCase(destinationPort)
  })

  describe('CreateDestinationUseCase', () => {
    it('creates destination along with pickup points successfully', async () => {
      destinationPort.findByName.mockResolvedValue(null)
      destinationPort.create.mockResolvedValue(mockDestination)

      const result = await createUseCase.execute({
        name: 'Tà Xùa',
        region: 'NORTH',
        actorId: 'admin-1',
        pickupPoints: [
          {
            name: 'Bến xe Mỹ Đình',
            address: '20 Phạm Hùng, Hà Nội',
            latitude: 21.0285,
            longitude: 105.7781,
            code: 'PKP-TAXUA-1',
          },
        ],
      })

      expect(destinationPort.findByName).toHaveBeenCalledWith('Tà Xùa')
      expect(destinationPort.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Tà Xùa',
          actorId: 'admin-1',
          pickupPoints: [
            expect.objectContaining({
              name: 'Bến xe Mỹ Đình',
              code: 'PKP-TAXUA-1',
            }),
          ],
        }),
      )
      expect(result).toEqual(mockDestination)
    })

    it('throws ConflictException if pickup points have duplicate codes in payload', async () => {
      destinationPort.findByName.mockResolvedValue(null)

      await expect(
        createUseCase.execute({
          name: 'Tà Xùa',
          actorId: 'admin-1',
          pickupPoints: [
            {
              name: 'Điểm 1',
              address: 'Địa chỉ 1',
              latitude: 21,
              longitude: 105,
              code: 'PKP-DUPLICATE',
            },
            {
              name: 'Điểm 2',
              address: 'Địa chỉ 2',
              latitude: 21.1,
              longitude: 105.1,
              code: 'pkp-duplicate', // case-insensitive check
            },
          ],
        }),
      ).rejects.toThrow(ConflictException)

      expect(destinationPort.create).not.toHaveBeenCalled()
    })
  })

  describe('UpdateDestinationUseCase', () => {
    it('updates destination along with pickup points successfully', async () => {
      destinationPort.findById.mockResolvedValue(mockDestination)
      destinationPort.update.mockResolvedValue({
        ...mockDestination,
        name: 'Tà Xùa - Sơn La',
      })

      const result = await updateUseCase.execute('dest-1', {
        name: 'Tà Xùa - Sơn La',
        actorId: 'admin-1',
        pickupPoints: [
          {
            id: 'pup-1',
            name: 'Bến xe Mỹ Đình Cổng 1',
            address: '20 Phạm Hùng',
            latitude: 21.0285,
            longitude: 105.7781,
          },
          {
            name: 'Sân bay Nội Bài',
            address: 'Sóc Sơn, Hà Nội',
            latitude: 21.2212,
            longitude: 105.8072,
          },
        ],
      })

      expect(destinationPort.findById).toHaveBeenCalledWith('dest-1')
      expect(destinationPort.update).toHaveBeenCalledWith(
        'dest-1',
        expect.objectContaining({
          name: 'Tà Xùa - Sơn La',
          actorId: 'admin-1',
        }),
      )
      expect(result.name).toBe('Tà Xùa - Sơn La')
    })

    it('throws ConflictException if update has duplicate pickup point codes in payload', async () => {
      destinationPort.findById.mockResolvedValue(mockDestination)

      await expect(
        updateUseCase.execute('dest-1', {
          actorId: 'admin-1',
          pickupPoints: [
            {
              id: 'pup-1',
              name: 'Điểm 1',
              address: 'Địa chỉ 1',
              latitude: 21,
              longitude: 105,
              code: 'DUPLICATE',
            },
            {
              name: 'Điểm 2',
              address: 'Địa chỉ 2',
              latitude: 21.1,
              longitude: 105.1,
              code: 'DUPLICATE',
            },
          ],
        }),
      ).rejects.toThrow(ConflictException)

      expect(destinationPort.update).not.toHaveBeenCalled()
    })
  })
})
