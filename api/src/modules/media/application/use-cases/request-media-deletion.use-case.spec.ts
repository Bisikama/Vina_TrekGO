import { RequestMediaDeletionUseCase } from './request-media-deletion.use-case';
import { MediaAssetPort } from '../ports/media-asset.port';
import { MediaReferencePort } from '../ports/media-reference.port';
import { MediaPolicyService } from '../policies/media.policy';
import { MediaAssetView } from '../ports/media-asset.port';
import { AppError } from '../../../../shared/errors/app-error';
import { MediaStoragePort } from '../ports/media-storage.port';

describe('RequestMediaDeletionUseCase', () => {
  let useCase: RequestMediaDeletionUseCase;
  let mediaAssetPort: jest.Mocked<MediaAssetPort>;
  let mediaReferencePort: jest.Mocked<MediaReferencePort>;
  let mediaStoragePort: jest.Mocked<MediaStoragePort>;

  const mockAsset: MediaAssetView = {
    id: 'asset-1',
    status: 'READY',
    resourceType: 'IMAGE',
    ownerUserId: 'user-1',
    scope: 'CONDITION_EVIDENCE',
    mimeType: 'image/jpeg',
    sizeBytes: 100,
    width: 100,
    height: 100,
    durationMs: null,
    captureSource: 'CAMERA',
    clientCapturedAt: new Date(),
    provenanceStatus: 'DIRECT_CAPTURE',
    readyAt: new Date(),
    uploadIntentExpiresAt: null,
    providerPublicId: 'public-id',
    deliveryType: 'upload',
    retentionUntil: null,
  };

  beforeEach(() => {
    mediaAssetPort = {
      findById: jest.fn(),
      markDeletePending: jest.fn(),
      claimForProcessing: jest.fn(),
      markReady: jest.fn(),
      markDeleted: jest.fn(),
    } as unknown as jest.Mocked<MediaAssetPort>;

    mediaReferencePort = {
      hasActiveReferences: jest.fn(),
    } as unknown as jest.Mocked<MediaReferencePort>;

    mediaStoragePort = {
      deleteAsset: jest.fn(),
    } as unknown as jest.Mocked<MediaStoragePort>;

    useCase = new RequestMediaDeletionUseCase(
      mediaAssetPort,
      mediaReferencePort,
      mediaStoragePort
    );
  });

  it('should mark asset as DELETE_PENDING if owner and no references', async () => {
    mediaAssetPort.findById.mockResolvedValue(mockAsset);

    mediaReferencePort.hasActiveReferences.mockResolvedValue(false);
    mediaAssetPort.markDeletePending.mockResolvedValue(mockAsset);

    await useCase.execute({
      assetId: 'asset-1',
      requesterUser: { id: 'user-1', role: 'CUSTOMER' }
    });

    expect(mediaAssetPort.markDeletePending).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'asset-1' })
    );
  });

  it('should throw NotFoundException if asset not found', async () => {
    mediaAssetPort.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ assetId: 'asset-1', requesterUser: { id: 'user-1', role: 'CUSTOMER' } })
    ).rejects.toThrow(AppError);
  });

  it('should throw UnauthorizedException if user lacks permission', async () => {
    mediaAssetPort.findById.mockResolvedValue(mockAsset);


    await expect(
      useCase.execute({ assetId: 'asset-1', requesterUser: { id: 'user-2', role: 'CUSTOMER' } })
    ).rejects.toThrow(AppError);
  });

  it('should throw if unrelated LEADER attempts to delete another users Evidence', async () => {
    mediaAssetPort.findById.mockResolvedValue({
      ...mockAsset,
      scope: 'CONDITION_EVIDENCE',
    });

    await expect(
      useCase.execute({ assetId: 'asset-1', requesterUser: { id: 'user-leader-1', role: 'LEADER' } })
    ).rejects.toThrow(AppError);
  });

  it('should throw BadRequestException if asset has references', async () => {
    mediaAssetPort.findById.mockResolvedValue(mockAsset);

    mediaReferencePort.hasActiveReferences.mockResolvedValue(true);

    await expect(
      useCase.execute({ assetId: 'asset-1', requesterUser: { id: 'user-1', role: 'CUSTOMER' } })
    ).rejects.toThrow(AppError);
  });

  it('should throw if retention period has not expired', async () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    
    mediaAssetPort.findById.mockResolvedValue({
      ...mockAsset,
      retentionUntil: futureDate,
    });

    await expect(
      useCase.execute({ assetId: 'asset-1', requesterUser: { id: 'user-1', role: 'CUSTOMER' } })
    ).rejects.toThrow(/retention period has not expired/);
  });
});
