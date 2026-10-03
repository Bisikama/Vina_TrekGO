import { Test, TestingModule } from '@nestjs/testing';
import { ListRentalCategoriesUseCase } from './list-rental-categories.use-case';
import { RENTAL_CATEGORY_PORT } from '../ports/rental-category.port';

describe('ListRentalCategoriesUseCase', () => {
  let useCase: ListRentalCategoriesUseCase;

  const mockPort = {
    listActiveCategories: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListRentalCategoriesUseCase,
        {
          provide: RENTAL_CATEGORY_PORT,
          useValue: mockPort,
        },
      ],
    }).compile();

    useCase = module.get<ListRentalCategoriesUseCase>(ListRentalCategoriesUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should calculate pagination correctly when items exist', async () => {
    const mockItems = [
      {
        id: '1',
        name: 'Tent',
        slug: 'tent',
        description: null,
      },
    ];

    mockPort.listActiveCategories.mockResolvedValue({ items: mockItems, total: 1 });

    const result = await useCase.execute({ page: 1, pageSize: 20 });

    expect(mockPort.listActiveCategories).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
    expect(result.items).toEqual(mockItems);
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 20,
      totalItems: 1,
      totalPages: 1,
    });
  });

  it('should return totalPages = 0 when result is empty', async () => {
    mockPort.listActiveCategories.mockResolvedValue({ items: [], total: 0 });

    const result = await useCase.execute({ page: 1, pageSize: 20 });

    expect(mockPort.listActiveCategories).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
    expect(result.items).toEqual([]);
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 0,
    });
  });
});
