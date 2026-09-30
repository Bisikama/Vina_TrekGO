import { Test, TestingModule } from '@nestjs/testing';
import { CreateUploadIntentUseCase } from './create-upload-intent.use-case';
import { MEDIA_ASSET_PORT } from '../ports/media-asset.port';
import type { MediaAssetPort, MediaScopeValue, MediaResourceTypeValue } from '../ports/media-asset.port';
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
    envConfig.MEDIA_MAX_IMAGE_BYTES = 20971520;
    envConfig.MEDIA_MAX_VIDEO_BYTES = 104857600;
  });

  describe('Role Matrix', () => {
    it.each([
      ['RENTAL_PRODUCT', 'STAFF_INVENTORY', true],
      ['RENTAL_PRODUCT', 'ADMIN', true],
      ['RENTAL_PRODUCT', 'USER', false],
      ['CONDITION_EVIDENCE', 'STAFF_INVENTORY', true],
      ['CONDITION_EVIDENCE', 'USER', false],
      ['RETURN_EVIDENCE', 'STAFF_INVENTORY', true],
      ['RETURN_EVIDENCE', 'STAFF_DELIVERY', true],
      ['RETURN_EVIDENCE', 'USER', false],
      ['EXCEPTION_EVIDENCE', 'USER', true],
      ['EXCEPTION_EVIDENCE', 'LEADER', true],
      ['EXCEPTION_EVIDENCE', 'STAFF_INVENTORY', true],
      ['EXCEPTION_EVIDENCE', 'STAFF_DELIVERY', true],
      ['EXCEPTION_EVIDENCE', 'ADMIN', true],
    ])('Scope %s for role %s should be allowed: %s', async (scope, role, allowed) => {
      const input = {
        scope: scope as MediaScopeValue,
        resourceType: 'IMAGE' as MediaResourceTypeValue,
        fileName: 'test.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 1024,
      };
      
      const promise = useCase.execute(input, mockUser(role) as unknown as never);
      if (allowed) {
        await expect(promise).resolves.toBeDefined();
      } else {
        await expect(promise).rejects.toThrow(new AppError({
          code: COMMON_ERROR_CODES.FORBIDDEN,
          message: `Role ${role} is not authorized for scope ${scope}`,
        }));
      }
    });
  });

  describe('MIME Matrix', () => {
    it.each([
      ['image/jpeg', 'IMAGE', true],
      ['image/png', 'IMAGE', true],
      ['image/webp', 'IMAGE', true],
      ['image/heic', 'IMAGE', true],
      ['image/heif', 'IMAGE', true],
      ['text/plain', 'IMAGE', false],
      ['video/mp4', 'VIDEO', true],
      ['video/quicktime', 'VIDEO', true],
      ['video/webm', 'VIDEO', true],
      ['audio/mpeg', 'VIDEO', false],
    ])('MIME %s for %s should be allowed: %s', async (contentType, resourceType, allowed) => {
      const input = {
        scope: 'EXCEPTION_EVIDENCE' as MediaScopeValue,
        resourceType: resourceType as MediaResourceTypeValue,
        fileName: 'file',
        contentType,
        sizeBytes: 1024,
      };
      
      const promise = useCase.execute(input, mockUser('USER') as unknown as never);
      if (allowed) {
        await expect(promise).resolves.toBeDefined();
      } else {
        await expect(promise).rejects.toThrow(new AppError({
          code: MEDIA_ERROR_CODES.MEDIA_UNSUPPORTED_MIME_TYPE,
          message: `Unsupported ${resourceType.toLowerCase()} MIME type`,
        }));
      }
    });
  });

  describe('Size Matrix', () => {
    it.each([
      ['IMAGE', 20971520, true],
      ['IMAGE', 20971521, false],
      ['VIDEO', 104857600, true],
      ['VIDEO', 104857601, false],
    ])('%s exactly at max size (%s) allowed: %s', async (resourceType, sizeBytes, allowed) => {
      const input = {
        scope: 'EXCEPTION_EVIDENCE' as MediaScopeValue,
        resourceType: resourceType as MediaResourceTypeValue,
        fileName: 'file',
        contentType: resourceType === 'IMAGE' ? 'image/jpeg' : 'video/mp4',
        sizeBytes,
      };
      
      const promise = useCase.execute(input, mockUser('USER') as unknown as never);
      if (allowed) {
        await expect(promise).resolves.toBeDefined();
      } else {
        await expect(promise).rejects.toThrow(new AppError({
          code: MEDIA_ERROR_CODES.MEDIA_FILE_TOO_LARGE,
          message: `${resourceType === 'IMAGE' ? 'Image' : 'Video'} exceeds maximum size of ${resourceType === 'IMAGE' ? 20971520 : 104857600} bytes`,
        }));
      }
    });
  });

  it('creates intent successfully and verifies parameters', async () => {
    const input = {
      scope: 'RENTAL_PRODUCT' as MediaScopeValue,
      resourceType: 'IMAGE' as MediaResourceTypeValue,
      fileName: 'test.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1024,
    };
    
    mockAssetPort.createPendingUpload.mockImplementation(async (data) => ({ id: data.id, status: 'PENDING_UPLOAD' } as unknown as never));

    const result = await useCase.execute(input, mockUser('ADMIN') as unknown as never);
    
    expect(result.mediaId).toBeDefined();
    expect(mockAssetPort.createPendingUpload).toHaveBeenCalledWith(expect.objectContaining({
      id: result.mediaId,
      providerPublicId: expect.stringContaining(result.mediaId),
    }));
    expect(mockStoragePort.createUploadIntent).toHaveBeenCalledWith(expect.objectContaining({
      publicId: expect.stringContaining(result.mediaId),
      deliveryType: 'upload',
    }));
  });

  it('sets deliveryType authenticated for evidence', async () => {
    const input = {
      scope: 'EXCEPTION_EVIDENCE' as MediaScopeValue,
      resourceType: 'IMAGE' as MediaResourceTypeValue,
      fileName: 'test.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1024,
    };
    
    await useCase.execute(input, mockUser('USER') as unknown as never);
    
    expect(mockStoragePort.createUploadIntent).toHaveBeenCalledWith(expect.objectContaining({
      deliveryType: 'authenticated',
    }));
  });
});
