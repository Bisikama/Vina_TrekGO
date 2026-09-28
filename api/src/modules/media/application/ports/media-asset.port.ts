export const MEDIA_ASSET_PORT = Symbol('MEDIA_ASSET_PORT');

export type MediaProviderValue = 'CLOUDINARY';
export type MediaResourceTypeValue = 'IMAGE' | 'VIDEO';
export type MediaStatusValue = 'PENDING_UPLOAD' | 'PROCESSING' | 'READY' | 'REJECTED' | 'DELETE_PENDING' | 'DELETED';
export type MediaScopeValue = 'RENTAL_PRODUCT' | 'CONDITION_EVIDENCE' | 'RETURN_EVIDENCE' | 'EXCEPTION_EVIDENCE';
export type MediaCaptureSourceValue = 'CAMERA' | 'GALLERY' | 'FILE' | 'SYSTEM' | 'UNKNOWN';
export type MediaProvenanceStatusValue = 'DIRECT_CAPTURE' | 'METADATA_CONSISTENT' | 'METADATA_MISSING' | 'SUSPICIOUS' | 'UNKNOWN';
export type MediaC2paStatusValue = 'NOT_CHECKED' | 'NOT_PRESENT' | 'VERIFIED' | 'INVALID' | 'UNSUPPORTED';

export interface MediaAssetView {
  id: string;
  scope: MediaScopeValue;
  resourceType: MediaResourceTypeValue;
  status: MediaStatusValue;
  mimeType: string | null;
  sizeBytes: bigint | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  captureSource: MediaCaptureSourceValue;
  provenanceStatus: MediaProvenanceStatusValue;
  readyAt: Date | null;
}

export interface FindMediaAssetByIdInput {
  id: string;
}

export interface MediaAssetPort {
  findById(input: FindMediaAssetByIdInput): Promise<MediaAssetView | null>;
  // Future: create(...), updateStatus(...), etc. will be added when needed.
}
