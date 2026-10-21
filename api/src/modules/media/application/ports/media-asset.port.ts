export const MEDIA_ASSET_PORT = Symbol('MEDIA_ASSET_PORT');

export type MediaProviderValue = 'CLOUDINARY';
export type MediaResourceTypeValue = 'IMAGE' | 'VIDEO';
export type MediaStatusValue = 'PENDING_UPLOAD' | 'PROCESSING' | 'READY' | 'REJECTED' | 'DELETE_PENDING' | 'DELETED';
export type MediaScopeValue = 'RENTAL_PRODUCT' | 'CONDITION_EVIDENCE' | 'RETURN_EVIDENCE' | 'EXCEPTION_EVIDENCE' | 'LEADER_CERTIFICATE';
export type MediaCaptureSourceValue = 'CAMERA' | 'GALLERY' | 'FILE' | 'SYSTEM' | 'UNKNOWN';
export type MediaProvenanceStatusValue = 'DIRECT_CAPTURE' | 'METADATA_CONSISTENT' | 'METADATA_MISSING' | 'SUSPICIOUS' | 'UNKNOWN';
export type MediaC2paStatusValue = 'NOT_CHECKED' | 'NOT_PRESENT' | 'VERIFIED' | 'INVALID' | 'UNSUPPORTED';
export type MediaDeliveryType = 'upload' | 'authenticated';

export interface MediaAssetView {
  format?: string | null;
  id: string;
  ownerUserId: string | null;
  scope: MediaScopeValue;
  resourceType: MediaResourceTypeValue;
  status: MediaStatusValue;
  mimeType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  captureSource: MediaCaptureSourceValue;
  clientCapturedAt: Date | null;
  provenanceStatus: MediaProvenanceStatusValue;
  readyAt: Date | null;
  uploadIntentExpiresAt: Date | null;
  providerPublicId: string | null;
  deliveryType: MediaDeliveryType | null;
  retentionUntil: Date | null;
}

export interface FindMediaAssetByIdInput {
  id: string;
}

export interface CreatePendingUploadInput {
  id: string;
  ownerUserId: string;
  scope: MediaScopeValue;
  resourceType: MediaResourceTypeValue;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  captureSource: MediaCaptureSourceValue;
  clientCapturedAt?: Date;
  providerPublicId: string;
  deliveryType: MediaDeliveryType;
  uploadIntentExpiresAt: Date;
  retentionUntil: Date;
}

export interface MarkReadyInput {
  id: string;
  ownerUserId: string;
  providerAssetId: string;
  providerPublicId: string;
  format: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  secureUrl: string;
  uploadedAt: Date | null;
  retentionUntil: Date | null;
}

export interface MarkRejectedInput {
  id: string;
  ownerUserId?: string; // Optional for admin/cleanup
  reason: string;
  retentionUntil: Date | null;
}

export interface MarkDeletePendingInput {
  id: string;
}

export interface MarkDeletedInput {
  id: string;
}

export interface FindOwnedMediaAssetByIdInput {
  id: string;
  ownerUserId: string;
}

export interface SaveProvenanceResultInput {
  id: string;
  sha256?: string;
  perceptualHash?: string;
  exifMetadata?: Record<string, unknown>;
  exifCapturedAt?: Date | null;
  c2paStatus?: MediaC2paStatusValue;
  provenanceStatus: MediaProvenanceStatusValue;
  provenanceReasons: string[];
}

export interface FindEvidenceBySha256Input {
  sha256: string;
  excludeId?: string; // To avoid comparing with itself
}

export interface ClaimForProcessingInput {
  id: string;
  ownerUserId: string;
}

export interface RevertProcessingToPendingInput {
  id: string;
  reason?: string;
}

export interface FindDeletePendingAssetsInput {
  limit: number;
}

export interface MediaAssetPort {
  findDeletePendingAssets(input: FindDeletePendingAssetsInput): Promise<MediaAssetView[]>;
  findById(input: FindMediaAssetByIdInput): Promise<MediaAssetView | null>;
  findByIds(ids: string[]): Promise<MediaAssetView[]>;
  findOwnedById(input: FindOwnedMediaAssetByIdInput): Promise<MediaAssetView | null>;
  createPendingUpload(input: CreatePendingUploadInput): Promise<MediaAssetView>;
  markReadyFromProcessing(input: MarkReadyInput): Promise<MediaAssetView>;
  markRejectedFromProcessing(input: MarkRejectedInput): Promise<MediaAssetView>;
  markDeletePending(input: MarkDeletePendingInput): Promise<MediaAssetView>;
  markDeleted(input: MarkDeletedInput): Promise<MediaAssetView>;
  saveProvenanceResult(input: SaveProvenanceResultInput): Promise<void>;
  findEvidenceBySha256(input: FindEvidenceBySha256Input): Promise<MediaAssetView | null>;
  claimForProcessing(input: ClaimForProcessingInput): Promise<MediaAssetView>;
  revertProcessingToPending(input: RevertProcessingToPendingInput): Promise<MediaAssetView>;
  clearRetentionUntil?(input: { id: string }): Promise<void>;
}
