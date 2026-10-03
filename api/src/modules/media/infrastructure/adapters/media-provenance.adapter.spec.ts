import { MediaProvenanceAdapter } from './media-provenance.adapter';
import { MediaStoragePort } from '../../application/ports/media-storage.port';
import { MediaAssetPort, MediaAssetView } from '../../application/ports/media-asset.port';
import { Readable } from 'stream';
import { AppError } from '../../../../shared/errors/app-error';

describe('MediaProvenanceAdapter', () => {
  let adapter: MediaProvenanceAdapter;
  let mockStoragePort: jest.Mocked<MediaStoragePort>;
  let mockAssetPort: jest.Mocked<MediaAssetPort>;

  beforeEach(() => {
    mockStoragePort = {
      openOriginalStream: jest.fn(),
      getImageAnalysis: jest.fn(),
    } as unknown as jest.Mocked<MediaStoragePort>;

    mockAssetPort = {
      findEvidenceBySha256: jest.fn(),
      saveProvenanceResult: jest.fn(),
    } as unknown as jest.Mocked<MediaAssetPort>;

    adapter = new MediaProvenanceAdapter(mockStoragePort, mockAssetPort);
  });

  const createMockStream = (data: string) => {
    const stream = new Readable();
    stream.push(data);
    stream.push(null);
    return stream;
  };

  const mockAsset: MediaAssetView = {
    id: 'asset-1',
    ownerUserId: 'user-1',
    scope: 'CONDITION_EVIDENCE',
    resourceType: 'IMAGE',
    status: 'READY',
    mimeType: 'image/jpeg',
    sizeBytes: 1000,
    width: 800,
    height: 600,
    durationMs: null,
    captureSource: 'CAMERA',
    clientCapturedAt: new Date('2023-10-01T10:00:00Z'),
    provenanceStatus: 'UNKNOWN',
    providerPublicId: 'public-id',
    deliveryType: 'authenticated',
    readyAt: null,
    uploadIntentExpiresAt: null,
    retentionUntil: null,
  };

  it('should compute SHA256 and PHASH, and verify EXIF timeline for consistent CAMERA capture', async () => {
    mockStoragePort.openOriginalStream.mockResolvedValue({
      stream: createMockStream('test-data'),
    });
    mockAssetPort.findEvidenceBySha256.mockResolvedValue(null);
    mockStoragePort.getImageAnalysis.mockResolvedValue({
      perceptualHash: 'hash123',
      mediaMetadata: {
        dateTimeOriginal: '2023-10-01T10:05:00Z',
        software: 'TestApp',
      },
    });

    const result = await adapter.analyzeEvidence({
      asset: mockAsset,
      providerUploadedAt: new Date('2023-10-01T10:10:00Z'),
    });

    expect(result.sha256).toBeDefined();
    expect(result.perceptualHash).toBe('hash123');
    expect(result.provenanceStatus).toBe('DIRECT_CAPTURE');
    expect(result.provenanceReasons).toContain('SHA256_COMPUTED');
    expect(result.provenanceReasons).toContain('PHASH_COMPUTED');
    expect(result.provenanceReasons).toContain('EXIF_PRESENT');
    expect(result.provenanceReasons).toContain('CAPTURE_TIME_CONSISTENT');
    expect(result.provenanceReasons).toContain('CLIENT_EXIF_TIME_CONSISTENT');
    expect(result.provenanceReasons).toContain('EDITING_SOFTWARE_PRESENT');
    expect(result.provenanceReasons).toContain('DIRECT_CAMERA_CLAIM');
    expect(mockAssetPort.saveProvenanceResult).toHaveBeenCalled();
  });

  it('should mark suspicious if EXIF time is in the future compared to provider upload time', async () => {
    mockStoragePort.openOriginalStream.mockResolvedValue({ stream: createMockStream('test-data') });
    mockAssetPort.findEvidenceBySha256.mockResolvedValue(null);
    mockStoragePort.getImageAnalysis.mockResolvedValue({
      perceptualHash: 'hash123',
      mediaMetadata: {
        dateTimeOriginal: '2023-10-02T10:00:00Z', // Tomorrow
      },
    });

    const result = await adapter.analyzeEvidence({
      asset: mockAsset,
      providerUploadedAt: new Date('2023-10-01T10:00:00Z'), // Today
    });

    expect(result.provenanceStatus).toBe('SUSPICIOUS');
    expect(result.provenanceReasons).toContain('CAPTURE_TIME_MISMATCH');
  });

  it('should mark SHA256_DUPLICATE if another evidence has the same hash', async () => {
    mockStoragePort.openOriginalStream.mockResolvedValue({ stream: createMockStream('test-data') });
    mockAssetPort.findEvidenceBySha256.mockResolvedValue({} as any);
    mockStoragePort.getImageAnalysis.mockResolvedValue({});

    const result = await adapter.analyzeEvidence({
      asset: mockAsset,
      providerUploadedAt: new Date('2023-10-01T10:00:00Z'),
    });

    expect(result.provenanceReasons).toContain('SHA256_DUPLICATE');
  });

  it('should handle stream error and throw', async () => {
    const errorStream = new Readable({
      read() {
        this.emit('error', new Error('Stream failed'));
      }
    });
    mockStoragePort.openOriginalStream.mockResolvedValue({ stream: errorStream });

    await expect(
      adapter.analyzeEvidence({ asset: mockAsset, providerUploadedAt: new Date() })
    ).rejects.toThrow('Stream failed');
  });

  it('should handle missing EXIF data and missing provider time gracefully', async () => {
    mockStoragePort.openOriginalStream.mockResolvedValue({ stream: createMockStream('test-data') });
    mockAssetPort.findEvidenceBySha256.mockResolvedValue(null);
    mockStoragePort.getImageAnalysis.mockResolvedValue({
      perceptualHash: 'hash123',
    });

    const result = await adapter.analyzeEvidence({
      asset: { ...mockAsset, captureSource: 'GALLERY' }, // GALLERY
    });

    expect(result.provenanceReasons).toContain('PROVIDER_TIMESTAMP_UNAVAILABLE');
    expect(result.provenanceReasons).toContain('EXIF_MISSING');
    expect(result.provenanceStatus).toBe('METADATA_MISSING');
  });

  it('should handle invalid EXIF DateTimeOriginal', async () => {
    mockStoragePort.openOriginalStream.mockResolvedValue({ stream: createMockStream('data') });
    mockAssetPort.findEvidenceBySha256.mockResolvedValue(null);
    mockStoragePort.getImageAnalysis.mockResolvedValue({
      mediaMetadata: { dateTimeOriginal: 'invalid-date-string' }
    });

    const result = await adapter.analyzeEvidence({
      asset: mockAsset,
      providerUploadedAt: new Date(),
    });

    expect(result.provenanceReasons).toContain('EXIF_CAPTURE_TIME_INVALID');
    expect(result.provenanceStatus).toBe('METADATA_CONSISTENT');
  });
});
