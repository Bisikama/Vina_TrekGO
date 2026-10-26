import { Injectable, Inject } from '@nestjs/common';
import { AppError } from '../../../../shared/errors/app-error';
import { MEDIA_ERROR_CODES } from '../../../../shared/errors/codes/media.error-codes';
import { MEDIA_ASSET_PORT } from '../ports/media-asset.port';
import type { MediaAssetPort } from '../ports/media-asset.port';
import { MEDIA_STORAGE_PORT } from '../ports/media-storage.port';
import type { MediaStoragePort } from '../ports/media-storage.port';
import type { ActiveUserData } from '../../../../shared/types/user.type';
import envConfig from '../../../../shared/config';
import { MediaPolicyService } from '../policies/media.policy';
import { MEDIA_PROVENANCE_PORT } from '../ports/media-provenance.port';
import type { MediaProvenancePort } from '../ports/media-provenance.port';

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
    @Inject(MEDIA_PROVENANCE_PORT) private readonly mediaProvenancePort: MediaProvenancePort,
    private readonly mediaPolicyService: MediaPolicyService,
  ) {}

  async execute(mediaId: string, input: CompleteUploadUseCaseInput, activeUser: ActiveUserData) {
    if (!envConfig.MEDIA_ENABLED) {
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_PROVIDER_ERROR,
        message: 'Media uploads are currently disabled',
      });
    }

    let asset = await this.mediaAssetPort.findOwnedById({
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

    // ATOMIC CLAIM
    asset = await this.mediaAssetPort.claimForProcessing({
      id: mediaId,
      ownerUserId: activeUser.id,
    });

    try {

    // Verify Cloudinary Response Signature
    const isValidSignature = await this.mediaStoragePort.verifyUploadResponse({
      publicId: input.publicId,
      version: input.version,
      signature: input.signature,
    });

    if (!isValidSignature) {
      await this.mediaAssetPort.markRejectedFromProcessing({ 
        id: mediaId, 
        ownerUserId: activeUser.id, 
        reason: 'Invalid provider upload signature',
        retentionUntil: new Date(Date.now() + envConfig.MEDIA_REJECTED_RETENTION_HOURS * 3600 * 1000),
      });
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_UPLOAD_SIGNATURE_INVALID,
        message: 'Invalid provider upload signature',
      });
    }

    const providerPublicId = asset.providerPublicId;
    if (providerPublicId !== input.publicId) {
      await this.mediaAssetPort.markRejectedFromProcessing({ id: mediaId, ownerUserId: activeUser.id, reason: 'Public ID mismatch', retentionUntil: new Date(Date.now() + envConfig.MEDIA_REJECTED_RETENTION_HOURS * 3600 * 1000) });
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_PROVIDER_MISMATCH,
        message: 'Public ID mismatch',
      });
    }

    // Get Canonical Metadata
    const metadata = await this.mediaStoragePort.getAssetMetadata({
      publicId: input.publicId,
      resourceType: asset.resourceType,
      deliveryType: asset.deliveryType as 'upload' | 'authenticated',
    });

    if (!metadata) {
      // Technical failure - maybe not yet available
      throw new Error('Provider asset not found in storage (technical failure)');
    }

    if (metadata.providerPublicId !== input.publicId) {
      await this.mediaAssetPort.markRejectedFromProcessing({ id: mediaId, ownerUserId: activeUser.id, reason: 'Canonical public ID mismatch', retentionUntil: new Date(Date.now() + envConfig.MEDIA_REJECTED_RETENTION_HOURS * 3600 * 1000) });
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_PROVIDER_MISMATCH,
        message: 'Canonical public ID mismatch',
      });
    }

    if (metadata.resourceType !== asset.resourceType) {
      await this.mediaAssetPort.markRejectedFromProcessing({ id: mediaId, ownerUserId: activeUser.id, reason: 'Canonical resource type mismatch', retentionUntil: new Date(Date.now() + envConfig.MEDIA_REJECTED_RETENTION_HOURS * 3600 * 1000) });
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_PROVIDER_MISMATCH,
        message: 'Canonical resource type mismatch',
      });
    }

    if (metadata.deliveryType !== asset.deliveryType) {
      await this.mediaAssetPort.markRejectedFromProcessing({ id: mediaId, ownerUserId: activeUser.id, reason: 'Canonical delivery type mismatch', retentionUntil: new Date(Date.now() + envConfig.MEDIA_REJECTED_RETENTION_HOURS * 3600 * 1000) });
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_PROVIDER_MISMATCH,
        message: 'Canonical delivery type mismatch',
      });
    }

    // Validate Canonical Format/Dimensions/Duration using MediaPolicy
    // Validate Canonical Format/Dimensions/Duration using MediaPolicy
    try {
      this.mediaPolicyService.validateProviderMetadata(asset.scope, asset.resourceType, metadata);

      // Check size limit from canonical data
      const maxBytes = asset.resourceType === 'IMAGE' ? envConfig.MEDIA_MAX_IMAGE_BYTES : envConfig.MEDIA_MAX_VIDEO_BYTES;
      if (metadata.bytes > maxBytes) {
        throw new AppError({
          code: MEDIA_ERROR_CODES.MEDIA_FILE_TOO_LARGE,
          message: 'Uploaded file size exceeds the allowed limit',
        });
      }
    } catch (error) {
      if (error instanceof AppError) {
        await this.mediaAssetPort.markRejectedFromProcessing({
          id: mediaId,
          ownerUserId: activeUser.id,
          reason: error.message,
          retentionUntil: new Date(Date.now() + envConfig.MEDIA_REJECTED_RETENTION_HOURS * 3600 * 1000),
        });
        throw error;
      }
      throw error;
    }

    if (asset.deliveryType === 'authenticated' && asset.scope !== 'LEADER_CERTIFICATE') {
      const variants: import('../ports/media-storage.port').MediaDeliveryVariant[] = 
        asset.resourceType === 'IMAGE' ? ['EVIDENCE_THUMBNAIL', 'EVIDENCE_PREVIEW'] : ['VIDEO_PREVIEW'];
      
      await this.mediaStoragePort.ensureDerivatives({
        providerPublicId: metadata.providerPublicId,
        resourceType: asset.resourceType,
        deliveryType: asset.deliveryType,
        variants,
      });
    }

    // M0.5: Provenance Analysis for Evidence IMAGE
    // Run BEFORE markReady.
    if (asset.scope?.includes('EVIDENCE') && asset.resourceType === 'IMAGE') {
      await this.mediaProvenancePort.analyzeEvidence({ 
        asset,
        providerUploadedAt: metadata.providerUploadedAt
      });
    }

    let retentionUntil: Date | null = null;
    if (asset.scope === 'RENTAL_PRODUCT' || asset.scope === 'LEADER_CERTIFICATE' || asset.scope === 'USER_GEAR') {
      retentionUntil = new Date(Date.now() + envConfig.MEDIA_CATALOG_ORPHAN_RETENTION_DAYS * 86400 * 1000);
    } else if (asset.scope?.includes('EVIDENCE')) {
      retentionUntil = new Date(Date.now() + envConfig.MEDIA_EVIDENCE_RETENTION_DAYS * 86400 * 1000);
    }

    const updatedAsset = await this.mediaAssetPort.markReadyFromProcessing({
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
      retentionUntil,
    });

    return updatedAsset;
    } catch (error) {
      try {
        await this.mediaAssetPort.revertProcessingToPending({ id: mediaId, reason: error instanceof Error ? error.message : 'Unknown' });
      } catch (revertErr) {
        // Ignore revert error if it was already marked REJECTED or READY
      }

      if (error instanceof Error && error.message.includes('(technical failure)')) {
         throw new AppError({
            code: MEDIA_ERROR_CODES.MEDIA_PROVIDER_ERROR,
            message: 'Provider asset metadata temporary lookup failure',
         });
      }

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_PROVIDER_ERROR,
        message: 'Provider operation failed, please try again',
      });
    }
  }
}
