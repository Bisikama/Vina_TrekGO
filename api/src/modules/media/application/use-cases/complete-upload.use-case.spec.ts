 
import { Test, TestingModule } from '@nestjs/testing';
import { CompleteUploadUseCase } from './complete-upload.use-case';
import { MEDIA_ASSET_PORT } from '../ports/media-asset.port';
import type { MediaAssetPort } from '../ports/media-asset.port';
import { MEDIA_STORAGE_PORT } from '../ports/media-storage.port';
import type { MediaStoragePort } from '../ports/media-storage.port';
import { MEDIA_PROVENANCE_PORT } from '../ports/media-provenance.port';
import type { MediaProvenancePort } from '../ports/media-provenance.port';
import { AppError } from '../../../../shared/errors/app-error';
import { MEDIA_ERROR_CODES } from '../../../../shared/errors/codes/media.error-codes';
import { MediaPolicyService } from '../policies/media.policy';
import envConfig from '../../../../shared/config';

describe('CompleteUploadUseCase', () => {
  let useCase: CompleteUploadUseCase;
  let mockAssetPort: jest.Mocked<MediaAssetPort>;
  let mockStoragePort: jest.Mocked<MediaStoragePort>;
  let mockProvenancePort: jest.Mocked<MediaProvenancePort>;
  let mockPolicyService: jest.Mocked<MediaPolicyService>;

  const mockUser = (role: string) => ({
    id: 'u1',
    authUserId: 'au1',
    email: 'test@example.com',
    status: 'ACTIVE',
    role,
  });

  beforeEach(async () => {
    mockAssetPort = {
      createPendingUpload: jest.fn(),
      findOwnedById: jest.fn(),
      markReadyFromProcessing: jest.fn().mockResolvedValue({}),
      markRejectedFromProcessing: jest.fn().mockResolvedValue({}),
      claimForProcessing: jest.fn().mockImplementation(async (input: import('../ports/media-asset.port').ClaimForProcessingInput) => {
        const result = await mockAssetPort.findOwnedById({ id: input.id, ownerUserId: input.ownerUserId });
        if (!result) throw new Error('Mock error: not found');
        return { ...result, status: 'PROCESSING' };
      }),
      revertProcessingToPending: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<MediaAssetPort>;
    mockStoragePort = {
      createUploadIntent: jest.fn(),
      verifyUploadResponse: jest.fn(),
      getAssetMetadata: jest.fn(),
    } as unknown as jest.Mocked<MediaStoragePort>;
    mockPolicyService = {
      getScopePolicy: jest.fn(),
      validateProviderMetadata: jest.fn(),
    } as unknown as jest.Mocked<MediaPolicyService>;
    mockProvenancePort = {
      analyzeEvidence: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompleteUploadUseCase,
        { provide: MEDIA_ASSET_PORT, useValue: mockAssetPort },
        { provide: MEDIA_STORAGE_PORT, useValue: mockStoragePort },
        { provide: MEDIA_PROVENANCE_PORT, useValue: mockProvenancePort },
        { provide: MediaPolicyService, useValue: mockPolicyService },
      ],
    }).compile();

    useCase = module.get<CompleteUploadUseCase>(CompleteUploadUseCase);
    envConfig.MEDIA_ENABLED = true;
  });

  it('throws MEDIA_NOT_FOUND if asset is not found', async () => {
    mockAssetPort.findOwnedById.mockResolvedValue(null);
    
    await expect(useCase.execute('some-uuid', { publicId: 'p1', version: 1, signature: 'sig' }, mockUser('USER') as unknown as never))
      .rejects.toThrow(new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_NOT_FOUND,
        message: 'Media asset not found',
      }));
  });

  it('returns early if asset is already READY', async () => {
    const asset = { status: 'READY' };
    mockAssetPort.findOwnedById.mockResolvedValue(asset as unknown as never);
    
    const result = await useCase.execute('some-uuid', { publicId: 'p1', version: 1, signature: 'sig' }, mockUser('USER'));
    expect(result).toBe(asset);
    expect(mockStoragePort.verifyUploadResponse).not.toHaveBeenCalled();
  });

  it('throws MEDIA_INVALID_STATE if asset is not PENDING_UPLOAD or READY', async () => {
    mockAssetPort.findOwnedById.mockResolvedValue({ status: 'REJECTED' } as unknown as never);
    
    await expect(useCase.execute('some-uuid', { publicId: 'p1', version: 1, signature: 'sig' }, mockUser('USER') as unknown as never))
      .rejects.toThrow(new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_INVALID_STATE,
        message: 'Cannot complete upload for asset in REJECTED state',
      }));
  });

  it('throws MEDIA_UPLOAD_EXPIRED if intent expired', async () => {
    const expiredDate = new Date(Date.now() - 10000);
    mockAssetPort.findOwnedById.mockResolvedValue({ status: 'PENDING_UPLOAD', uploadIntentExpiresAt: expiredDate, providerPublicId: 'p1', deliveryType: 'upload' } as unknown as never);
    
    await expect(useCase.execute('some-uuid', { publicId: 'p1', version: 1, signature: 'sig' }, mockUser('USER') as unknown as never))
      .rejects.toThrow(new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_UPLOAD_EXPIRED,
        message: 'Upload intent has expired',
      }));
  });

  it('throws MEDIA_UPLOAD_SIGNATURE_INVALID if signature fails', async () => {
    mockAssetPort.findOwnedById.mockResolvedValue({ status: 'PENDING_UPLOAD', providerPublicId: 'p1', deliveryType: 'upload' } as unknown as never);
    mockStoragePort.verifyUploadResponse.mockResolvedValue(false);
    
    await expect(useCase.execute('some-uuid', { publicId: 'p1', version: 1, signature: 'sig' }, mockUser('USER') as unknown as never))
      .rejects.toThrow(new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_UPLOAD_SIGNATURE_INVALID,
        message: 'Invalid provider upload signature',
      }));
  });

  it('throws MEDIA_INVALID_STATE if missing stored providerPublicId', async () => {
    mockAssetPort.findOwnedById.mockResolvedValue({ status: 'PENDING_UPLOAD', providerPublicId: null, deliveryType: 'upload' } as unknown as never);
    
    await expect(useCase.execute('some-uuid', { publicId: 'p1', version: 1, signature: 'sig' }, mockUser('USER') as unknown as never))
      .rejects.toThrow(new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_INVALID_STATE,
        message: 'Cannot complete upload for asset missing provider metadata',
      }));
  });

  it('throws MEDIA_INVALID_STATE if missing stored deliveryType', async () => {
    mockAssetPort.findOwnedById.mockResolvedValue({ status: 'PENDING_UPLOAD', providerPublicId: 'p1', deliveryType: null } as unknown as never);
    
    await expect(useCase.execute('some-uuid', { publicId: 'p1', version: 1, signature: 'sig' }, mockUser('USER') as unknown as never))
      .rejects.toThrow(new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_INVALID_STATE,
        message: 'Cannot complete upload for asset missing provider metadata',
      }));
  });

  it('throws MEDIA_PROVIDER_ERROR if provider lookup failure', async () => {
    mockAssetPort.findOwnedById.mockResolvedValue({ status: 'PENDING_UPLOAD', providerPublicId: 'p1', deliveryType: 'upload' } as unknown as never);
    mockStoragePort.verifyUploadResponse.mockResolvedValue(true);
    mockStoragePort.getAssetMetadata.mockRejectedValue(new AppError({ code: MEDIA_ERROR_CODES.MEDIA_PROVIDER_ERROR, message: 'Provider lookup failed' }));
    
    await expect(useCase.execute('some-uuid', { publicId: 'p1', version: 1, signature: 'sig' }, mockUser('USER') as unknown as never))
      .rejects.toThrow(new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_PROVIDER_ERROR,
        message: 'Provider lookup failed',
      }));
  });

  it('throws MEDIA_PROVIDER_ERROR if canonical provider asset missing', async () => {
    mockAssetPort.findOwnedById.mockResolvedValue({ status: 'PENDING_UPLOAD', providerPublicId: 'p1', deliveryType: 'upload' } as unknown as never);
    mockStoragePort.verifyUploadResponse.mockResolvedValue(true);
    mockStoragePort.getAssetMetadata.mockResolvedValue(null);
    
    await expect(useCase.execute('some-uuid', { publicId: 'p1', version: 1, signature: 'sig' }, mockUser('USER') as unknown as never))
      .rejects.toThrow(new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_PROVIDER_ERROR,
        message: 'Provider asset metadata temporary lookup failure',
      }));
  });

  it('throws MEDIA_PROVIDER_MISMATCH if publicId does not match intent', async () => {
    mockAssetPort.findOwnedById.mockResolvedValue({ status: 'PENDING_UPLOAD', providerPublicId: 'expected-id', deliveryType: 'upload' } as unknown as never);
    mockStoragePort.verifyUploadResponse.mockResolvedValue(true);
    
    await expect(useCase.execute('some-uuid', { publicId: 'wrong-id', version: 1, signature: 'sig' }, mockUser('USER') as unknown as never))
      .rejects.toThrow(new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_PROVIDER_MISMATCH,
        message: 'Public ID mismatch',
      }));
  });

  it('throws MEDIA_PROVIDER_MISMATCH if canonical publicId mismatch', async () => {
    mockAssetPort.findOwnedById.mockResolvedValue({ status: 'PENDING_UPLOAD', providerPublicId: 'p1', resourceType: 'IMAGE', deliveryType: 'upload' } as unknown as never);
    mockStoragePort.verifyUploadResponse.mockResolvedValue(true);
    mockStoragePort.getAssetMetadata.mockResolvedValue({ providerPublicId: 'wrong-p1', resourceType: 'IMAGE', deliveryType: 'upload' } as unknown as never);
    
    await expect(useCase.execute('some-uuid', { publicId: 'p1', version: 1, signature: 'sig' }, { id: 'u1', role: 'USER' } as unknown as never))
      .rejects.toThrow(new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_PROVIDER_MISMATCH,
        message: 'Canonical public ID mismatch',
      }));
  });

  it('throws MEDIA_PROVIDER_MISMATCH if canonical resourceType mismatch', async () => {
    mockAssetPort.findOwnedById.mockResolvedValue({ status: 'PENDING_UPLOAD', providerPublicId: 'p1', resourceType: 'IMAGE', deliveryType: 'upload' } as unknown as never);
    mockStoragePort.verifyUploadResponse.mockResolvedValue(true);
    mockStoragePort.getAssetMetadata.mockResolvedValue({ providerPublicId: 'p1', resourceType: 'VIDEO', deliveryType: 'upload' } as unknown as never);
    
    await expect(useCase.execute('some-uuid', { publicId: 'p1', version: 1, signature: 'sig' }, { id: 'u1', role: 'USER' } as unknown as never))
      .rejects.toThrow(new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_PROVIDER_MISMATCH,
        message: 'Canonical resource type mismatch',
      }));
  });

  it('throws MEDIA_PROVIDER_MISMATCH if canonical deliveryType mismatch', async () => {
    mockAssetPort.findOwnedById.mockResolvedValue({ status: 'PENDING_UPLOAD', providerPublicId: 'p1', resourceType: 'IMAGE', deliveryType: 'authenticated' } as unknown as never);
    mockStoragePort.verifyUploadResponse.mockResolvedValue(true);
    mockStoragePort.getAssetMetadata.mockResolvedValue({ providerPublicId: 'p1', resourceType: 'IMAGE', deliveryType: 'upload' } as unknown as never);
    
    await expect(useCase.execute('some-uuid', { publicId: 'p1', version: 1, signature: 'sig' }, { id: 'u1', role: 'USER' } as unknown as never))
      .rejects.toThrow(new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_PROVIDER_MISMATCH,
        message: 'Canonical delivery type mismatch',
      }));
  });

  it('throws MEDIA_FILE_TOO_LARGE if canonical bytes exceed IMAGE limit', async () => {
    envConfig.MEDIA_MAX_IMAGE_BYTES = 1000;
    mockAssetPort.findOwnedById.mockResolvedValue({ status: 'PENDING_UPLOAD', providerPublicId: 'p1', resourceType: 'IMAGE', deliveryType: 'upload' } as unknown as never);
    mockStoragePort.verifyUploadResponse.mockResolvedValue(true);
    mockStoragePort.getAssetMetadata.mockResolvedValue({ providerPublicId: 'p1', resourceType: 'IMAGE', deliveryType: 'upload', bytes: 2000 } as unknown as never);
    
    await expect(useCase.execute('some-uuid', { publicId: 'p1', version: 1, signature: 'sig' }, { id: 'u1', role: 'USER' } as unknown as never))
      .rejects.toThrow(new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_FILE_TOO_LARGE,
        message: 'Uploaded file size exceeds the allowed limit',
      }));
  });

  it('completes upload successfully for IMAGE and verifies markReady receives all fields', async () => {
    envConfig.MEDIA_MAX_IMAGE_BYTES = 2000;
    mockAssetPort.findOwnedById.mockResolvedValueOnce({ status: 'PENDING_UPLOAD', providerPublicId: 'p1', resourceType: 'IMAGE', deliveryType: 'upload' } as unknown as never).mockResolvedValueOnce({ status: 'READY', providerPublicId: 'p1', resourceType: 'IMAGE', deliveryType: 'upload' } as unknown as never);
    mockAssetPort.markReadyFromProcessing.mockResolvedValue({ status: 'READY' } as unknown as never);
    mockStoragePort.verifyUploadResponse.mockResolvedValue(true);
    const date = new Date('2023-01-01T00:00:00Z');
    mockStoragePort.getAssetMetadata.mockResolvedValue({
      providerAssetId: 'a1',
      providerPublicId: 'p1',
      format: 'jpg',
      bytes: 1024,
      width: 800,
      height: 600,
      durationMs: null,
      secureUrl: 'https://url',
      resourceType: 'IMAGE',
      deliveryType: 'upload',
      providerUploadedAt: date,
    } as unknown as never);
    
    const result = await useCase.execute('some-uuid', { publicId: 'p1', version: 1, signature: 'sig' }, { id: 'u1', role: 'USER' } as unknown as never);
    expect(result.status).toBe('READY');
    expect(mockAssetPort.markReadyFromProcessing).toHaveBeenCalledWith(expect.objectContaining({
      providerAssetId: 'a1',
      providerPublicId: 'p1',
      format: 'jpg',
      sizeBytes: 1024,
      width: 800,
      height: 600,
      durationMs: null,
      secureUrl: 'https://url',
      uploadedAt: date,
    }));
  });

  it('throws MEDIA_FILE_TOO_LARGE if canonical bytes exceed VIDEO limit', async () => {
    envConfig.MEDIA_MAX_VIDEO_BYTES = 1000;
    mockAssetPort.findOwnedById.mockResolvedValue({ status: 'PENDING_UPLOAD', providerPublicId: 'p1', resourceType: 'VIDEO', deliveryType: 'upload' } as unknown as never);
    mockStoragePort.verifyUploadResponse.mockResolvedValue(true);
    mockStoragePort.getAssetMetadata.mockResolvedValue({ providerPublicId: 'p1', resourceType: 'VIDEO', deliveryType: 'upload', bytes: 2000 } as unknown as never);
    
    await expect(useCase.execute('some-uuid', { publicId: 'p1', version: 1, signature: 'sig' }, { id: 'u1', role: 'USER' } as unknown as never))
      .rejects.toThrow(new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_FILE_TOO_LARGE,
        message: 'Uploaded file size exceeds the allowed limit',
      }));
  });

  it('completes upload successfully for VIDEO', async () => {
    envConfig.MEDIA_MAX_VIDEO_BYTES = 5000;
    mockAssetPort.findOwnedById.mockResolvedValueOnce({ status: 'PENDING_UPLOAD', providerPublicId: 'p1', resourceType: 'VIDEO', deliveryType: 'upload' } as unknown as never).mockResolvedValueOnce({ status: 'READY', providerPublicId: 'p1', resourceType: 'VIDEO', deliveryType: 'upload' } as unknown as never);
    mockAssetPort.markReadyFromProcessing.mockResolvedValue({ status: 'READY' } as unknown as never);
    mockStoragePort.verifyUploadResponse.mockResolvedValue(true);
    mockStoragePort.getAssetMetadata.mockResolvedValue({ providerPublicId: 'p1', resourceType: 'VIDEO', deliveryType: 'upload', bytes: 1000 } as unknown as never);
    
    const result = await useCase.execute('some-uuid', { publicId: 'p1', version: 1, signature: 'sig' }, { id: 'u1', role: 'USER' } as unknown as never);
    expect(result.status).toBe('READY');
  });

  it('marks REJECTED if policy validation fails', async () => {
    mockAssetPort.findOwnedById.mockResolvedValue({ status: 'PENDING_UPLOAD', providerPublicId: 'p1', resourceType: 'IMAGE', deliveryType: 'upload' } as unknown as never);
    mockStoragePort.verifyUploadResponse.mockResolvedValue(true);
    mockStoragePort.getAssetMetadata.mockResolvedValue({ providerPublicId: 'p1', resourceType: 'IMAGE', deliveryType: 'upload', bytes: 1000 } as unknown as never);
    
    const policyError = new AppError({ code: MEDIA_ERROR_CODES.MEDIA_INVALID_DIMENSIONS, message: 'Invalid dims' });
    mockPolicyService.validateProviderMetadata.mockImplementation(() => { throw policyError; });

    await expect(useCase.execute('some-uuid', { publicId: 'p1', version: 1, signature: 'sig' }, { id: 'u1', role: 'USER' } as unknown as never))
      .rejects.toThrow(policyError);

    expect(mockAssetPort.markRejectedFromProcessing).toHaveBeenCalledWith(expect.objectContaining({
      id: 'some-uuid',
      ownerUserId: 'u1',
      reason: 'Invalid dims'
    }));
  });
});
