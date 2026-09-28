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

export interface MediaStoragePort {
  createUploadIntent(input: CreateUploadIntentInput): Promise<CreateProviderUploadIntentResult>;
  verifyUploadResponse(input: VerifyUploadResponseInput): Promise<boolean>;
  getAssetMetadata(input: GetAssetMetadataInput): Promise<ProviderAssetMetadata | null>;
}
