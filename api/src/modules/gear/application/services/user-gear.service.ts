import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { AppError } from '../../../../shared/errors/app-error';
import { GEAR_ERROR_CODES } from '../../../../shared/errors/codes/gear.error-codes';
import {
  GearCategory,
  UserGearItemDomain,
  UserGearItemPhotoDomain,
} from '../../domain/gear.types';
import {
  USER_GEAR_REPOSITORY_PORT,
} from '../ports/user-gear.repository.port';
import type { UserGearRepositoryPort } from '../ports/user-gear.repository.port';
import {
  normalizeCreateAttributes,
} from '../dtos/user-gear.dto';
import type {
  CreateUserGearItemInput,
  PatchUserGearItemInput,
} from '../dtos/user-gear.dto';
import {
  MEDIA_ASSET_PORT,
} from '../../../media/application/ports/media-asset.port';
import type {
  MediaAssetPort,
  MediaAssetView,
} from '../../../media/application/ports/media-asset.port';
import { RequestMediaDeletionUseCase } from '../../../media/application/use-cases/request-media-deletion.use-case';

function isUuid(val: string | null | undefined): val is string {
  if (!val || typeof val !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
}

@Injectable()
export class UserGearService {
  private readonly logger = new Logger(UserGearService.name);

  constructor(
    @Inject(USER_GEAR_REPOSITORY_PORT)
    private readonly userGearRepo: UserGearRepositoryPort,
    @Optional()
    @Inject(MEDIA_ASSET_PORT)
    private readonly mediaAssetPort?: MediaAssetPort,
    @Optional()
    private readonly requestMediaDeletionUseCase?: RequestMediaDeletionUseCase,
  ) {}

  /**
   * B04-05: Validates media asset ownership, scope, readiness, MIME format, and 5MB size limit.
   */
  private async validateMediaAsset(mediaId: string, userId: string): Promise<MediaAssetView | null> {
    if (!this.mediaAssetPort) {
      return null;
    }
    const asset = await this.mediaAssetPort.findById({ id: mediaId });
    if (!asset) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, {
        message: 'Không tìm thấy tệp đa phương tiện tương ứng',
      });
    }

    if (asset.ownerUserId !== userId) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_FORBIDDEN, {
        message: 'Không có quyền sử dụng tệp đa phương tiện của người dùng khác',
      });
    }

    if (asset.scope !== 'USER_GEAR') {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CATEGORY_MISMATCH, {
        message: `Phạm vi tệp đa phương tiện phải là USER_GEAR (hiện tại: ${asset.scope})`,
      });
    }

    if (asset.status !== 'READY') {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_DRAFT_NOT_READY, {
        message: `Tệp đa phương tiện chưa sẵn sàng (trạng thái: ${asset.status})`,
      });
    }

    if (asset.sizeBytes !== null && asset.sizeBytes > 5 * 1024 * 1024) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PHOTO_LIMIT_EXCEEDED, {
        message: 'Kích thước tệp ảnh vượt quá giới hạn tối đa 5MB',
      });
    }

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (asset.mimeType && !allowedMimes.includes(asset.mimeType.toLowerCase())) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CATEGORY_MISMATCH, {
        message: `Định dạng tệp ảnh không được hỗ trợ (chỉ chấp nhận JPEG, PNG, WebP)`,
      });
    }

    return asset;
  }

  async createItem(userId: string, input: CreateUserGearItemInput): Promise<UserGearItemDomain> {
    // 1. Normalize attributes for create (missing canonical fields normalized to null)
    let normalizedAttributes: Record<string, unknown>;
    try {
      normalizedAttributes = normalizeCreateAttributes(input.category, input.attributes ?? {});
    } catch (err: any) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CATEGORY_MISMATCH, {
        message: err?.message || 'Thuộc tính kỹ thuật của món đồ không hợp lệ',
        details: { errors: err?.errors || err?.message },
      });
    }

    // 2. Validate media if photoRef or photos provided
    if (input.photoRef) {
      await this.validateMediaAsset(input.photoRef, userId);
    }

    if (input.photos && input.photos.length > 0) {
      for (const p of input.photos) {
        if (isUuid(p.storageRef)) {
          await this.validateMediaAsset(p.storageRef, userId);
        }
      }
    }

    // Sync position 0 photo if photoRef is passed without photos
    let photos = input.photos;
    if (input.photoRef && (!photos || photos.length === 0)) {
      photos = [{ storageRef: input.photoRef, position: 0 }];
    }

    // 3. Delegate to repository inside owner critical section (with limit check & duplicate comparison)
    return this.userGearRepo.create(
      {
        userId,
        name: input.name,
        category: input.category,
        brand: input.brand ?? null,
        condition: input.condition,
        attributes: normalizedAttributes,
        photoRef: input.photoRef ?? null,
        source: 'MANUAL',
        acknowledgeDuplicate: input.acknowledgeDuplicate,
      },
      photos,
    );
  }

  async listItems(userId: string, category?: GearCategory): Promise<UserGearItemDomain[]> {
    return this.userGearRepo.findAllByUser(userId, category);
  }

  async getItem(id: string, userId: string): Promise<UserGearItemDomain> {
    const item = await this.userGearRepo.findByIdAndUser(id, userId);
    if (!item) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, {
        message: 'Món đồ cá nhân không tồn tại hoặc không thuộc quyền sở hữu của bạn',
      });
    }
    return item;
  }

  async patchItem(
    id: string,
    userId: string,
    input: PatchUserGearItemInput,
  ): Promise<UserGearItemDomain> {
    // 1. Reject empty mutation requests (excluding expectedVersion)
    const mutationKeys = Object.keys(input).filter((k) => k !== 'expectedVersion');
    if (mutationKeys.length === 0) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CATEGORY_MISMATCH, {
        message: 'Yêu cầu cập nhật (PATCH) không được để trống',
      });
    }

    // 2. Validate format of attributes if provided
    if (
      input.attributes !== undefined &&
      (input.attributes === null || typeof input.attributes !== 'object' || Array.isArray(input.attributes))
    ) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CATEGORY_MISMATCH, {
        message: 'Thuộc tính attributes phải là một object hợp lệ',
      });
    }

    // 3. Fetch current owned item to verify ownership and check category transition
    const current = await this.getItem(id, userId);

    let patchAttributes: Record<string, unknown> | undefined = input.attributes;

    if (input.category && input.category !== current.category) {
      // Category is changing: input.attributes is mandatory, old category keys discarded
      if (!input.attributes) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CATEGORY_MISMATCH, {
          message: 'Khi thay đổi danh mục, trường attributes là bắt buộc',
        });
      }
      try {
        patchAttributes = normalizeCreateAttributes(input.category, input.attributes);
      } catch (err: any) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CATEGORY_MISMATCH, {
          message: err?.message || 'Thuộc tính không hợp lệ cho danh mục mới',
          details: { errors: err?.errors || err?.message },
        });
      }
    }

    // 4. Validate media asset if photoRef is being updated
    if (input.photoRef) {
      await this.validateMediaAsset(input.photoRef, userId);
    }

    // 5. Execute sparse patch in repository inside CAS retry boundary
    return this.userGearRepo.patch(
      id,
      userId,
      {
        name: input.name,
        category: input.category,
        brand: input.brand,
        condition: input.condition,
        attributes: patchAttributes,
        photoRef: input.photoRef,
      },
      input.expectedVersion,
    );
  }

  async deleteItem(id: string, userId: string): Promise<boolean> {
    const item = await this.getItem(id, userId);

    // Collect all media asset IDs associated with this item prior to cascade
    const mediaIdsToCleanup = [
      item.photoRef,
      ...((item.photos ?? []).map((p) => p.storageRef)),
    ].filter(isUuid);

    // Hard delete from database (photos cascade)
    await this.userGearRepo.delete(id, userId);

    // Durable media cleanup outside database transaction
    if (this.requestMediaDeletionUseCase) {
      for (const mediaId of mediaIdsToCleanup) {
        try {
          await this.requestMediaDeletionUseCase.execute({
            assetId: mediaId,
            requesterUser: { id: userId, role: 'MEMBER' },
          });
        } catch (err: any) {
          this.logger.warn(`Failed to request media deletion for asset ${mediaId}: ${err?.message}`);
        }
      }
    }

    return true;
  }

  async addPhoto(
    itemId: string,
    userId: string,
    storageRef: string,
    position?: number,
  ): Promise<UserGearItemPhotoDomain> {
    await this.getItem(itemId, userId);
    await this.validateMediaAsset(storageRef, userId);
    return this.userGearRepo.addPhoto(itemId, userId, storageRef, position);
  }

  async deletePhoto(itemId: string, photoId: string, userId: string): Promise<boolean> {
    const item = await this.getItem(itemId, userId);
    const photo = (item.photos ?? []).find((p) => p.id === photoId);
    if (!photo) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, {
        message: 'Không tìm thấy ảnh của món đồ',
      });
    }

    await this.userGearRepo.deletePhoto(itemId, photoId, userId);

    if (this.requestMediaDeletionUseCase && isUuid(photo.storageRef)) {
      try {
        await this.requestMediaDeletionUseCase.execute({
          assetId: photo.storageRef,
          requesterUser: { id: userId, role: 'MEMBER' },
        });
      } catch (err: any) {
        this.logger.warn(`Failed to request media deletion for asset ${photo.storageRef}: ${err?.message}`);
      }
    }

    return true;
  }

  async reorderPhotos(
    itemId: string,
    userId: string,
    photoOrders: Array<{ photoId: string; position: number }>,
  ): Promise<UserGearItemPhotoDomain[]> {
    await this.getItem(itemId, userId);
    return this.userGearRepo.reorderPhotos(itemId, userId, photoOrders);
  }
}
