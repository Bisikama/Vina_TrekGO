import { Injectable, Inject, Logger } from '@nestjs/common';
import type { MediaAssetPort } from '../ports/media-asset.port';
import { MEDIA_ASSET_PORT } from '../ports/media-asset.port';
import type { MediaReferencePort } from '../ports/media-reference.port';
import { MEDIA_REFERENCE_PORT } from '../ports/media-reference.port';
import type { MediaStoragePort } from '../ports/media-storage.port';
import { MEDIA_STORAGE_PORT } from '../ports/media-storage.port';
import { AppError } from '../../../../shared/errors/app-error';
import { MEDIA_ERROR_CODES } from '../../../../shared/errors/codes/media.error-codes';
import { COMMON_ERROR_CODES } from '../../../../shared/errors/codes/common.error-codes';

export interface RequestMediaDeletionInput {
  assetId: string;
  requesterUser: { id: string; role: string };
}

@Injectable()
export class RequestMediaDeletionUseCase {
  private readonly logger = new Logger(RequestMediaDeletionUseCase.name);

  constructor(
    @Inject(MEDIA_ASSET_PORT) private readonly mediaAssetPort: MediaAssetPort,
    @Inject(MEDIA_REFERENCE_PORT) private readonly mediaReferencePort: MediaReferencePort,
    @Inject(MEDIA_STORAGE_PORT) private readonly mediaStoragePort: MediaStoragePort,
  ) {}

  async execute(input: RequestMediaDeletionInput): Promise<void> {
    const asset = await this.mediaAssetPort.findById({ id: input.assetId });

    if (!asset) {
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_NOT_FOUND,
        message: 'Media asset not found or access denied',
      });
    }

    const isOwner = asset.ownerUserId === input.requesterUser.id;
    const role = input.requesterUser.role;
    const isAdmin = role === 'ADMIN';
    let canDelete = isOwner || isAdmin;

    if (!canDelete) {
      switch (asset.scope) {
        case 'RENTAL_PRODUCT':
          canDelete = role === 'STAFF_INVENTORY';
          break;
        case 'CONDITION_EVIDENCE':
          canDelete = role === 'STAFF_INVENTORY';
          break;
        case 'RETURN_EVIDENCE':
        case 'EXCEPTION_EVIDENCE':
          canDelete = role === 'STAFF_INVENTORY' || role === 'STAFF_DELIVERY';
          break;
      }
    }

    if (!canDelete) {
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_NOT_FOUND,
        message: 'Media asset not found or access denied',
      });
    }

    if (asset.status === 'DELETED') {
      return; // Idempotent
    }

    if (asset.retentionUntil && asset.retentionUntil > new Date()) {
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_INVALID_STATE,
        message: 'Cannot delete media asset because its retention period has not expired',
      });
    }

    if (asset.status !== 'READY' && asset.status !== 'REJECTED' && asset.status !== 'PENDING_UPLOAD' && asset.status !== 'DELETE_PENDING') {
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_INVALID_STATE,
        message: `Cannot request deletion for asset in ${asset.status} state`,
      });
    }

    // Step 1: Check active references in Rental entities (only if not already pending delete)
    if (asset.status === 'READY') {
      const isReferenced = await this.mediaReferencePort.hasActiveReferences(asset.id);
      if (isReferenced) {
        throw new AppError({
          code: MEDIA_ERROR_CODES.MEDIA_INVALID_STATE, 
          message: 'Cannot delete media asset because it is currently referenced by active records',
        });
      }
    }

    // Step 2: Mark as DELETE_PENDING
    if (asset.status !== 'DELETE_PENDING') {
      await this.mediaAssetPort.markDeletePending({ id: asset.id });
    }

    // Step 3: Physically delete from Cloudinary
    if (asset.providerPublicId) {
      if (!asset.deliveryType) {
        throw new AppError({
          code: MEDIA_ERROR_CODES.MEDIA_INVALID_STATE,
          message: 'Cannot delete asset with provider public ID but missing delivery type',
        });
      }

      try {
        await this.mediaStoragePort.deleteAsset({
          providerPublicId: asset.providerPublicId,
          resourceType: asset.resourceType,
          deliveryType: asset.deliveryType,
          invalidate: true,
        });
      } catch (error) {
        this.logger.error(`Failed to delete asset ${asset.providerPublicId} from provider during request. Context: ${error instanceof Error ? error.message : 'Unknown error'}`, {
          assetId: asset.id
        });
        throw new AppError({
          code: MEDIA_ERROR_CODES.MEDIA_PROVIDER_ERROR,
          message: 'Provider deletion failed. State remains DELETE_PENDING.',
          retryable: true,
        });
      }
    }

    // Step 4: If physical deletion succeeds (or no provider public ID exists), mark DELETED tombstone
    await this.mediaAssetPort.markDeleted({ id: asset.id });
  }
}
