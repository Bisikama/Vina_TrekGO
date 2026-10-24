import {
  GearExtractionDraftDomain,
  GearExtractionSourceType,
  GearExtractionStatus,
  UserGearItemDomain,
} from '../../domain/gear.types';

export const GEAR_EXTRACTION_DRAFT_REPOSITORY_PORT = Symbol('GEAR_EXTRACTION_DRAFT_REPOSITORY_PORT');

export interface CreateDraftInput {
  userId: string;
  sourceType: GearExtractionSourceType;
  sourceHash: string;
  expiresAt: Date;
}

export interface ConfirmDraftResult {
  item: UserGearItemDomain;
  replayed: boolean;
}

export interface GearExtractionDraftRepositoryPort {
  createDraft(input: CreateDraftInput): Promise<GearExtractionDraftDomain>;
  findByIdAndUser(id: string, userId: string): Promise<GearExtractionDraftDomain | null>;
  updateExtractedData(
    id: string,
    extractedData: Record<string, unknown>,
    status: GearExtractionStatus,
    expectedVersion?: number,
  ): Promise<GearExtractionDraftDomain>;
  confirmDraft(
    draftId: string,
    userId: string,
    payloadHash: string,
    itemData: Omit<UserGearItemDomain, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
    expectedVersion?: number,
  ): Promise<ConfirmDraftResult>;
}
