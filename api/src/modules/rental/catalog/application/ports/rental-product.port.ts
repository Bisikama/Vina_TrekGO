export const RENTAL_PRODUCT_PORT = Symbol('RENTAL_PRODUCT_PORT');

export interface RentalProductCategoryView {
  id: string;
  name: string;
  status: string;
}

export interface RentalProductImageView {
  mediaId: string;
  url: string;
  thumbnailUrl: string;
  cardUrl: string;
  detailUrl: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
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
  images?: RentalProductImageView[];
  spec: any;
  recommendationTags: string[];
  requiresDeepInspectionAfterReturn: boolean;
  /** Nhóm hạng; null = sản phẩm thường. FE gom các sản phẩm cùng gradeGroupId thành một thẻ. */
  gradeGroupId: string | null;
  grade: 'LIKE_NEW' | 'GOOD_USED' | null;
}

/** Người thực hiện thao tác ghi; role quyết định quyền với các field tiền và trạng thái ban đầu. */
export interface RentalProductActor {
  actorUserId: string;
  actorRole: string;
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

/**
 * replacementValue và depositPolicy: bắt buộc khi ADMIN tạo; STAFF_INVENTORY không được gửi
 * (sản phẩm tạo ra ở INACTIVE, chờ ADMIN đặt cọc và giá trị thay thế).
 * grade + gradeGroupId: grade có giá trị và không có gradeGroupId = mở nhóm mới; có gradeGroupId = vào nhóm sẵn có.
 */
export interface CreateRentalProductParams extends RentalProductActor {
  categoryId: string;
  sku: string;
  name: string;
  description?: string | null;
  dailyPrice: number;
  currency: string;
  replacementValue?: number;
  depositPolicy?: {
    type: string;
    amount?: number;
    percentage?: number;
  };
  grade?: 'LIKE_NEW' | 'GOOD_USED';
  gradeGroupId?: string;
  imageMediaIds?: string[];
  spec?: any;
  recommendationTags?: string[];
  requiresDeepInspectionAfterReturn?: boolean;
}

/** Nhóm và hạng không đổi được sau khi tạo (đổi hạng của món đồ đi qua luồng phân hạng, không qua đây). */
export interface UpdateRentalProductParams extends RentalProductActor {
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
  requiresDeepInspectionAfterReturn?: boolean;
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