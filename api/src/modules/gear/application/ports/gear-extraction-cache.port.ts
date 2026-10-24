import { GearExtractionCacheDomain } from '../../domain/gear.types';

export const GEAR_EXTRACTION_CACHE_PORT = Symbol('GEAR_EXTRACTION_CACHE_PORT');

export interface LeaseValidationContext {
  resourceKey: string;
  ownerToken: string;
  fencingToken: number;
}

export interface GearExtractionCachePort {
  getCache(
    ownerScope: string,
    contentHash: string,
    promptVersion: string,
    modelVersion: string,
    schemaVersion: string,
  ): Promise<GearExtractionCacheDomain | null>;

  setCache(
    data: Omit<GearExtractionCacheDomain, 'id' | 'createdAt'>,
    leaseValidation?: LeaseValidationContext,
  ): Promise<GearExtractionCacheDomain>;
}
