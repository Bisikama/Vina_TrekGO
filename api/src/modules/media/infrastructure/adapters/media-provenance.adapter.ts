import { Injectable, Inject, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { 
  MediaProvenancePort, 
  AnalyzeProvenanceInput, 
  AnalyzeProvenanceResult 
} from '../../application/ports/media-provenance.port';
import type { 
  MediaStoragePort
} from '../../application/ports/media-storage.port';
import { MEDIA_STORAGE_PORT } from '../../application/ports/media-storage.port';
import type { 
  MediaAssetPort
} from '../../application/ports/media-asset.port';
import { MEDIA_ASSET_PORT } from '../../application/ports/media-asset.port';
import envConfig from '../../../../shared/config';

@Injectable()
export class MediaProvenanceAdapter implements MediaProvenancePort {
  private readonly logger = new Logger(MediaProvenanceAdapter.name);

  constructor(
    @Inject(MEDIA_STORAGE_PORT)
    private readonly mediaStoragePort: MediaStoragePort,
    @Inject(MEDIA_ASSET_PORT)
    private readonly mediaAssetPort: MediaAssetPort,
  ) {}

  async analyzeEvidence(input: AnalyzeProvenanceInput): Promise<AnalyzeProvenanceResult> {
    const asset = input.asset;
    const reasons: string[] = [];
    
    let sha256: string | undefined;
    let perceptualHash: string | undefined;
    let exifMetadata: Record<string, unknown> | undefined;
    let exifCapturedAt: Date | undefined;
    const c2paStatus = 'UNSUPPORTED' as const; // Node 20.19.4 does not support the official C2PA node package

    // 1. Compute SHA-256 using original stream
    if (asset.providerPublicId && asset.deliveryType) {
      try {
        const streamResult = await this.mediaStoragePort.openOriginalStream({
          providerPublicId: asset.providerPublicId,
          resourceType: asset.resourceType,
          deliveryType: asset.deliveryType,
        });

        sha256 = await this.computeStreamSha256(streamResult.stream);
        reasons.push('SHA256_COMPUTED');

        // Check for duplicates
        const duplicate = await this.mediaAssetPort.findEvidenceBySha256({
          sha256,
          excludeId: asset.id,
        });

        if (duplicate) {
          reasons.push('SHA256_DUPLICATE');
        }
      } catch (err) {
        this.logger.error(`Failed to compute SHA256 for asset ${asset.id}. Context: ${err instanceof Error ? err.message : 'Unknown error'}`);
        // Do not throw; we just won't have sha256, though for Evidence it might be required.
        // The policy says: temporary provider failure -> controlled error / retryable.
        // Since we stream from provider, if it fails, we should throw to allow retry.
        throw err; 
      }
    }

    // 2. Extract pHash and Metadata (Image only)
    if (asset.resourceType === 'IMAGE' && asset.providerPublicId && asset.deliveryType) {
      try {
        const analysis = await this.mediaStoragePort.getImageAnalysis({
          providerPublicId: asset.providerPublicId,
          deliveryType: asset.deliveryType,
        });

        if (analysis.perceptualHash) {
          perceptualHash = analysis.perceptualHash;
          reasons.push('PHASH_COMPUTED');
        }

        if (analysis.mediaMetadata) {
          exifMetadata = analysis.mediaMetadata;
          reasons.push('EXIF_PRESENT');

          if (exifMetadata.dateTimeOriginal && typeof exifMetadata.dateTimeOriginal === 'string') {
            const parsed = new Date(exifMetadata.dateTimeOriginal);
            if (!Number.isNaN(parsed.getTime())) {
              exifCapturedAt = parsed;
            } else {
              reasons.push('EXIF_CAPTURE_TIME_INVALID');
            }
          }
          if (exifMetadata.software) {
            reasons.push('EDITING_SOFTWARE_PRESENT');
          }
        } else {
          reasons.push('EXIF_MISSING');
        }
      } catch (err) {
        this.logger.error(`Failed to get image analysis for asset ${asset.id}. Context: ${err instanceof Error ? err.message : 'Unknown error'}`);
        throw err; // Technical failure -> retryable
      }
    }

    // 3. C2PA Check
    reasons.push('C2PA_UNSUPPORTED');

    // 4. Timeline and Consistency Analysis
    let provenanceStatus: AnalyzeProvenanceResult['provenanceStatus'] = 'UNKNOWN';

    // Timeline Analysis
    let timeConsistent = false;
    const toleranceMs = (envConfig.MEDIA_PROVENANCE_TIME_TOLERANCE_MINUTES || 30) * 60 * 1000;
    
    if (!input.providerUploadedAt) {
      reasons.push('PROVIDER_TIMESTAMP_UNAVAILABLE');
    }

    if (exifCapturedAt) {
      const exifTimeMs = exifCapturedAt.getTime();
      
      if (input.providerUploadedAt) {
        const providerUploadedAtMs = input.providerUploadedAt.getTime();
        if (exifTimeMs > providerUploadedAtMs + toleranceMs) {
          reasons.push('CAPTURE_TIME_MISMATCH');
        } else {
          reasons.push('CAPTURE_TIME_CONSISTENT');
          timeConsistent = true;
        }
      }
      
      // Compare with client claimed time
      if (asset.clientCapturedAt) {
        const diffClientExif = Math.abs(exifTimeMs - asset.clientCapturedAt.getTime());
        if (diffClientExif <= toleranceMs) {
          reasons.push('CLIENT_EXIF_TIME_CONSISTENT');
          // If provider time was missing, we can consider it consistent with client time
          if (!input.providerUploadedAt) timeConsistent = true;
        } else {
          reasons.push('CLIENT_EXIF_TIME_MISMATCH');
          timeConsistent = false;
        }
      }
    }

    // Determine overall status
    if (asset.captureSource === 'CAMERA') {
      reasons.push('DIRECT_CAMERA_CLAIM');
      if (timeConsistent && exifMetadata && !reasons.includes('CAPTURE_TIME_MISMATCH') && !reasons.includes('CLIENT_EXIF_TIME_MISMATCH')) {
        provenanceStatus = 'DIRECT_CAPTURE';
      } else if (!exifMetadata) {
        provenanceStatus = 'METADATA_MISSING';
      } else if (reasons.includes('CAPTURE_TIME_MISMATCH') || reasons.includes('CLIENT_EXIF_TIME_MISMATCH')) {
        provenanceStatus = 'SUSPICIOUS';
      } else {
        provenanceStatus = 'METADATA_CONSISTENT';
      }
    } else {
      if (exifMetadata && timeConsistent && !reasons.includes('CAPTURE_TIME_MISMATCH')) {
        provenanceStatus = 'METADATA_CONSISTENT';
      } else if (!exifMetadata) {
        provenanceStatus = 'METADATA_MISSING';
      } else if (reasons.includes('CAPTURE_TIME_MISMATCH')) {
        provenanceStatus = 'SUSPICIOUS';
      } else {
        provenanceStatus = 'UNKNOWN';
      }
    }

    // Save the result
    await this.mediaAssetPort.saveProvenanceResult({
      id: asset.id,
      sha256,
      perceptualHash,
      exifMetadata,
      exifCapturedAt,
      c2paStatus,
      provenanceStatus,
      provenanceReasons: reasons,
    });

    return {
      sha256,
      perceptualHash,
      exifMetadata,
      exifCapturedAt,
      c2paStatus,
      provenanceStatus,
      provenanceReasons: reasons,
    };
  }

  private computeStreamSha256(stream: NodeJS.ReadableStream): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex').toLowerCase()));
      stream.on('error', (err) => reject(err instanceof Error ? err : new Error(String(err))));
    });
  }
}
