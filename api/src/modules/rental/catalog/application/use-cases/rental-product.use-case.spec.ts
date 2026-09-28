import { Test, TestingModule } from '@nestjs/testing';
import { AppError, RENTAL_ERROR_CODES } from '../../../../../shared/errors';
import { RENTAL_PRODUCT_PORT } from '../ports/rental-product.port';
import { ListRentalProductsUseCase } from './list-rental-products.use-case';
import { GetRentalProductUseCase } from './get-rental-product.use-case';
import { ListStaffRentalProductsUseCase } from './list-staff-rental-products.use-case';
import { ChangeRentalProductStatusUseCase } from './change-rental-product-status.use-case';
import { CreateRentalProductUseCase } from './create-rental-product.use-case';
import { UpdateRentalProductUseCase } from './update-rental-product.use-case';
import { RENTAL_CATEGORY_PORT } from '../ports/rental-category.port';

const mockProductView = {
  id: '123',
  sku: 'SKU-01',
  name: 'Test Product',
  category: { id: 'cat1', name: 'Cat 1', status: 'ACTIVE' },
  description: 'Test',
  dailyPrice: 10000,
  depositPolicy: { type: 'FIXED', value: 50000 },
  currency: 'VND',
  replacementValue: 2000000,
  status: 'ACTIVE',
  version: 1,
  imageMediaIds: [],
  spec: {},
  recommendationTags: [],
};

const mockPort = {
  listActiveProducts: jest.fn(),
  getProductById: jest.fn(),
  listStaffProducts: jest.fn(),
  changeStatus: jest.fn(),
  createProduct: jest.fn(),
  updateProduct: jest.fn(),
};

const mockCategoryPort = {
  getCategoryById: jest.fn(),
};

describe('RentalProduct Use Cases', () => {
  let listPublic: ListRentalProductsUseCase;
  let getPublic: GetRentalProductUseCase;
  let listStaff: ListStaffRentalProductsUseCase;
  let changeStatus: ChangeRentalProductStatusUseCase;
  let createProduct: CreateRentalProductUseCase;
  let updateProduct: UpdateRentalProductUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListRentalProductsUseCase,
        GetRentalProductUseCase,
        ListStaffRentalProductsUseCase,
        ChangeRentalProductStatusUseCase,
        CreateRentalProductUseCase,
        UpdateRentalProductUseCase,
        { provide: RENTAL_PRODUCT_PORT, useValue: mockPort },
        { provide: RENTAL_CATEGORY_PORT, useValue: mockCategoryPort },
      ],
    }).compile();

    listPublic = module.get(ListRentalProductsUseCase);
    getPublic = module.get(GetRentalProductUseCase);
    listStaff = module.get(ListStaffRentalProductsUseCase);
    changeStatus = module.get(ChangeRentalProductStatusUseCase);
    createProduct = module.get(CreateRentalProductUseCase);
    updateProduct = module.get(UpdateRentalProductUseCase);
    jest.clearAllMocks();
  });

  describe('Public List', () => {
    it('should calculate pagination and forward search/category', async () => {
      mockPort.listActiveProducts.mockResolvedValue({ items: [mockProductView], total: 1 });
      const result = await listPublic.execute({ page: 1, pageSize: 20, search: 'Test', categoryId: 'cat1' });
      
      expect(mockPort.listActiveProducts).toHaveBeenCalledWith({ page: 1, pageSize: 20, search: 'Test', categoryId: 'cat1' });
      expect(result.pagination.totalItems).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should return empty result correctly', async () => {
      mockPort.listActiveProducts.mockResolvedValue({ items: [], total: 0 });
      const result = await listPublic.execute({ page: 2, pageSize: 20 });
      
      expect(result.items).toHaveLength(0);
      expect(result.pagination.totalPages).toBe(0);
    });
  });

  describe('Public Detail', () => {
    it('should return product if found', async () => {
      mockPort.getProductById.mockResolvedValue(mockProductView);
      const result = await getPublic.execute('123');
      expect(result).toEqual(mockProductView);
    });

    it('should throw AppError if not found or not active', async () => {
      mockPort.getProductById.mockResolvedValue(null);
      await expect(getPublic.execute('123')).rejects.toMatchObject({
        code: RENTAL_ERROR_CODES.RENTAL_PRODUCT_NOT_FOUND
      });
    });
  });

  describe('Staff List', () => {
    it('should forward status filter and calculate pagination', async () => {
      mockPort.listStaffProducts.mockResolvedValue({ items: [mockProductView], total: 25 });
      const result = await listStaff.execute({ page: 2, pageSize: 20, status: 'INACTIVE' });
      
      expect(mockPort.listStaffProducts).toHaveBeenCalledWith({ page: 2, pageSize: 20, status: 'INACTIVE' });
      expect(result.pagination.totalPages).toBe(2);
    });
  });

  describe('Change Status', () => {
    it('should forward expectedVersion and transition status', async () => {
      mockPort.changeStatus.mockResolvedValue({ ...mockProductView, status: 'INACTIVE', version: 2 });
      const result = await changeStatus.execute({ id: '123', status: 'INACTIVE', expectedVersion: 1 });
      
      expect(mockPort.changeStatus).toHaveBeenCalledWith({ id: '123', status: 'INACTIVE', expectedVersion: 1 });
      expect(result.status).toBe('INACTIVE');
      expect(result.version).toBe(2);
    });

    it('should propagate VERSION_CONFLICT AppError', async () => {
      mockPort.changeStatus.mockRejectedValue(AppError.fromCode(RENTAL_ERROR_CODES.VERSION_CONFLICT));
      await expect(changeStatus.execute({ id: '123', status: 'INACTIVE', expectedVersion: 1 })).rejects.toMatchObject({
        code: RENTAL_ERROR_CODES.VERSION_CONFLICT
      });
    });
  });

  describe('Create Product', () => {
    const validParams = {
      categoryId: 'cat1',
      sku: 'SKU-02',
      name: 'New Product',
      dailyPrice: 10000,
      currency: 'VND',
      replacementValue: 100000,
      depositPolicy: { type: 'FIXED', amount: 50000 },
    };

    beforeEach(() => {
      mockCategoryPort.getCategoryById.mockResolvedValue({ status: 'ACTIVE' });
    });

    it('should create product successfully', async () => {
      mockPort.createProduct.mockResolvedValue(mockProductView);
      const result = await createProduct.execute(validParams);
      expect(mockPort.createProduct).toHaveBeenCalledWith(validParams);
      expect(result).toEqual(mockProductView);
    });

    it('should reject invalid daily price', async () => {
      await expect(createProduct.execute({ ...validParams, dailyPrice: -1 })).rejects.toMatchObject({
        code: RENTAL_ERROR_CODES.INVALID_DAILY_PRICE
      });
    });

    it('should reject invalid replacement value', async () => {
      await expect(createProduct.execute({ ...validParams, replacementValue: -1 })).rejects.toMatchObject({
        code: RENTAL_ERROR_CODES.INVALID_REPLACEMENT_VALUE
      });
    });

    it('should reject invalid deposit policy', async () => {
      await expect(createProduct.execute({ ...validParams, depositPolicy: { type: 'FIXED', amount: -1 } })).rejects.toMatchObject({
        code: RENTAL_ERROR_CODES.INVALID_DEPOSIT_POLICY
      });
    });
  });

  describe('Update Product', () => {
    it('should update product successfully', async () => {
      mockPort.updateProduct.mockResolvedValue({ ...mockProductView, name: 'Updated' });
      const result = await updateProduct.execute({ id: '123', expectedVersion: 1, name: 'Updated' });
      expect(mockPort.updateProduct).toHaveBeenCalledWith({ id: '123', expectedVersion: 1, name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('should reject invalid daily price on update', async () => {
      await expect(updateProduct.execute({ id: '123', expectedVersion: 1, dailyPrice: -5 })).rejects.toMatchObject({
        code: RENTAL_ERROR_CODES.INVALID_DAILY_PRICE
      });
    });
  });
});
