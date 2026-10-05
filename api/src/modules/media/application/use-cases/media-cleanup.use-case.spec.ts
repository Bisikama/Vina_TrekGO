import { MediaCleanupUseCase } from './media-cleanup.use-case';
import { MediaAssetPort, MediaAssetView } from '../ports/media-asset.port';
import { MediaStoragePort } from '../ports/media-storage.port';
import { MediaReferencePort } from '../ports/media-reference.port';
import { Logger } from '@nestjs/common';

describe('MediaCleanupUseCase', () => {
  let useCase: MediaCleanupUseCase;
  let mockAssetPort: jest.Mocked<MediaAssetPort>;
  let mockStoragePort: jest.Mocked<MediaStoragePort>;
  let mockRefPort: jest.Mocked<MediaReferencePort>;

  beforeEach(() => {
    mockAssetPort = {
      findDeletePendingAssets: jest.fn(),
      markDeletePending: jest.fn(),
      markDeleted: jest.fn(),
    } as unknown as jest.Mocked<MediaAssetPort>;

    mockStoragePort = {
      deleteAsset: jest.fn(),
    } as unknown as jest.Mocked<MediaStoragePort>;

    mockRefPort = {
      hasActiveReferences: jest.fn(),
    };

    useCase = new MediaCleanupUseCase(mockAssetPort, mockStoragePort, mockRefPort);
    
    // Silence logger during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockAsset = (overrides: Partial<MediaAssetView> = {}): MediaAssetView => ({
    id: 'asset-1',
    ownerUserId: 'user-1',
    scope: 'RENTAL_PRODUCT',
    status: 'DELETE_PENDING',
    providerPublicId: 'public-id-1',
    resourceType: 'IMAGE',
    deliveryType: 'upload',
    mimeType: 'image/jpeg',
    sizeBytes: 100,
    width: null,
    height: null,
    durationMs: null,
    captureSource: 'SYSTEM',
    clientCapturedAt: null,
    provenanceStatus: 'UNKNOWN',
    readyAt: null,
    uploadIntentExpiresAt: null,
    retentionUntil: null,
    ...overrides,
  });

  it('should successfully cleanup a DELETE_PENDING asset', async () => {
    mockAssetPort.findDeletePendingAssets.mockResolvedValue([createMockAsset()]);
    mockStoragePort.deleteAsset.mockResolvedValue();

    await useCase.execute();

    expect(mockStoragePort.deleteAsset).toHaveBeenCalledWith({
      providerPublicId: 'public-id-1',
      resourceType: 'IMAGE',
      deliveryType: 'upload',
      invalidate: true,
    });
    expect(mockAssetPort.markDeleted).toHaveBeenCalledWith({ id: 'asset-1' });
  });

  it('should not delete if deliveryType is missing', async () => {
    mockAssetPort.findDeletePendingAssets.mockResolvedValue([createMockAsset({ deliveryType: null })]);

    await useCase.execute();

    expect(mockStoragePort.deleteAsset).not.toHaveBeenCalled();
    expect(mockAssetPort.markDeleted).not.toHaveBeenCalled(); // Skipping, keeping in DELETE_PENDING or loop
  });

  it('should block deletion of referenced READY media', async () => {
    mockAssetPort.findDeletePendingAssets.mockResolvedValue([
      createMockAsset({ status: 'READY' })
    ]);
    mockRefPort.hasActiveReferences.mockResolvedValue(true);

    await useCase.execute();

    expect(mockRefPort.hasActiveReferences).toHaveBeenCalledWith('asset-1');
    expect(mockStoragePort.deleteAsset).not.toHaveBeenCalled();
    expect(mockAssetPort.markDeletePending).not.toHaveBeenCalled();
  });

  it('should mark unreferenced READY catalog media as DELETE_PENDING and delete it', async () => {
    mockAssetPort.findDeletePendingAssets.mockResolvedValue([
      createMockAsset({ status: 'READY', scope: 'RENTAL_PRODUCT' })
    ]);
    mockRefPort.hasActiveReferences.mockResolvedValue(false);
    mockStoragePort.deleteAsset.mockResolvedValue();

    await useCase.execute();

    expect(mockAssetPort.markDeletePending).toHaveBeenCalledWith({ id: 'asset-1' });
    expect(mockStoragePort.deleteAsset).toHaveBeenCalled();
    expect(mockAssetPort.markDeleted).toHaveBeenCalled();
  });

  it('should continue if provider delete fails', async () => {
    mockAssetPort.findDeletePendingAssets.mockResolvedValue([
      createMockAsset({ id: 'asset-1' }),
      createMockAsset({ id: 'asset-2', providerPublicId: 'public-id-2' })
    ]);

    mockStoragePort.deleteAsset
      .mockRejectedValueOnce(new Error('Provider fail'))
      .mockResolvedValueOnce();

    await useCase.execute();

    expect(mockAssetPort.markDeleted).not.toHaveBeenCalledWith({ id: 'asset-1' });
    expect(mockAssetPort.markDeleted).toHaveBeenCalledWith({ id: 'asset-2' });
  });

  it('should handle repeat run / idempotency if already running', async () => {
    mockAssetPort.findDeletePendingAssets.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve([]), 50)));
    
    const firstCall = useCase.execute();
    const secondCall = useCase.execute();

    await Promise.all([firstCall, secondCall]);

    expect(mockAssetPort.findDeletePendingAssets).toHaveBeenCalledTimes(1);
  });
});
