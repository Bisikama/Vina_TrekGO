import { GearCategory, ProductTechnicalProfileDomain } from '../../domain/gear.types';

export const PRODUCT_TECHNICAL_PROFILE_REPOSITORY_PORT = Symbol('PRODUCT_TECHNICAL_PROFILE_REPOSITORY_PORT');

export interface ProductTechnicalProfileRepositoryPort {
  findByProductId(productId: string): Promise<ProductTechnicalProfileDomain | null>;
  upsertProfile(
    productId: string,
    category: GearCategory,
    attributes: Record<string, unknown>,
    expectedVersion?: number,
    schemaVersion?: string,
    sources?: Record<string, unknown>,
    actorId?: string,
  ): Promise<ProductTechnicalProfileDomain>;
}
