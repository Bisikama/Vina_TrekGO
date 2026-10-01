export interface RentalProductTransactionData {
  id: string;
  name: string;
  status: string;
  dailyPrice: string;
  currency: string;
  depositPolicyType: string;
  depositValue: string;
  replacementValue: string;
  categoryId: string;
  recommendationTags: string[];
}

export const RENTAL_CATALOG_PORT = Symbol('RENTAL_CATALOG_PORT');

export interface RentalCatalogPort {
  getProductsByIds(productIds: string[]): Promise<RentalProductTransactionData[]>;
  listActiveProducts(categoryId?: string): Promise<RentalProductTransactionData[]>;
}