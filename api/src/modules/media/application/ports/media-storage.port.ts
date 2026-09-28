export const MEDIA_STORAGE_PORT = Symbol('MEDIA_STORAGE_PORT');

export interface CreateUploadIntentInput {
  // Conceptual for future
}

export interface MediaStoragePort {
  // In M0.1 it is acceptable for this port to be defined without full Cloudinary implementation.
  // Conceptual methods:
  // createUploadIntent(input: CreateUploadIntentInput): Promise<any>;
  // verifyUpload(assetId: string): Promise<any>;
  // getAssetMetadata(assetId: string): Promise<any>;
  // deleteAsset(assetId: string): Promise<any>;
  // createDeliveryUrl(assetId: string): Promise<string>;
}
