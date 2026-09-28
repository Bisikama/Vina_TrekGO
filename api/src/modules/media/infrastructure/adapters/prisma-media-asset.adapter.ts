import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/shared/services/prisma.service';
import { MediaAssetPort, MediaAssetView, FindMediaAssetByIdInput } from '../../application/ports/media-asset.port';
import { MediaScopeValue, MediaResourceTypeValue, MediaStatusValue, MediaCaptureSourceValue, MediaProvenanceStatusValue } from '../../application/ports/media-asset.port';

@Injectable()
export class PrismaMediaAssetAdapter implements MediaAssetPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(input: FindMediaAssetByIdInput): Promise<MediaAssetView | null> {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: input.id },
      select: {
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
      },
    });

    if (!asset) return null;

    return {
      id: asset.id,
      scope: asset.scope as MediaScopeValue,
      resourceType: asset.resourceType as MediaResourceTypeValue,
      status: asset.status as MediaStatusValue,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      width: asset.width,
      height: asset.height,
      durationMs: asset.durationMs,
      captureSource: asset.captureSource as MediaCaptureSourceValue,
      provenanceStatus: asset.provenanceStatus as MediaProvenanceStatusValue,
      readyAt: asset.readyAt,
    };
  }
}
