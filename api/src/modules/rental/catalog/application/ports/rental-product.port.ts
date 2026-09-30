export const RENTAL_PRODUCT_PORT = Symbol('RENTAL_PRODUCT_PORT');

export interface RentalProductCategoryView {
  id: string;
  name: string;
  status: string;
}

export interface RentalProductView {
  id: string;
  sku: string;
  name: string;
  category: RentalProductCategoryView;
  description: string | null;
  dailyPrice: number;
  depositPolicy: {
    type: string;
    amount?: number;
    referenceValue?: number;
    percentage?: number;
  };
  currency: string;
  replacementValue: number;
  status: string;
  version: number;
  imageMediaIds: string[];
  spec: any;
  recommendationTags: string[];
}

export interface ListRentalProductsParams {
  page: number;
  pageSize: number;
  search?: string;
  categoryId?: string;
}

export interface ListStaffRentalProductsParams {
  page: number;
  pageSize: number;
  status?: string;
}

export interface ChangeRentalProductStatusParams {
  id: string;
  status: string;
  expectedVersion: number;
}

export interface CreateRentalProductParams {
  categoryId: string;
  sku: string;
  name: string;
  description?: string | null;
  dailyPrice: number;
  currency: string;
  replacementValue: number;
  depositPolicy: {
    type: string;
    amount?: number;
    percentage?: number;
  };
  imageMediaIds?: string[];
  spec?: any;
  recommendationTags?: string[];
}

export interface UpdateRentalProductParams {
  id: string;
  name?: string;
  description?: string | null;
  dailyPrice?: number;
  replacementValue?: number;
  depositPolicy?: {
    type: string;
    amount?: number;
    percentage?: number;
  };
  imageMediaIds?: string[];
  spec?: any;
  recommendationTags?: string[];
  expectedVersion: number;
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

export interface RentalProductPort {
  listActiveProducts(params: ListRentalProductsParams): Promise<{ items: RentalProductView[]; total: number }>;
  getProductById(id: string): Promise<RentalProductView | null>;
  listStaffProducts(params: ListStaffRentalProductsParams): Promise<{ items: RentalProductView[]; total: number }>;
  changeStatus(params: ChangeRentalProductStatusParams): Promise<RentalProductView>;
  createProduct(params: CreateRentalProductParams): Promise<RentalProductView>;
  updateProduct(params: UpdateRentalProductParams): Promise<RentalProductView>;
}
