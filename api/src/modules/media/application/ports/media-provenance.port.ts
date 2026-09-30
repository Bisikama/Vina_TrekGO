import { MediaAssetView } from './media-asset.port';

export const MEDIA_PROVENANCE_PORT = Symbol('MEDIA_PROVENANCE_PORT');

export interface AnalyzeProvenanceInput {
  asset: MediaAssetView;
  providerUploadedAt?: Date;
}

export interface AnalyzeProvenanceResult {
  sha256?: string;
  perceptualHash?: string;
  exifMetadata?: Record<string, unknown>;
  exifCapturedAt?: Date | null;
  c2paStatus?: 'NOT_CHECKED' | 'NOT_PRESENT' | 'VERIFIED' | 'INVALID' | 'UNSUPPORTED';
  provenanceStatus: 'DIRECT_CAPTURE' | 'METADATA_CONSISTENT' | 'METADATA_MISSING' | 'SUSPICIOUS' | 'UNKNOWN';
  provenanceReasons: string[];
}

export interface MediaProvenancePort {
  analyzeEvidence(input: AnalyzeProvenanceInput): Promise<AnalyzeProvenanceResult>;
}
