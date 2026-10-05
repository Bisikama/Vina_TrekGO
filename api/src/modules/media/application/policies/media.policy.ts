import { Injectable } from '@nestjs/common';
import { AppError } from '../../../../shared/errors/app-error';
import { MEDIA_ERROR_CODES } from '../../../../shared/errors/codes/media.error-codes';
import envConfig from '../../../../shared/config';
import { MediaResourceTypeValue, MediaScopeValue } from '../ports/media-asset.port';
import { ProviderAssetMetadata } from '../ports/media-storage.port';

export interface ScopePolicy {
  allowedResourceTypes: MediaResourceTypeValue[];
  requiresProvenance: boolean;
  deliveryType: 'upload' | 'authenticated';
}

@Injectable()
export class MediaPolicyService {
  private readonly allowedImageFormats = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
  private readonly allowedVideoFormats = ['mp4', 'mov', 'webm'];

  private readonly scopePolicies: Record<MediaScopeValue, ScopePolicy> = {
    RENTAL_PRODUCT: {
      allowedResourceTypes: ['IMAGE'],
      requiresProvenance: false,
      deliveryType: 'upload', // public delivery MVP
    },
    CONDITION_EVIDENCE: {
      allowedResourceTypes: ['IMAGE', 'VIDEO'],
      requiresProvenance: true, // required later in M0.5
      deliveryType: 'authenticated',
    },
    RETURN_EVIDENCE: {
      allowedResourceTypes: ['IMAGE', 'VIDEO'],
      requiresProvenance: true,
      deliveryType: 'authenticated',
    },
    EXCEPTION_EVIDENCE: {
      allowedResourceTypes: ['IMAGE', 'VIDEO'],
      requiresProvenance: true,
      deliveryType: 'authenticated',
    },
  };

  getScopePolicy(scope: MediaScopeValue): ScopePolicy {
    return this.scopePolicies[scope];
  }

  validateProviderMetadata(scope: MediaScopeValue, resourceType: MediaResourceTypeValue, metadata: ProviderAssetMetadata): void {
    const policy = this.getScopePolicy(scope);

    // 1. Scope/Resource match
    if (!policy.allowedResourceTypes.includes(resourceType)) {
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_INVALID_RESOURCE_TYPE,
        message: `Resource type ${resourceType} is not allowed for scope ${scope}`,
      });
    }

    // 2. Format validation
    const format = metadata.format.toLowerCase();
    if (resourceType === 'IMAGE') {
      if (!this.allowedImageFormats.includes(format)) {
        throw new AppError({
          code: MEDIA_ERROR_CODES.MEDIA_UNSUPPORTED_FORMAT,
          message: `Unsupported image format: ${format}`,
        });
      }
    } else if (resourceType === 'VIDEO') {
      if (!this.allowedVideoFormats.includes(format)) {
        throw new AppError({
          code: MEDIA_ERROR_CODES.MEDIA_UNSUPPORTED_FORMAT,
          message: `Unsupported video format: ${format}`,
        });
      }
    }

    // 3. Dimensional/Duration Limits
    if (resourceType === 'IMAGE') {
      if (metadata.width == null || metadata.height == null) {
        throw new AppError({
          code: MEDIA_ERROR_CODES.MEDIA_INVALID_MEDIA_METADATA,
          message: 'Image metadata missing width or height',
        });
      }
      if (metadata.width < envConfig.MEDIA_IMAGE_MIN_WIDTH || metadata.height < envConfig.MEDIA_IMAGE_MIN_HEIGHT) {
        throw new AppError({
          code: MEDIA_ERROR_CODES.MEDIA_INVALID_DIMENSIONS,
          message: `Image dimensions below minimum: ${metadata.width}x${metadata.height}`,
        });
      }
      if (metadata.width > envConfig.MEDIA_IMAGE_MAX_WIDTH || metadata.height > envConfig.MEDIA_IMAGE_MAX_HEIGHT) {
        throw new AppError({
          code: MEDIA_ERROR_CODES.MEDIA_INVALID_DIMENSIONS,
          message: `Image dimensions above maximum: ${metadata.width}x${metadata.height}`,
        });
      }
    } else if (resourceType === 'VIDEO') {
      if (metadata.durationMs == null) {
        throw new AppError({
          code: MEDIA_ERROR_CODES.MEDIA_INVALID_MEDIA_METADATA,
          message: 'Video metadata missing duration',
        });
      }
      
      const durationSeconds = metadata.durationMs / 1000;
      if (durationSeconds > envConfig.MEDIA_VIDEO_MAX_DURATION_SECONDS) {
        throw new AppError({
          code: MEDIA_ERROR_CODES.MEDIA_VIDEO_TOO_LONG,
          message: `Video duration exceeds maximum allowed: ${durationSeconds}s`,
        });
      }
      
      // Optional video dimension limits
      if (metadata.width != null && metadata.height != null) {
        if (metadata.width < envConfig.MEDIA_VIDEO_MIN_WIDTH || metadata.height < envConfig.MEDIA_VIDEO_MIN_HEIGHT) {
          throw new AppError({
            code: MEDIA_ERROR_CODES.MEDIA_INVALID_DIMENSIONS,
            message: `Video dimensions below minimum: ${metadata.width}x${metadata.height}`,
          });
        }
        if (metadata.width > envConfig.MEDIA_VIDEO_MAX_WIDTH || metadata.height > envConfig.MEDIA_VIDEO_MAX_HEIGHT) {
          throw new AppError({
            code: MEDIA_ERROR_CODES.MEDIA_INVALID_DIMENSIONS,
            message: `Video dimensions above maximum: ${metadata.width}x${metadata.height}`,
          });
        }
      }
    }
  }
}
