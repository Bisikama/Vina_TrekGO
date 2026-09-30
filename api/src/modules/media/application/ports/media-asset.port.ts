export const MEDIA_ASSET_PORT = Symbol('MEDIA_ASSET_PORT');

export type MediaProviderValue = 'CLOUDINARY';
export type MediaResourceTypeValue = 'IMAGE' | 'VIDEO';
export type MediaStatusValue = 'PENDING_UPLOAD' | 'PROCESSING' | 'READY' | 'REJECTED' | 'DELETE_PENDING' | 'DELETED';
export type MediaScopeValue = 'RENTAL_PRODUCT' | 'CONDITION_EVIDENCE' | 'RETURN_EVIDENCE' | 'EXCEPTION_EVIDENCE';
export type MediaCaptureSourceValue = 'CAMERA' | 'GALLERY' | 'FILE' | 'SYSTEM' | 'UNKNOWN';
export type MediaProvenanceStatusValue = 'DIRECT_CAPTURE' | 'METADATA_CONSISTENT' | 'METADATA_MISSING' | 'SUSPICIOUS' | 'UNKNOWN';
export type MediaC2paStatusValue = 'NOT_CHECKED' | 'NOT_PRESENT' | 'VERIFIED' | 'INVALID' | 'UNSUPPORTED';
export type MediaDeliveryType = 'upload' | 'authenticated';

export interface MediaAssetView {
  id: string;
  scope: MediaScopeValue;
  resourceType: MediaResourceTypeValue;
  status: MediaStatusValue;
  mimeType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  captureSource: MediaCaptureSourceValue;
  provenanceStatus: MediaProvenanceStatusValue;
  readyAt: Date | null;
  uploadIntentExpiresAt: Date | null;
  providerPublicId: string | null;
  deliveryType: MediaDeliveryType | null;
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
}

export interface FindOwnedMediaAssetByIdInput {
  id: string;
  ownerUserId: string;
}

export interface MediaAssetPort {
  findById(input: FindMediaAssetByIdInput): Promise<MediaAssetView | null>;
  findOwnedById(input: FindOwnedMediaAssetByIdInput): Promise<MediaAssetView | null>;
  createPendingUpload(input: CreatePendingUploadInput): Promise<MediaAssetView>;
  markReady(input: MarkReadyInput): Promise<MediaAssetView>;
}
