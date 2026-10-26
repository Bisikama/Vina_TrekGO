import { Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppError } from '../../../../shared/errors/app-error';
import { MEDIA_ERROR_CODES } from '../../../../shared/errors/codes/media.error-codes';
import { COMMON_ERROR_CODES } from '../../../../shared/errors/codes/common.error-codes';
import { MEDIA_ASSET_PORT, MediaScopeValue, MediaResourceTypeValue, MediaCaptureSourceValue } from '../ports/media-asset.port';
import type { MediaAssetPort } from '../ports/media-asset.port';
import { MEDIA_STORAGE_PORT } from '../ports/media-storage.port';
import type { MediaStoragePort } from '../ports/media-storage.port';
import { MediaPolicyService } from '../policies/media.policy';
import envConfig from '../../../../shared/config';
import type { ActiveUserData } from '../../../../shared/types/user.type';

export interface CreateUploadIntentUseCaseInput {
  scope: MediaScopeValue;
  resourceType: MediaResourceTypeValue;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  captureSource?: MediaCaptureSourceValue;
  clientCapturedAt?: string;
}

@Injectable()
export class CreateUploadIntentUseCase {
  constructor(
    @Inject(MEDIA_ASSET_PORT) private readonly mediaAssetPort: MediaAssetPort,
    @Inject(MEDIA_STORAGE_PORT) private readonly mediaStoragePort: MediaStoragePort,
    private readonly mediaPolicyService: MediaPolicyService,
  ) {}

  async execute(dto: CreateUploadIntentUseCaseInput, activeUser: ActiveUserData) {
    if (!envConfig.MEDIA_ENABLED) {
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_PROVIDER_ERROR,
        message: 'Media uploads are currently disabled',
      });
    }

    this.checkScopeAuthorization(dto.scope, activeUser.role);
    if (dto.scope === 'LEADER_CERTIFICATE') {
      if (activeUser.status !== 'ACTIVE' || activeUser.role !== 'USER')
        throw new AppError({ code: COMMON_ERROR_CODES.FORBIDDEN });
      if (dto.resourceType !== 'IMAGE' || !['image/jpeg', 'image/png', 'application/pdf'].includes(dto.contentType))
        throw new AppError({ code: MEDIA_ERROR_CODES.MEDIA_UNSUPPORTED_MIME_TYPE });
    } else this.checkMimeType(dto.contentType, dto.resourceType);
    this.checkSize(dto.sizeBytes, dto.resourceType);

    const policy = this.mediaPolicyService.getScopePolicy(dto.scope);
    if (!policy.allowedResourceTypes.includes(dto.resourceType)) {
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_INVALID_RESOURCE_TYPE,
        message: `Resource type ${dto.resourceType} is not allowed for scope ${dto.scope}`,
      });
    }

    const mediaId = randomUUID();
    const deliveryType = policy.deliveryType;
    const publicId = `trekgo/${dto.scope.toLowerCase().replace(/_/g, '-')}/${mediaId}`;
    
    const now = new Date();
    // 15 minutes TTL
    const uploadIntentExpiresAt = new Date(now.getTime() + 15 * 60 * 1000);

    const asset = await this.mediaAssetPort.createPendingUpload({
      id: mediaId,
      ownerUserId: activeUser.id,
      scope: dto.scope,
      resourceType: dto.resourceType,
      originalFileName: dto.fileName,
      mimeType: dto.contentType,
      sizeBytes: dto.sizeBytes,
      captureSource: dto.captureSource || 'UNKNOWN',
      clientCapturedAt: dto.clientCapturedAt ? new Date(dto.clientCapturedAt) : undefined,
      providerPublicId: publicId,
      deliveryType,
      uploadIntentExpiresAt,
      retentionUntil: new Date(now.getTime() + envConfig.MEDIA_PENDING_UPLOAD_RETENTION_HOURS * 3600 * 1000),
    });

    try {
      const intentResult = await this.mediaStoragePort.createUploadIntent({
        publicId,
        resourceType: dto.resourceType,
        deliveryType,
        timestamp: Math.round(now.getTime() / 1000),
        ...(dto.scope === 'LEADER_CERTIFICATE' ? { immutable: true } : {}),
      });

      return {
        mediaId: asset.id,
        status: asset.status,
        expiresAt: uploadIntentExpiresAt.toISOString(),
        provider: 'CLOUDINARY',
        upload: intentResult,
      };
    } catch (error) {
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_PROVIDER_ERROR,
        message: 'Failed to create provider upload intent',
      });
    }
  }

  private checkScopeAuthorization(scope: MediaScopeValue, role: string) {
    const isAllowed = (() => {
      switch (scope) {
        case 'LEADER_CERTIFICATE':
          return role === 'USER';
        case 'USER_GEAR':
          return role === 'USER';
        case 'RENTAL_PRODUCT':
          return ['STAFF_INVENTORY', 'ADMIN'].includes(role);
        case 'CONDITION_EVIDENCE':
          return ['STAFF_INVENTORY'].includes(role);
        case 'RETURN_EVIDENCE':
          return ['STAFF_INVENTORY', 'STAFF_DELIVERY'].includes(role);
        case 'EXCEPTION_EVIDENCE':
          return ['USER', 'LEADER', 'STAFF_INVENTORY', 'STAFF_DELIVERY', 'ADMIN'].includes(role);
        case 'USER_GEAR':
          return ['USER', 'LEADER', 'STAFF_INVENTORY', 'STAFF_DELIVERY', 'ADMIN'].includes(role);
        default:
          return false;
      }
    })();

    if (!isAllowed) {
      throw new AppError({
        code: COMMON_ERROR_CODES.FORBIDDEN,
        message: `Role ${role} is not authorized for scope ${scope}`,
      });
    }
  }

  private checkMimeType(mimeType: string, resourceType: MediaResourceTypeValue) {
    const imageMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    const videoMimes = ['video/mp4', 'video/quicktime', 'video/webm'];

    if (resourceType === 'IMAGE' && !imageMimes.includes(mimeType)) {
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_UNSUPPORTED_MIME_TYPE,
        message: 'Unsupported image MIME type',
      });
    }

    if (resourceType === 'VIDEO' && !videoMimes.includes(mimeType)) {
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_UNSUPPORTED_MIME_TYPE,
        message: 'Unsupported video MIME type',
      });
    }
  }

  private checkSize(sizeBytes: number, resourceType: MediaResourceTypeValue) {
    if (resourceType === 'IMAGE' && sizeBytes > envConfig.MEDIA_MAX_IMAGE_BYTES) {
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_FILE_TOO_LARGE,
        message: `Image exceeds maximum size of ${envConfig.MEDIA_MAX_IMAGE_BYTES} bytes`,
      });
    }

    if (resourceType === 'VIDEO' && sizeBytes > envConfig.MEDIA_MAX_VIDEO_BYTES) {
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_FILE_TOO_LARGE,
        message: `Video exceeds maximum size of ${envConfig.MEDIA_MAX_VIDEO_BYTES} bytes`,
      });
    }
  }
}
