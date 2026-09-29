import { Test, TestingModule } from '@nestjs/testing';
import { CreateUploadIntentUseCase } from './create-upload-intent.use-case';
import { MEDIA_ASSET_PORT } from '../ports/media-asset.port';
import type { MediaAssetPort } from '../ports/media-asset.port';
import { MEDIA_STORAGE_PORT } from '../ports/media-storage.port';
import type { MediaStoragePort } from '../ports/media-storage.port';
import { AppError } from '../../../../shared/errors/app-error';
import { COMMON_ERROR_CODES } from '../../../../shared/errors/codes/common.error-codes';
import { MEDIA_ERROR_CODES } from '../../../../shared/errors/codes/media.error-codes';
import envConfig from '../../../../shared/config';

describe('CreateUploadIntentUseCase', () => {
  let useCase: CreateUploadIntentUseCase;
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
      createPendingUpload: jest.fn().mockResolvedValue({ id: 'some-uuid', status: 'PENDING_UPLOAD' }),
      findOwnedById: jest.fn(),
      markReady: jest.fn(),
    } as unknown as jest.Mocked<MediaAssetPort>;
    mockStoragePort = {
      createUploadIntent: jest.fn().mockResolvedValue({
        uploadUrl: 'http://test',
        method: 'POST',
        formFields: {},
      }),
      verifyUploadResponse: jest.fn(),
      getAssetMetadata: jest.fn(),
    } as unknown as jest.Mocked<MediaStoragePort>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateUploadIntentUseCase,
        { provide: MEDIA_ASSET_PORT, useValue: mockAssetPort },
        { provide: MEDIA_STORAGE_PORT, useValue: mockStoragePort },
      ],
    }).compile();

    useCase = module.get<CreateUploadIntentUseCase>(CreateUploadIntentUseCase);
    
    // Enable media for tests
    envConfig.MEDIA_ENABLED = true;
  });

  it('throws FORBIDDEN if role is not authorized for scope', async () => {
    const input = {
      scope: 'RENTAL_PRODUCT' as const,
      resourceType: 'IMAGE' as const,
      fileName: 'test.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1024,
    };
    
    await expect(useCase.execute(input, mockUser('USER') as unknown as never))
      .rejects.toThrow(new AppError({
        code: COMMON_ERROR_CODES.FORBIDDEN,
        message: 'Role USER is not authorized for scope RENTAL_PRODUCT',
      }));
  });

  it('throws MEDIA_UNSUPPORTED_MIME_TYPE if image is not supported', async () => {
    const input = {
      scope: 'EXCEPTION_EVIDENCE' as const,
      resourceType: 'IMAGE' as const,
      fileName: 'test.txt',
      contentType: 'text/plain',
      sizeBytes: 1024,
    };
    
    await expect(useCase.execute(input, mockUser('USER') as unknown as never))
      .rejects.toThrow(new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_UNSUPPORTED_MIME_TYPE,
        message: 'Unsupported image MIME type',
      }));
  });

  it('throws MEDIA_FILE_TOO_LARGE if size exceeds limit', async () => {
    envConfig.MEDIA_MAX_IMAGE_BYTES = 1000;
    const input = {
      scope: 'EXCEPTION_EVIDENCE' as const,
      resourceType: 'IMAGE' as const,
      fileName: 'test.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 2000,
    };
    
    await expect(useCase.execute(input, mockUser('USER') as unknown as never))
      .rejects.toThrow(new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_FILE_TOO_LARGE,
        message: 'Image exceeds maximum size of 1000 bytes',
      }));
  });

  it('creates intent successfully and verifies parameters', async () => {
    envConfig.MEDIA_MAX_IMAGE_BYTES = 20000000;
    const input = {
      scope: 'RENTAL_PRODUCT' as const,
      resourceType: 'IMAGE' as const,
      fileName: 'test.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1024,
    };
    
    mockAssetPort.createPendingUpload.mockImplementation(async (data) => ({ id: data.id, status: 'PENDING_UPLOAD' } as unknown as never));

    const result = await useCase.execute(input, mockUser('ADMIN') as unknown as never);
    
    // same mediaId passed to DB and appears in providerPublicId
    expect(result.mediaId).toBeDefined();
    expect(mockAssetPort.createPendingUpload).toHaveBeenCalledWith(expect.objectContaining({
      id: result.mediaId,
      providerPublicId: expect.stringContaining(result.mediaId),
    }));
    expect(mockStoragePort.createUploadIntent).toHaveBeenCalledWith(expect.objectContaining({
      publicId: expect.stringContaining(result.mediaId),
      deliveryType: 'upload', // RENTAL_PRODUCT -> upload
    }));
  });

  it('sets deliveryType authenticated for evidence', async () => {
    envConfig.MEDIA_MAX_IMAGE_BYTES = 20000000;
    const input = {
      scope: 'EXCEPTION_EVIDENCE' as const,
      resourceType: 'IMAGE' as const,
      fileName: 'test.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1024,
    };
    
    await useCase.execute(input, mockUser('USER') as unknown as never);
    expect(mockStoragePort.createUploadIntent).toHaveBeenCalledWith(expect.objectContaining({
      deliveryType: 'authenticated',
    }));
  });

  it('throws MEDIA_PROVIDER_ERROR if storage signing fails', async () => {
    mockStoragePort.createUploadIntent.mockRejectedValue(new Error('Signing failed'));
    const input = {
      scope: 'RENTAL_PRODUCT' as const,
      resourceType: 'IMAGE' as const,
      fileName: 'test.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1024,
    };
    
    await expect(useCase.execute(input, mockUser('ADMIN') as unknown as never))
      .rejects.toThrow(new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_PROVIDER_ERROR,
        message: 'Failed to create provider upload intent',
      }));
  });
});
