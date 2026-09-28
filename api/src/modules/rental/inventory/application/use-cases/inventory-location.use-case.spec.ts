import { Test, TestingModule } from '@nestjs/testing';
import { ListInventoryLocationsUseCase } from './list-inventory-locations.use-case';
import { GetInventoryLocationUseCase } from './get-inventory-location.use-case';
import { INVENTORY_LOCATION_PORT } from '../ports/inventory-location.port';
import { AppError, RENTAL_ERROR_CODES } from '../../../../../shared/errors';

const mockLocationView = {
  id: 'loc-1',
  code: 'INV-HCM-01',
  name: 'Kho HCM Chính',
  address: '123 Đường A, Quận B, TP.HCM',
  latitude: 10.123456,
  longitude: 106.123456,
  status: 'ACTIVE',
};

const mockPort = {
  listLocations: jest.fn(),
  getLocationById: jest.fn(),
};

describe('InventoryLocation Use Cases', () => {
  let listLocationsUseCase: ListInventoryLocationsUseCase;
  let getLocationUseCase: GetInventoryLocationUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListInventoryLocationsUseCase,
        GetInventoryLocationUseCase,
        { provide: INVENTORY_LOCATION_PORT, useValue: mockPort },
      ],
    }).compile();

    listLocationsUseCase = module.get<ListInventoryLocationsUseCase>(ListInventoryLocationsUseCase);
    getLocationUseCase = module.get<GetInventoryLocationUseCase>(GetInventoryLocationUseCase);

    jest.clearAllMocks();
  });

  describe('List Locations', () => {
    it('should calculate pagination and forward params', async () => {
      mockPort.listLocations.mockResolvedValue({ items: [mockLocationView], total: 1 });
      const params = { page: 2, pageSize: 20, search: 'HCM', status: 'INACTIVE' };
      
      const result = await listLocationsUseCase.execute(params);
      
      expect(mockPort.listLocations).toHaveBeenCalledWith(params);
      expect(result.items).toHaveLength(1);
      expect(result.pagination.totalPages).toBe(1);
      expect(result.pagination.totalItems).toBe(1);
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.pageSize).toBe(20);
    });

    it('should return empty result correctly', async () => {
      mockPort.listLocations.mockResolvedValue({ items: [], total: 0 });
      const result = await listLocationsUseCase.execute({ page: 1, pageSize: 20 });
      
      expect(result.items).toHaveLength(0);
      expect(result.pagination.totalPages).toBe(0);
    });
  });

  describe('Get Location', () => {
    it('should return location if found', async () => {
      mockPort.getLocationById.mockResolvedValue(mockLocationView);
      const result = await getLocationUseCase.execute('loc-1');
      expect(result).toEqual(mockLocationView);
    });

    it('should throw INVENTORY_LOCATION_NOT_FOUND if missing', async () => {
      mockPort.getLocationById.mockResolvedValue(null);
      await expect(getLocationUseCase.execute('missing')).rejects.toMatchObject({
        code: RENTAL_ERROR_CODES.INVENTORY_LOCATION_NOT_FOUND,
      });
    });
  });
});
