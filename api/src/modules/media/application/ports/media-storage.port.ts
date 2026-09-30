import { MediaResourceTypeValue } from './media-asset.port';

export const MEDIA_STORAGE_PORT = Symbol('MEDIA_STORAGE_PORT');

export interface CreateUploadIntentInput {
  publicId: string;
  resourceType: MediaResourceTypeValue;
  deliveryType: 'upload' | 'authenticated';
  timestamp: number;
}

export interface CreateProviderUploadIntentResult {
  provider: 'CLOUDINARY';
  uploadUrl: string;
  method: 'POST';
  formFields: {
    api_key: string;
    timestamp: number;
    signature: string;
    public_id: string;
    type: string;
  };
  resourceType: MediaResourceTypeValue;
}

export interface VerifyUploadResponseInput {
  publicId: string;
  version: number;
  signature: string;
}

export interface GetAssetMetadataInput {
  publicId: string;
  resourceType: MediaResourceTypeValue;
  deliveryType: 'upload' | 'authenticated';
}

export interface ProviderAssetMetadata {
  providerAssetId: string;
  providerPublicId: string;
  format: string;
  bytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  secureUrl: string;
  resourceType: 'IMAGE' | 'VIDEO';
  deliveryType: 'upload' | 'authenticated';
  providerUploadedAt?: Date;
}

export type MediaDeliveryVariant = 
  | 'CATALOG_THUMBNAIL' 
  | 'CATALOG_CARD' 
  | 'CATALOG_DETAIL' 
  | 'EVIDENCE_THUMBNAIL' 
  | 'EVIDENCE_PREVIEW' 
  | 'VIDEO_PREVIEW';

export type MediaDeliveryFormat = 'AUTO' | 'WEBP' | 'JPEG';

export interface EnsureDerivativesInput {
  providerPublicId: string;
  resourceType: MediaResourceTypeValue;
  deliveryType: 'upload' | 'authenticated';
  variants: MediaDeliveryVariant[];
}

export interface CreateDeliveryUrlInput {
  providerPublicId: string;
  resourceType: MediaResourceTypeValue;
  deliveryType: 'upload' | 'authenticated';
  variant: MediaDeliveryVariant;
  outputFormat?: MediaDeliveryFormat;
}

export interface CreateDeliveryUrlResult {
  url: string;
  expiresAt?: Date;
}

export interface OpenOriginalStreamInput {
  providerAssetId?: string;
  providerPublicId: string;
  resourceType: MediaResourceTypeValue;
  deliveryType: 'upload' | 'authenticated';
}

export interface OpenOriginalStreamResult {
  stream: NodeJS.ReadableStream;
}

export interface GetImageAnalysisInput {
  providerPublicId: string;
  deliveryType: 'upload' | 'authenticated';
}

export interface GetImageAnalysisResult {
  perceptualHash?: string;
  mediaMetadata?: {
    dateTimeOriginal?: string;
    make?: string;
    model?: string;
    software?: string;
    orientation?: number;
  };
}

export interface DeleteAssetInput {
  providerPublicId: string;
  providerAssetId?: string;
  resourceType: MediaResourceTypeValue;
  deliveryType: 'upload' | 'authenticated';
  invalidate: boolean;
}

export interface MediaStoragePort {
  createUploadIntent(input: CreateUploadIntentInput): Promise<CreateProviderUploadIntentResult>;
  verifyUploadResponse(input: VerifyUploadResponseInput): Promise<boolean>;
  getAssetMetadata(input: GetAssetMetadataInput): Promise<ProviderAssetMetadata | null>;
  ensureDerivatives(input: EnsureDerivativesInput): Promise<void>;
  createDeliveryUrl(input: CreateDeliveryUrlInput): Promise<CreateDeliveryUrlResult>;
  openOriginalStream(input: OpenOriginalStreamInput): Promise<OpenOriginalStreamResult>;
  getImageAnalysis(input: GetImageAnalysisInput): Promise<GetImageAnalysisResult>;
  deleteAsset(input: DeleteAssetInput): Promise<void>;
  
  /**
   * DEV ONLY: Uploads a stream directly to the provider for end-to-end testing.
   */
  simulateDevUpload?(input: { publicId: string, resourceType: MediaResourceTypeValue, deliveryType: 'upload' | 'authenticated', buffer: Buffer }): Promise<{ publicId: string, version: number, signature: string }>;
}
