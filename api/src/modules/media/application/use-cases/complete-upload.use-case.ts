import { Injectable, Inject } from '@nestjs/common';
import { AppError } from '../../../../shared/errors/app-error';
import { MEDIA_ERROR_CODES } from '../../../../shared/errors/codes/media.error-codes';
import { MEDIA_ASSET_PORT } from '../ports/media-asset.port';
import type { MediaAssetPort } from '../ports/media-asset.port';
import { MEDIA_STORAGE_PORT } from '../ports/media-storage.port';
import type { MediaStoragePort } from '../ports/media-storage.port';
import type { ActiveUserData } from '../../../../shared/types/user.type';
import envConfig from '../../../../shared/config';

export interface CompleteUploadUseCaseInput {
  publicId: string;
  version: number;
  signature: string;
}

@Injectable()
export class CompleteUploadUseCase {
  constructor(
    @Inject(MEDIA_ASSET_PORT) private readonly mediaAssetPort: MediaAssetPort,
    @Inject(MEDIA_STORAGE_PORT) private readonly mediaStoragePort: MediaStoragePort,
  ) {}

  async execute(mediaId: string, input: CompleteUploadUseCaseInput, activeUser: ActiveUserData) {
    if (!envConfig.MEDIA_ENABLED) {
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_PROVIDER_ERROR,
        message: 'Media uploads are currently disabled',
      });
    }

    const asset = await this.mediaAssetPort.findOwnedById({
      id: mediaId,
      ownerUserId: activeUser.id,
    });

    if (!asset) {
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_NOT_FOUND,
        message: 'Media asset not found',
      });
    }

    if (asset.status === 'READY') {
      return asset;
    }

    if (asset.status !== 'PENDING_UPLOAD') {
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_INVALID_STATE,
        message: `Cannot complete upload for asset in ${asset.status} state`,
      });
    }

    if (!asset.providerPublicId || !asset.deliveryType) {
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_INVALID_STATE,
        message: 'Cannot complete upload for asset missing provider metadata',
      });
    }

    const now = new Date();
    const expiresAt = asset.uploadIntentExpiresAt;
    if (expiresAt && now > expiresAt) {
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_UPLOAD_EXPIRED,
        message: 'Upload intent has expired',
      });
    }

    // Verify Cloudinary Response Signature
    const isValidSignature = await this.mediaStoragePort.verifyUploadResponse({
      publicId: input.publicId,
      version: input.version,
      signature: input.signature,
    });

    if (!isValidSignature) {
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_UPLOAD_SIGNATURE_INVALID,
        message: 'Invalid provider upload signature',
      });
    }

    const providerPublicId = asset.providerPublicId;
    if (providerPublicId !== input.publicId) {
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_PROVIDER_MISMATCH,
        message: 'Public ID mismatch',
      });
    }

    // Get Canonical Metadata
    const metadata = await this.mediaStoragePort.getAssetMetadata({
      publicId: input.publicId,
      resourceType: asset.resourceType,
      deliveryType: asset.deliveryType,
    });

    if (!metadata) {
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_PROVIDER_MISMATCH,
        message: 'Provider asset not found in storage',
      });
    }

    if (metadata.providerPublicId !== input.publicId) {
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_PROVIDER_MISMATCH,
        message: 'Canonical public ID mismatch',
      });
    }

    if (metadata.resourceType !== asset.resourceType) {
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_PROVIDER_MISMATCH,
        message: 'Canonical resource type mismatch',
      });
    }

    if (metadata.deliveryType !== asset.deliveryType) {
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_PROVIDER_MISMATCH,
        message: 'Canonical delivery type mismatch',
      });
    }

    // Check size limit from canonical data
    const maxBytes = asset.resourceType === 'IMAGE' ? envConfig.MEDIA_MAX_IMAGE_BYTES : envConfig.MEDIA_MAX_VIDEO_BYTES;
    if (metadata.bytes > maxBytes) {
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_FILE_TOO_LARGE,
        message: 'Uploaded file size exceeds the allowed limit',
      });
    }

    // Mark Ready
    const updatedAsset = await this.mediaAssetPort.markReady({
      id: mediaId,
      ownerUserId: activeUser.id,
      providerAssetId: metadata.providerAssetId,
      providerPublicId: metadata.providerPublicId,
      format: metadata.format,
      sizeBytes: metadata.bytes,
      width: metadata.width,
      height: metadata.height,
      durationMs: metadata.durationMs,
      secureUrl: metadata.secureUrl,
      uploadedAt: metadata.providerUploadedAt || now,
    });

    return updatedAsset;
  }
}
