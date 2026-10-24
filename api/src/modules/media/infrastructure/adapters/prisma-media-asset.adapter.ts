import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { 
  MediaAssetPort, MediaAssetView, FindMediaAssetByIdInput, 
  FindOwnedMediaAssetByIdInput, CreatePendingUploadInput, 
  MarkReadyInput, MarkRejectedInput, SaveProvenanceResultInput, FindEvidenceBySha256Input,
  MarkDeletePendingInput, MarkDeletedInput
} from '../../application/ports/media-asset.port';
import { AppError } from '../../../../shared/errors/app-error';
import { MEDIA_ERROR_CODES } from '../../../../shared/errors/codes/media.error-codes';
import { MediaScopeValue, MediaResourceTypeValue, MediaStatusValue, MediaCaptureSourceValue, MediaProvenanceStatusValue, MediaDeliveryType } from '../../application/ports/media-asset.port';

const mediaAssetSelect = {
  format: true,
  id: true,
  ownerUserId: true,
  scope: true,
  resourceType: true,
  status: true,
  mimeType: true,
  sizeBytes: true,
  width: true,
  height: true,
  durationMs: true,
  captureSource: true,
  clientCapturedAt: true,
  provenanceStatus: true,
  readyAt: true,
  uploadIntentExpiresAt: true,
  providerPublicId: true,
  deliveryType: true,
  retentionUntil: true,
};

type RawMediaAsset = {
  format?: string | null;
  id: string;
  ownerUserId: string | null;
  scope: string;
  resourceType: string;
  status: string;
  mimeType: string | null;
  sizeBytes: bigint | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  captureSource: string;
  clientCapturedAt: Date | null;
  provenanceStatus: string;
  readyAt: Date | null;
  uploadIntentExpiresAt: Date | null;
  providerPublicId: string | null;
  deliveryType: string | null;
  retentionUntil?: Date | null;
};

@Injectable()
export class PrismaMediaAssetAdapter implements MediaAssetPort {
  constructor(private readonly prisma: PrismaService) {}

  private mapToView(raw: RawMediaAsset): MediaAssetView {
    return {
      id: raw.id,
      format: raw.format,
      ownerUserId: raw.ownerUserId,
      scope: raw.scope as MediaScopeValue,
      resourceType: raw.resourceType as MediaResourceTypeValue,
      status: raw.status as MediaStatusValue,
      mimeType: raw.mimeType,
      sizeBytes: raw.sizeBytes != null ? Number(raw.sizeBytes) : null,
      width: raw.width,
      height: raw.height,
      durationMs: raw.durationMs,
      captureSource: raw.captureSource as MediaCaptureSourceValue,
      clientCapturedAt: raw.clientCapturedAt,
      provenanceStatus: raw.provenanceStatus as MediaProvenanceStatusValue,
      readyAt: raw.readyAt,
      uploadIntentExpiresAt: raw.uploadIntentExpiresAt,
      providerPublicId: raw.providerPublicId,
      deliveryType: raw.deliveryType as MediaDeliveryType | null,
      retentionUntil: raw.retentionUntil ?? null,
    };
  }

  async findById(input: FindMediaAssetByIdInput): Promise<MediaAssetView | null> {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: input.id },
      select: mediaAssetSelect,
    });

    if (!asset) return null;

    return this.mapToView(asset);
  }

  async findByIds(ids: string[]): Promise<MediaAssetView[]> {
    const assets = await this.prisma.mediaAsset.findMany({ where: { id: { in: ids } }, select: mediaAssetSelect });
    return assets.map(a => this.mapToView(a));
  }
  async findOwnedById(input: FindOwnedMediaAssetByIdInput): Promise<MediaAssetView | null> {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: {
        id: input.id,
        ownerUserId: input.ownerUserId,
      },
      select: mediaAssetSelect,
    });
    if (!asset) {
      return null;
    }
    return this.mapToView(asset);
  }

  async findDeletePendingAssets(input: { limit: number }): Promise<MediaAssetView[]> {
    const now = new Date();
    const assets = await this.prisma.mediaAsset.findMany({
      where: {
        OR: [
          { status: 'DELETE_PENDING' },
          { retentionUntil: { lte: now } },
        ],
        status: { not: 'DELETED' },
      },
      take: input.limit,
      select: mediaAssetSelect,
    });
    return assets.map((a: RawMediaAsset) => this.mapToView(a));
  }

  async createPendingUpload(input: CreatePendingUploadInput): Promise<MediaAssetView> {
    const asset = await this.prisma.mediaAsset.create({
      data: {
        id: input.id,
        ownerUserId: input.ownerUserId,
        provider: 'CLOUDINARY',
        scope: input.scope,
        resourceType: input.resourceType,
        status: 'PENDING_UPLOAD',
        originalFileName: input.originalFileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        captureSource: input.captureSource,
        clientCapturedAt: input.clientCapturedAt,
        providerPublicId: input.providerPublicId,
        deliveryType: input.deliveryType,
        uploadIntentExpiresAt: input.uploadIntentExpiresAt,
        c2paStatus: 'NOT_CHECKED',
        provenanceStatus: 'UNKNOWN',
        retentionUntil: input.retentionUntil,
      },
      select: mediaAssetSelect,
    });
    return this.mapToView(asset);
  }

  async markReadyFromProcessing(input: MarkReadyInput): Promise<MediaAssetView> {
    const updateResult = await this.prisma.mediaAsset.updateMany({
      where: {
        id: input.id,
        ownerUserId: input.ownerUserId,
        status: 'PROCESSING',
      },
      data: {
        status: 'READY',
        providerAssetId: input.providerAssetId,
        providerPublicId: input.providerPublicId,
        format: input.format,
        sizeBytes: input.sizeBytes,
        width: input.width,
        height: input.height,
        durationMs: input.durationMs,
        secureUrl: input.secureUrl,
        uploadedAt: input.uploadedAt,
        readyAt: new Date(),
        version: { increment: 1 },
        retentionUntil: input.retentionUntil,
      },
    });

    if (updateResult.count === 0) {
      const existing = await this.findOwnedById({ id: input.id, ownerUserId: input.ownerUserId });
      if (!existing) {
        throw new AppError({
          code: MEDIA_ERROR_CODES.MEDIA_NOT_FOUND,
          message: 'Media asset not found',
        });
      }
      if (existing.status === 'READY') {
        return this.mapToView(existing as RawMediaAsset);
      }
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_INVALID_STATE,
        message: `Cannot complete upload for asset in ${existing.status} state`,
      });
    }

    const updated = await this.findOwnedById({ id: input.id, ownerUserId: input.ownerUserId });
    return updated!;
  }

  async markRejectedFromProcessing(input: MarkRejectedInput): Promise<MediaAssetView> {
    const whereClause: import('@prisma/client').Prisma.MediaAssetWhereInput = {
      id: input.id,
      status: 'PROCESSING',
    };
    if (input.ownerUserId) {
      whereClause.ownerUserId = input.ownerUserId;
    }

    const updateResult = await this.prisma.mediaAsset.updateMany({
      where: whereClause,
      data: {
        status: 'REJECTED',
        version: { increment: 1 },
        retentionUntil: input.retentionUntil,
      },
    });

    if (updateResult.count === 0) {
      const existing = await this.prisma.mediaAsset.findUnique({
        where: { id: input.id },
        select: mediaAssetSelect,
      });
      if (!existing) {
        throw new AppError({
          code: MEDIA_ERROR_CODES.MEDIA_NOT_FOUND,
          message: 'Media asset not found',
        });
      }
      if (existing.status === 'REJECTED') {
        return this.mapToView(existing);
      }
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_INVALID_STATE,
        message: `Cannot reject asset in ${existing.status} state`,
      });
    }

    const updated = await this.prisma.mediaAsset.findUnique({
      where: { id: input.id },
      select: mediaAssetSelect,
    });
    return this.mapToView(updated as RawMediaAsset);
  }

  async markDeletePending(input: MarkDeletePendingInput): Promise<MediaAssetView> {
    const updated = await this.prisma.mediaAsset.updateMany({
      where: {
        id: input.id,
        status: { in: ['READY', 'REJECTED', 'PENDING_UPLOAD'] },
      },
      data: {
        status: 'DELETE_PENDING',
        deleteRequestedAt: new Date(),
        version: { increment: 1 },
      },
    });

    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: input.id },
      select: mediaAssetSelect,
    });

    if (!asset) {
      throw new AppError({ code: MEDIA_ERROR_CODES.MEDIA_NOT_FOUND, message: 'Media not found' });
    }

    if (asset.status !== 'DELETE_PENDING' && asset.status !== 'DELETED') {
      throw new AppError({ code: MEDIA_ERROR_CODES.MEDIA_INVALID_STATE, message: 'Cannot mark delete pending from current state' });
    }

    return this.mapToView(asset);
  }

  async markDeleted(input: MarkDeletedInput): Promise<MediaAssetView> {
    const updated = await this.prisma.mediaAsset.updateMany({
      where: {
        id: input.id,
        status: 'DELETE_PENDING',
      },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
        version: { increment: 1 },
      },
    });

    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: input.id },
      select: mediaAssetSelect,
    });

    if (!asset) {
      throw new AppError({ code: MEDIA_ERROR_CODES.MEDIA_NOT_FOUND, message: 'Media not found' });
    }

    if (asset.status !== 'DELETED') {
      throw new AppError({ code: MEDIA_ERROR_CODES.MEDIA_INVALID_STATE, message: 'Cannot mark deleted from current state' });
    }

    return this.mapToView(asset);
  }

  async saveProvenanceResult(input: SaveProvenanceResultInput): Promise<void> {
    await this.prisma.mediaAsset.update({
      where: { id: input.id },
      data: {
        sha256: input.sha256,
        perceptualHash: input.perceptualHash,
        exifMetadata: input.exifMetadata ? (input.exifMetadata as import('@prisma/client').Prisma.InputJsonValue) : undefined,
        exifCapturedAt: input.exifCapturedAt,
        c2paStatus: input.c2paStatus,
        provenanceStatus: input.provenanceStatus,
        provenanceReasons: input.provenanceReasons,
        version: { increment: 1 },
      },
    });
  }

  async findEvidenceBySha256(input: FindEvidenceBySha256Input): Promise<MediaAssetView | null> {
    const whereClause: import('@prisma/client').Prisma.MediaAssetWhereInput = {
      sha256: input.sha256,
      scope: {
        in: ['CONDITION_EVIDENCE', 'RETURN_EVIDENCE', 'EXCEPTION_EVIDENCE'],
      },
    };

    if (input.excludeId) {
      whereClause.id = { not: input.excludeId };
    }

    const asset = await this.prisma.mediaAsset.findFirst({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      select: mediaAssetSelect,
    });

    if (!asset) return null;

    return this.mapToView(asset);
  }

  async claimForProcessing(input: import('../../application/ports/media-asset.port').ClaimForProcessingInput): Promise<MediaAssetView> {
    const updated = await this.prisma.mediaAsset.updateMany({
      where: {
        id: input.id,
        ownerUserId: input.ownerUserId,
        status: 'PENDING_UPLOAD',
      },
      data: {
        status: 'PROCESSING',
        version: { increment: 1 },
      },
    });

    if (updated.count === 0) {
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_INVALID_STATE,
        message: 'Cannot claim media asset for processing. It may not be in PENDING_UPLOAD state or you do not have permission.',
      });
    }

    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: input.id },
      select: mediaAssetSelect,
    });

    return this.mapToView(asset as RawMediaAsset);
  }

  async clearRetentionUntil(input: { id: string }): Promise<void> {
    await this.prisma.mediaAsset.updateMany({
      where: { id: input.id },
      data: { retentionUntil: null },
    });
  }

  async revertProcessingToPending(input: import('../../application/ports/media-asset.port').RevertProcessingToPendingInput): Promise<MediaAssetView> {
    const updated = await this.prisma.mediaAsset.updateMany({
      where: {
        id: input.id,
        status: 'PROCESSING',
      },
      data: {
        status: 'PENDING_UPLOAD',
        version: { increment: 1 },
      },
    });

    if (updated.count === 0) {
       throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_INVALID_STATE,
        message: 'Cannot revert to PENDING_UPLOAD because asset is not in PROCESSING state.',
      });
    }
    
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: input.id },
      select: mediaAssetSelect,
    });
    
    return this.mapToView(asset as RawMediaAsset);
  }
}
