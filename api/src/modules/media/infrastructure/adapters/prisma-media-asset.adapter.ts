import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { MediaAssetPort, MediaAssetView, FindMediaAssetByIdInput, FindOwnedMediaAssetByIdInput, CreatePendingUploadInput, MarkReadyInput } from '../../application/ports/media-asset.port';
import { AppError } from '../../../../shared/errors/app-error';
import { MEDIA_ERROR_CODES } from '../../../../shared/errors/codes/media.error-codes';
import { MediaScopeValue, MediaResourceTypeValue, MediaStatusValue, MediaCaptureSourceValue, MediaProvenanceStatusValue } from '../../application/ports/media-asset.port';

const mediaAssetSelect = {
  id: true,
  scope: true,
  resourceType: true,
  status: true,
  mimeType: true,
  sizeBytes: true,
  width: true,
  height: true,
  durationMs: true,
  captureSource: true,
  provenanceStatus: true,
  readyAt: true,
  uploadIntentExpiresAt: true,
  providerPublicId: true,
  deliveryType: true,
};

type RawMediaAsset = {
  id: string;
  scope: string;
  resourceType: string;
  status: string;
  mimeType: string | null;
  sizeBytes: bigint | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  captureSource: string;
  provenanceStatus: string;
  readyAt: Date | null;
  uploadIntentExpiresAt: Date | null;
  providerPublicId: string | null;
  deliveryType: string | null;
};

@Injectable()
export class PrismaMediaAssetAdapter implements MediaAssetPort {
  constructor(private readonly prisma: PrismaService) {}

  private mapToView(raw: RawMediaAsset): MediaAssetView {
    return {
      id: raw.id,
      scope: raw.scope as MediaScopeValue,
      resourceType: raw.resourceType as MediaResourceTypeValue,
      status: raw.status as MediaStatusValue,
      mimeType: raw.mimeType,
      sizeBytes: raw.sizeBytes != null ? Number(raw.sizeBytes) : null,
      width: raw.width,
      height: raw.height,
      durationMs: raw.durationMs,
      captureSource: raw.captureSource as MediaCaptureSourceValue,
      provenanceStatus: raw.provenanceStatus as MediaProvenanceStatusValue,
      readyAt: raw.readyAt,
      uploadIntentExpiresAt: raw.uploadIntentExpiresAt,
      providerPublicId: raw.providerPublicId,
      deliveryType: raw.deliveryType || 'upload',
    };
  }

  async findById(input: FindMediaAssetByIdInput): Promise<MediaAssetView | null> {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: input.id },
      select: mediaAssetSelect,
    });

    if (!asset) return null;

    return this.mapToView(asset as RawMediaAsset);
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
    return this.mapToView(asset as RawMediaAsset);
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
      },
      select: mediaAssetSelect,
    });
    return this.mapToView(asset as RawMediaAsset);
  }

  async markReady(input: MarkReadyInput): Promise<MediaAssetView> {
    const updateResult = await this.prisma.mediaAsset.updateMany({
      where: {
        id: input.id,
        ownerUserId: input.ownerUserId,
        status: 'PENDING_UPLOAD',
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
        return existing;
      }
      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_INVALID_STATE,
        message: `Cannot complete upload for asset in ${existing.status} state`,
      });
    }

    const updated = await this.findOwnedById({ id: input.id, ownerUserId: input.ownerUserId });
    return updated!;
  }
}
