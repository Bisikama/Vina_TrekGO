/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaMediaAssetAdapter } from './prisma-media-asset.adapter';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { AppError } from '../../../../shared/errors/app-error';
import { MEDIA_ERROR_CODES } from '../../../../shared/errors/codes/media.error-codes';
import type { Prisma } from '@prisma/client';

describe('PrismaMediaAssetAdapter', () => {
  let adapter: PrismaMediaAssetAdapter;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaMediaAssetAdapter,
        {
          provide: PrismaService,
          useValue: {
            mediaAsset: {
              updateMany: jest.fn(),
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    adapter = module.get<PrismaMediaAssetAdapter>(PrismaMediaAssetAdapter);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('State Machine Transitions', () => {
    const mockAsset = {
      id: 'asset-1',
      ownerUserId: 'user-1',
      status: 'PENDING_UPLOAD',
      scope: 'RENTAL_PRODUCT',
      resourceType: 'IMAGE',
      captureSource: 'CAMERA',
      provenanceStatus: 'UNKNOWN',
      c2paStatus: 'NOT_CHECKED',
    };

    it('should transition PENDING_UPLOAD -> PROCESSING on claimForProcessing', async () => {
      (prismaService.mediaAsset.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prismaService.mediaAsset.findUnique as jest.Mock).mockResolvedValue({ ...mockAsset, status: 'PROCESSING' });

      const result = await adapter.claimForProcessing({ id: 'asset-1', ownerUserId: 'user-1' });

      expect(prismaService.mediaAsset.updateMany).toHaveBeenCalledWith({
        where: { id: 'asset-1', ownerUserId: 'user-1', status: 'PENDING_UPLOAD' },
        data: { status: 'PROCESSING', version: { increment: 1 } },
      });
      expect(result.status).toBe('PROCESSING');
    });

    it('should fail claimForProcessing if asset is not in PENDING_UPLOAD (concurrency test)', async () => {
      (prismaService.mediaAsset.updateMany as jest.Mock).mockResolvedValue({ count: 0 }); // simulate already claimed

      await expect(adapter.claimForProcessing({ id: 'asset-1', ownerUserId: 'user-1' }))
        .rejects
        .toThrow(new AppError({
          code: MEDIA_ERROR_CODES.MEDIA_INVALID_STATE,
          message: 'Cannot claim media asset for processing. It may not be in PENDING_UPLOAD state or you do not have permission.',
        }));
    });

    it('should transition PROCESSING -> READY on markReadyFromProcessing', async () => {
      (prismaService.mediaAsset.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prismaService.mediaAsset.findUnique as jest.Mock).mockResolvedValue({ ...mockAsset, status: 'READY' });

      const result = await adapter.markReadyFromProcessing({
        id: 'asset-1',
        ownerUserId: 'user-1',
        providerAssetId: 'provider-1',
        providerPublicId: 'public-1',
        format: 'jpg',
        sizeBytes: 1000,
        width: 100,
        height: 100,
        durationMs: null,
        secureUrl: 'https://example.com/image.jpg',
        uploadedAt: new Date(),
        retentionUntil: new Date(),
      });

      expect(prismaService.mediaAsset.updateMany).toHaveBeenCalledWith({
        where: { id: 'asset-1', ownerUserId: 'user-1', status: 'PROCESSING' },
        data: expect.objectContaining({ status: 'READY' }),
      });
      expect(result.status).toBe('READY');
    });

    it('should transition PROCESSING -> REJECTED on markRejectedFromProcessing', async () => {
      (prismaService.mediaAsset.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prismaService.mediaAsset.findUnique as jest.Mock).mockResolvedValue({ ...mockAsset, status: 'REJECTED' });

      const result = await adapter.markRejectedFromProcessing({ id: 'asset-1', ownerUserId: 'user-1', reason: 'Invalid signature', retentionUntil: new Date() });

      expect(prismaService.mediaAsset.updateMany).toHaveBeenCalledWith({
        where: { id: 'asset-1', ownerUserId: 'user-1', status: 'PROCESSING' },
        data: expect.objectContaining({ status: 'REJECTED' }),
      });
      expect(result.status).toBe('REJECTED');
    });

    it('should transition PROCESSING -> PENDING_UPLOAD on revertProcessingToPending', async () => {
      (prismaService.mediaAsset.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prismaService.mediaAsset.findUnique as jest.Mock).mockResolvedValue({ ...mockAsset, status: 'PENDING_UPLOAD' });

      const result = await adapter.revertProcessingToPending({ id: 'asset-1', reason: 'Temporary network failure' });

      expect(prismaService.mediaAsset.updateMany).toHaveBeenCalledWith({
        where: { id: 'asset-1', status: 'PROCESSING' },
        data: expect.objectContaining({ status: 'PENDING_UPLOAD' }),
      });
      expect(result.status).toBe('PENDING_UPLOAD');
    });
  });

  describe('findDeletePendingAssets', () => {
    it('should select candidates correctly based on retention and status', async () => {
      prismaService.mediaAsset.findMany = jest.fn().mockResolvedValue([]);
      
      await adapter.findDeletePendingAssets({ limit: 50 });

      expect(prismaService.mediaAsset.findMany).toHaveBeenCalledWith(expect.objectContaining({
        take: 50,
        where: expect.objectContaining({
          status: { not: 'DELETED' },
          OR: [
            { status: 'DELETE_PENDING' },
            { retentionUntil: { lte: expect.any(Date) } }
          ]
        })
      }));
    });
  });
});
