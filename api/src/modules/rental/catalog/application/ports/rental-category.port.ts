export const RENTAL_CATEGORY_PORT = Symbol('RENTAL_CATEGORY_PORT');

export interface RentalCategoryView {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export interface ListRentalCategoriesParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface RentalCategoryPort {
  listActiveCategories(params: ListRentalCategoriesParams): Promise<{ items: RentalCategoryView[]; total: number }>;
}
