import { Test, TestingModule } from '@nestjs/testing';
import { CompleteUploadUseCase } from './complete-upload.use-case';
import { MEDIA_ASSET_PORT } from '../ports/media-asset.port';
import type { MediaAssetPort } from '../ports/media-asset.port';
import { MEDIA_STORAGE_PORT } from '../ports/media-storage.port';
import type { MediaStoragePort } from '../ports/media-storage.port';
import { AppError } from '../../../../shared/errors/app-error';
import { MEDIA_ERROR_CODES } from '../../../../shared/errors/codes/media.error-codes';
import envConfig from '../../../../shared/config';

describe('CompleteUploadUseCase', () => {
  let useCase: CompleteUploadUseCase;
  let mockAssetPort: jest.Mocked<MediaAssetPort>;
  let mockStoragePort: jest.Mocked<MediaStoragePort>;

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
      markReady: jest.fn().mockResolvedValue({} as unknown as never),
    } as unknown as jest.Mocked<MediaAssetPort>;
    mockStoragePort = {
      createUploadIntent: jest.fn(),
      verifyUploadResponse: jest.fn(),
      getAssetMetadata: jest.fn(),
    } as unknown as jest.Mocked<MediaStoragePort>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompleteUploadUseCase,
        { provide: MEDIA_ASSET_PORT, useValue: mockAssetPort },
        { provide: MEDIA_STORAGE_PORT, useValue: mockStoragePort },
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
    
    const result = await useCase.execute('some-uuid', { publicId: 'p1', version: 1, signature: 'sig' }, mockUser('USER') as unknown as never);
    expect(result).toBe(asset);
    expect(mockStoragePort.verifyUploadResponse).not.toHaveBeenCalled();
  });

  it('throws MEDIA_INVALID_STATE if asset is not PENDING_UPLOAD or READY', async () => {
    mockAssetPort.findOwnedById.mockResolvedValue({ status: 'ARCHIVED' } as unknown as never);
    
    await expect(useCase.execute('some-uuid', { publicId: 'p1', version: 1, signature: 'sig' }, mockUser('USER') as unknown as never))
      .rejects.toThrow(new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_INVALID_STATE,
        message: 'Cannot complete upload for asset in ARCHIVED state',
      }));
  });

  it('throws MEDIA_UPLOAD_EXPIRED if intent expired', async () => {
    const expiredDate = new Date(Date.now() - 10000);
    mockAssetPort.findOwnedById.mockResolvedValue({ status: 'PENDING_UPLOAD', uploadIntentExpiresAt: expiredDate } as unknown as never);
    
    await expect(useCase.execute('some-uuid', { publicId: 'p1', version: 1, signature: 'sig' }, mockUser('USER') as unknown as never))
      .rejects.toThrow(new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_UPLOAD_EXPIRED,
        message: 'Upload intent has expired',
      }));
  });

  it('throws MEDIA_UPLOAD_SIGNATURE_INVALID if signature fails', async () => {
    mockAssetPort.findOwnedById.mockResolvedValue({ status: 'PENDING_UPLOAD' } as unknown as never);
    mockStoragePort.verifyUploadResponse.mockResolvedValue(false);
    
    await expect(useCase.execute('some-uuid', { publicId: 'p1', version: 1, signature: 'sig' }, mockUser('USER') as unknown as never))
      .rejects.toThrow(new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_UPLOAD_SIGNATURE_INVALID,
        message: 'Invalid provider upload signature',
      }));
  });

  it('throws MEDIA_PROVIDER_MISMATCH if publicId does not match intent', async () => {
    mockAssetPort.findOwnedById.mockResolvedValue({ status: 'PENDING_UPLOAD', providerPublicId: 'expected-id' } as unknown as never);
    mockStoragePort.verifyUploadResponse.mockResolvedValue(true);
    
    await expect(useCase.execute('some-uuid', { publicId: 'wrong-id', version: 1, signature: 'sig' }, mockUser('USER') as unknown as never))
      .rejects.toThrow(new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_PROVIDER_MISMATCH,
        message: 'Public ID mismatch',
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
    mockAssetPort.markReady.mockResolvedValue({ status: 'READY' } as unknown as never);
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
    expect(mockAssetPort.markReady).toHaveBeenCalledWith(expect.objectContaining({
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

  it('completes upload successfully for VIDEO', async () => {
    envConfig.MEDIA_MAX_VIDEO_BYTES = 5000;
    mockAssetPort.findOwnedById.mockResolvedValueOnce({ status: 'PENDING_UPLOAD', providerPublicId: 'p1', resourceType: 'VIDEO', deliveryType: 'upload' } as unknown as never).mockResolvedValueOnce({ status: 'READY', providerPublicId: 'p1', resourceType: 'VIDEO', deliveryType: 'upload' } as unknown as never);
    mockAssetPort.markReady.mockResolvedValue({ status: 'READY' } as unknown as never);
    mockStoragePort.verifyUploadResponse.mockResolvedValue(true);
    mockStoragePort.getAssetMetadata.mockResolvedValue({ providerPublicId: 'p1', resourceType: 'VIDEO', deliveryType: 'upload', bytes: 1000 } as unknown as never);
    
    const result = await useCase.execute('some-uuid', { publicId: 'p1', version: 1, signature: 'sig' }, { id: 'u1', role: 'USER' } as unknown as never);
    expect(result.status).toBe('READY');
  });
});
