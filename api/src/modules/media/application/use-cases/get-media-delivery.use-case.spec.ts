/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { GetMediaDeliveryUseCase } from './get-media-delivery.use-case';
import { MEDIA_ASSET_PORT } from '../ports/media-asset.port';
import type { MediaAssetPort } from '../ports/media-asset.port';
import { MEDIA_STORAGE_PORT, MediaDeliveryVariant } from '../ports/media-storage.port';
import type { MediaStoragePort } from '../ports/media-storage.port';
import { MediaPolicyService } from '../policies/media.policy';
import { AppError } from '../../../../shared/errors/app-error';
import { MEDIA_ERROR_CODES } from '../../../../shared/errors/codes/media.error-codes';
import { COMMON_ERROR_CODES } from '../../../../shared/errors/codes/common.error-codes';
import envConfig from '../../../../shared/config';

describe('GetMediaDeliveryUseCase', () => {
  let useCase: GetMediaDeliveryUseCase;
  let mockAssetPort: jest.Mocked<MediaAssetPort>;
  let mockStoragePort: jest.Mocked<MediaStoragePort>;
  let mockPolicyService: jest.Mocked<MediaPolicyService>;

  it('keeps certificate downloads restricted to active owner/admin, never rental staff or anonymous', async () => {
    mockAssetPort.findById.mockResolvedValue({ id: 'doc', ownerUserId: 'owner', scope: 'LEADER_CERTIFICATE',
      status: 'READY', resourceType: 'IMAGE', deliveryType: 'authenticated', providerPublicId: 'p', format: 'pdf' } as unknown as never);
    for (const role of ['USER', 'LEADER', 'STAFF_INVENTORY', 'STAFF_DELIVERY']) {
      await expect(useCase.execute({ mediaId: 'doc', variant: 'DOCUMENT_ORIGINAL' }, { ...mockUser(role), status: 'ACTIVE' }))
        .rejects.toMatchObject({ code: 'DOCUMENT_NOT_FOUND' });
    }
    await expect(useCase.execute({ mediaId: 'doc', variant: 'DOCUMENT_ORIGINAL' })).rejects.toMatchObject({ code: 'DOCUMENT_NOT_FOUND' });
    mockStoragePort.createDeliveryUrl.mockResolvedValue({ url: 'private-download', expiresAt: new Date(Date.now() + 300000) });
    expect(await useCase.execute({ mediaId: 'doc', variant: 'DOCUMENT_ORIGINAL' }, { ...mockUser('ADMIN'), status: 'ACTIVE' })).toMatchObject({ url: 'private-download' });
    await expect(useCase.execute({ mediaId: 'doc', variant: 'EVIDENCE_PREVIEW' }, { ...mockUser('ADMIN'), status: 'ACTIVE' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  const mockUser = (role: string) => ({
    id: 'u1',
    authUserId: 'au1',
    email: 'test@example.com',
    status: 'ACTIVE',
    role,
  });

  beforeEach(async () => {
    mockAssetPort = {
      findById: jest.fn(),
      findOwnedById: jest.fn(),
      createPendingUpload: jest.fn(),
      markReadyFromProcessing: jest.fn(),
      markRejectedFromProcessing: jest.fn(),
      saveProvenanceResult: jest.fn(),
      findEvidenceBySha256: jest.fn(),
      claimForProcessing: jest.fn(),
      revertProcessingToPending: jest.fn(),
      markDeletePending: jest.fn(),
      markDeleted: jest.fn(),
    } as unknown as jest.Mocked<MediaAssetPort>;

    mockStoragePort = {
      createUploadIntent: jest.fn(),
      verifyUploadResponse: jest.fn(),
      getAssetMetadata: jest.fn(),
      ensureDerivatives: jest.fn(),
      createDeliveryUrl: jest.fn(),
      openOriginalStream: jest.fn(),
      getImageAnalysis: jest.fn(),
      deleteAsset: jest.fn(),
    };

    mockPolicyService = {
      getScopePolicy: jest.fn(),
      validateProviderMetadata: jest.fn(),
    } as unknown as jest.Mocked<MediaPolicyService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetMediaDeliveryUseCase,
        { provide: MEDIA_ASSET_PORT, useValue: mockAssetPort },
        { provide: MEDIA_STORAGE_PORT, useValue: mockStoragePort },
        { provide: MediaPolicyService, useValue: mockPolicyService },
      ],
    }).compile();

    useCase = module.get<GetMediaDeliveryUseCase>(GetMediaDeliveryUseCase);
    envConfig.MEDIA_ENABLED = true;
  });

  it('throws MEDIA_NOT_FOUND if asset is not found', async () => {
    mockAssetPort.findById.mockResolvedValue(null);

    await expect(useCase.execute({ mediaId: 'id1', variant: 'CATALOG_CARD' }, mockUser('USER') as unknown as never))
      .rejects.toThrow(new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_NOT_FOUND,
        message: 'Media asset not found',
      }));
  });

  it('throws MEDIA_INVALID_STATE if asset is not READY', async () => {
    mockAssetPort.findById.mockResolvedValue({ status: 'PENDING_UPLOAD' } as unknown as never);

    await expect(useCase.execute({ mediaId: 'id1', variant: 'CATALOG_CARD' }, mockUser('USER') as unknown as never))
      .rejects.toThrow(new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_INVALID_STATE,
        message: 'Cannot deliver media that is not READY',
      }));
  });

  it('returns public delivery URL without authentication for RENTAL_PRODUCT', async () => {
    mockAssetPort.findById.mockResolvedValue({ 
      id: 'id1', 
      status: 'READY', 
      providerPublicId: 'p1', 
      deliveryType: 'upload',
      scope: 'RENTAL_PRODUCT',
      resourceType: 'IMAGE',
    } as unknown as never);
    
    mockPolicyService.getScopePolicy.mockReturnValue({ deliveryType: 'upload', allowedResourceTypes: ['IMAGE'], requiresProvenance: false });
    
    mockStoragePort.createDeliveryUrl.mockResolvedValue({ url: 'https://cat-card' });

    const result = await useCase.execute({ mediaId: 'id1', variant: 'CATALOG_CARD' });
    
    expect(result.url).toBe('https://cat-card');
    expect(result.variant).toBe('CATALOG_CARD');
    expect(mockStoragePort.createDeliveryUrl).toHaveBeenCalledWith(expect.objectContaining({
      variant: 'CATALOG_CARD',
      deliveryType: 'upload',
    }));
  });

  it('throws UNAUTHENTICATED if accessing evidence without user', async () => {
    mockAssetPort.findById.mockResolvedValue({ 
      id: 'id1', 
      status: 'READY', 
      providerPublicId: 'p1', 
      deliveryType: 'authenticated',
      scope: 'EXCEPTION_EVIDENCE',
      resourceType: 'IMAGE',
    } as unknown as never);
    
    mockPolicyService.getScopePolicy.mockReturnValue({ deliveryType: 'authenticated', allowedResourceTypes: ['IMAGE'], requiresProvenance: true });
    
    await expect(useCase.execute({ mediaId: 'id1', variant: 'EVIDENCE_PREVIEW' }))
      .rejects.toThrow(new AppError({
        code: COMMON_ERROR_CODES.UNAUTHENTICATED,
        message: 'Authentication required for this media',
      }));
  });

  it('allows owner to access their evidence', async () => {
    mockAssetPort.findById.mockResolvedValue({ 
      id: 'id1', 
      ownerUserId: 'u1',
      status: 'READY', 
      providerPublicId: 'p1', 
      deliveryType: 'authenticated',
      scope: 'EXCEPTION_EVIDENCE',
      resourceType: 'IMAGE',
    } as unknown as never);
    
    mockPolicyService.getScopePolicy.mockReturnValue({ deliveryType: 'authenticated', allowedResourceTypes: ['IMAGE'], requiresProvenance: true });
    mockStoragePort.createDeliveryUrl.mockResolvedValue({ url: 'https://signed-url' });

    const result = await useCase.execute({ mediaId: 'id1', variant: 'EVIDENCE_PREVIEW' }, mockUser('USER'));
    
    expect(result.url).toBe('https://signed-url');
  });

  it('throws FORBIDDEN if non-owner and non-staff accesses evidence', async () => {
    mockAssetPort.findById.mockResolvedValue({ 
      id: 'id1', 
      ownerUserId: 'u2',
      status: 'READY', 
      providerPublicId: 'p1', 
      deliveryType: 'authenticated',
      scope: 'EXCEPTION_EVIDENCE',
      resourceType: 'IMAGE',
    } as unknown as never);
    
    mockPolicyService.getScopePolicy.mockReturnValue({ deliveryType: 'authenticated', allowedResourceTypes: ['IMAGE'], requiresProvenance: true });

    await expect(useCase.execute({ mediaId: 'id1', variant: 'EVIDENCE_PREVIEW' }, mockUser('USER') as unknown as never))
      .rejects.toThrow(new AppError({
        code: COMMON_ERROR_CODES.FORBIDDEN,
        message: 'You are not authorized to access this media',
      }));
  });

  it('allows STAFF to access all evidence', async () => {
    mockAssetPort.findById.mockResolvedValue({ 
      id: 'id1', 
      ownerUserId: 'u2',
      status: 'READY', 
      providerPublicId: 'p1', 
      deliveryType: 'authenticated',
      scope: 'CONDITION_EVIDENCE',
      resourceType: 'IMAGE',
    } as unknown as never);
    
    mockPolicyService.getScopePolicy.mockReturnValue({ deliveryType: 'authenticated', allowedResourceTypes: ['IMAGE'], requiresProvenance: true });
    mockStoragePort.createDeliveryUrl.mockResolvedValue({ url: 'https://signed-url' });

    const result = await useCase.execute({ mediaId: 'id1', variant: 'EVIDENCE_PREVIEW' }, mockUser('STAFF_INVENTORY'));
    expect(result.url).toBe('https://signed-url');
  });

  it('throws VALIDATION_ERROR if requesting VIDEO_PREVIEW for IMAGE', async () => {
    mockAssetPort.findById.mockResolvedValue({ 
      id: 'id1', 
      status: 'READY', 
      providerPublicId: 'p1', 
      deliveryType: 'upload',
      scope: 'RENTAL_PRODUCT',
      resourceType: 'IMAGE',
    } as unknown as never);
    
    mockPolicyService.getScopePolicy.mockReturnValue({ deliveryType: 'upload', allowedResourceTypes: ['IMAGE'], requiresProvenance: false });

    await expect(useCase.execute({ mediaId: 'id1', variant: 'VIDEO_PREVIEW' }))
      .rejects.toThrow(new AppError({
        code: COMMON_ERROR_CODES.VALIDATION_ERROR,
        message: 'VIDEO_PREVIEW is not allowed for IMAGE',
      }));
  });

});
