import { Injectable, Inject, Optional } from '@nestjs/common';
import { AppError } from '../../../../shared/errors/app-error';
import { MEDIA_ERROR_CODES } from '../../../../shared/errors/codes/media.error-codes';
import { COMMON_ERROR_CODES } from '../../../../shared/errors/codes/common.error-codes';
import { MEDIA_ASSET_PORT } from '../ports/media-asset.port';
import type { MediaAssetPort } from '../ports/media-asset.port';
import type { MediaAssetView } from '../ports/media-asset.port';
import { MEDIA_STORAGE_PORT, MediaDeliveryVariant, MediaDeliveryFormat } from '../ports/media-storage.port';
import type { MediaStoragePort } from '../ports/media-storage.port';
import { MediaPolicyService } from '../policies/media.policy';
import type { ActiveUserData } from '../../../../shared/types/user.type';
import envConfig from '../../../../shared/config';
import { MEDIA_REFERENCE_PORT, type MediaReferencePort } from '../ports/media-reference.port';

export interface GetMediaDeliveryUseCaseInput {
  mediaId: string;
  variant: MediaDeliveryVariant;
  format?: MediaDeliveryFormat;
}

@Injectable()
export class GetMediaDeliveryUseCase {
  constructor(
    @Inject(MEDIA_ASSET_PORT) private readonly mediaAssetPort: MediaAssetPort,
    @Inject(MEDIA_STORAGE_PORT) private readonly mediaStoragePort: MediaStoragePort,
    private readonly mediaPolicyService: MediaPolicyService,
    @Optional() @Inject(MEDIA_REFERENCE_PORT) private readonly mediaReferencePort?: MediaReferencePort,
  ) {}

  async execute(input: GetMediaDeliveryUseCaseInput, activeUser?: ActiveUserData) {
    return this.deliver(input, await this.mediaAssetPort.findById({ id: input.mediaId }), activeUser);
  }

  async executeMany(inputs: GetMediaDeliveryUseCaseInput[], activeUser: ActiveUserData) {
    const assets = await this.mediaAssetPort.findByIds(inputs.map(i => i.mediaId));
    const byId = new Map(assets.map(a => [a.id, a]));
    return Promise.all(inputs.map(input => this.deliver(input, byId.get(input.mediaId) ?? null, activeUser)));
  }

  private async deliver(input: GetMediaDeliveryUseCaseInput, asset: MediaAssetView | null, activeUser?: ActiveUserData) {
    if (!envConfig.MEDIA_ENABLED) {
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_PROVIDER_ERROR,
        message: 'Media delivery is currently disabled',
      });
    }

    if (!asset) {
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_NOT_FOUND,
        message: 'Media asset not found',
      });
    }

    if (asset.status !== 'READY') {
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_INVALID_STATE,
        message: 'Cannot deliver media that is not READY',
      });
    }

    if (!asset.providerPublicId || !asset.deliveryType) {
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_INVALID_STATE,
        message: 'Media asset is missing provider data',
      });
    }

    if (asset.scope === 'LEADER_CERTIFICATE') {
      if (!activeUser || activeUser.status !== 'ACTIVE' ||
          (asset.ownerUserId !== activeUser.id && activeUser.role !== 'ADMIN'))
        throw new AppError({ code: 'DOCUMENT_NOT_FOUND' });
      if (input.variant !== 'DOCUMENT_ORIGINAL' || asset.deliveryType !== 'authenticated' || !asset.format)
        throw new AppError({ code: COMMON_ERROR_CODES.VALIDATION_ERROR, message: 'Use DOCUMENT_ORIGINAL for certificates' });
      const result = await this.mediaStoragePort.createDeliveryUrl({
        providerPublicId: asset.providerPublicId, resourceType: asset.resourceType,
        deliveryType: 'authenticated', variant: 'DOCUMENT_ORIGINAL', sourceFormat: asset.format,
      });
      return { mediaId: asset.id, variant: input.variant, resourceType: asset.resourceType,
        url: result.url, expiresAt: result.expiresAt?.toISOString(), format: asset.format };
    }
    if (input.variant === 'DOCUMENT_ORIGINAL')
      throw new AppError({ code: COMMON_ERROR_CODES.VALIDATION_ERROR });

    // Check authorization based on scope
    const policy = this.mediaPolicyService.getScopePolicy(asset.scope);

    if (policy.deliveryType === 'authenticated') {
      if (!activeUser) {
        throw new AppError({
          code: COMMON_ERROR_CODES.UNAUTHENTICATED,
          message: 'Authentication required for this media',
        });
      }

      // Authorization rules for evidence
      // MVP: If you own it or if you are admin/staff
      const isOwner = asset.ownerUserId === activeUser.id;
      const isStaffOrAdmin = ['STAFF_INVENTORY', 'STAFF_DELIVERY', 'ADMIN'].includes(activeUser.role);
      
      const isRentalCaseOwner = !isOwner && !isStaffOrAdmin && activeUser.status === 'ACTIVE' &&
        ['EXCEPTION_EVIDENCE', 'RETURN_EVIDENCE', 'CONDITION_EVIDENCE'].includes(asset.scope) &&
        await this.mediaReferencePort?.isPublishedRentalEvidenceForOwner?.(asset.id, activeUser.id);
      if (!isOwner && !isStaffOrAdmin && !isRentalCaseOwner) {
        throw new AppError({
          code: COMMON_ERROR_CODES.FORBIDDEN,
          message: 'You are not authorized to access this media',
        });
      }
    }

    // Validate if the variant is allowed for the resource type
    if (asset.resourceType === 'VIDEO' && input.variant !== 'VIDEO_PREVIEW') {
      throw new AppError({
        code: COMMON_ERROR_CODES.VALIDATION_ERROR,
        message: `Variant ${input.variant} is not allowed for VIDEO`,
      });
    }

    if (asset.resourceType === 'IMAGE' && input.variant === 'VIDEO_PREVIEW') {
      throw new AppError({
        code: COMMON_ERROR_CODES.VALIDATION_ERROR,
        message: 'VIDEO_PREVIEW is not allowed for IMAGE',
      });
    }

    const isCatalogVariant = input.variant.startsWith('CATALOG_');
    const isEvidenceScope = asset.scope.includes('EVIDENCE');

    if (isCatalogVariant && isEvidenceScope) {
      throw new AppError({
        code: COMMON_ERROR_CODES.VALIDATION_ERROR,
        message: `Variant ${input.variant} is not supported for evidence scope`,
      });
    }

    if (!isCatalogVariant && !isEvidenceScope && input.variant !== 'VIDEO_PREVIEW') {
      throw new AppError({
        code: COMMON_ERROR_CODES.VALIDATION_ERROR,
        message: `Variant ${input.variant} is not supported for catalog scope`,
      });
    }

    // Create delivery URL
    const result = await this.mediaStoragePort.createDeliveryUrl({
      providerPublicId: asset.providerPublicId,
      resourceType: asset.resourceType,
      deliveryType: asset.deliveryType,
      variant: input.variant,
      outputFormat: input.format,
    });

    return {
      mediaId: asset.id,
      variant: input.variant,
      resourceType: asset.resourceType,
      url: result.url,
      expiresAt: result.expiresAt?.toISOString(),
      format: input.format || 'AUTO',
    };
  }
}
