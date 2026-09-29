import { Test, TestingModule } from '@nestjs/testing';
import { MediaModule } from './media.module';
import { PrismaMediaAssetAdapter } from './infrastructure/adapters/prisma-media-asset.adapter';
import { CloudinaryStorageAdapter } from './infrastructure/adapters/cloudinary-storage.adapter';
import { MEDIA_ASSET_PORT } from './application/ports/media-asset.port';
import { MEDIA_STORAGE_PORT } from './application/ports/media-storage.port';
import { PrismaService } from '../../shared/services/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

describe('Media Foundation', () => {
  describe('Architecture', () => {
    it('application files do not import @prisma/client or cloudinary', () => {
      const appDir = path.join(__dirname, 'application');
      const files = fs.readdirSync(appDir, { recursive: true }) as string[];

      for (const file of files) {
        if (file.endsWith('.ts')) {
          const content = fs.readFileSync(path.join(appDir, file), 'utf8');
          expect(content).not.toMatch(/@prisma\/client/);
          expect(content).not.toMatch(/cloudinary/);
          expect(content).not.toMatch(/presentation/);
        }
      }
    });

    it('no avoidable any in application files', () => {
      const appDir = path.join(__dirname, 'application');
      const files = fs.readdirSync(appDir, { recursive: true }) as string[];

      for (const file of files) {
        if (file.endsWith('.ts')) {
          const content = fs.readFileSync(path.join(appDir, file), 'utf8');
          expect(content).not.toMatch(/\bany\b/);
        }
      }
    });
  });

  describe('Module Wiring', () => {
    it('provides MEDIA_ASSET_PORT and MEDIA_STORAGE_PORT', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [MediaModule],
      })
        .overrideProvider(PrismaService)
        .useValue({})
        .compile();

      const assetPort = module.get(MEDIA_ASSET_PORT);
      const storagePort = module.get(MEDIA_STORAGE_PORT);

      expect(assetPort).toBeDefined();
      expect(storagePort).toBeDefined();
      expect(assetPort).toBeInstanceOf(PrismaMediaAssetAdapter);
      expect(storagePort).toBeInstanceOf(CloudinaryStorageAdapter);
    });
  });

  describe('PrismaMediaAssetAdapter', () => {
    let adapter: PrismaMediaAssetAdapter;
    let prismaMock: { mediaAsset: { findUnique: jest.Mock, updateMany: jest.Mock, create: jest.Mock, update: jest.Mock } };

    beforeEach(() => {
      prismaMock = {
        mediaAsset: {
          findUnique: jest.fn(),
          updateMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
      };
      adapter = new PrismaMediaAssetAdapter(prismaMock as unknown as PrismaService);
    });

    it('returns null when missing', async () => {
      prismaMock.mediaAsset.findUnique.mockResolvedValue(null);
      const result = await adapter.findById({ id: '123' });
      expect(result).toBeNull();
    });

    it('maps MediaAsset correctly and converts sizeBytes BigInt -> number', async () => {
      prismaMock.mediaAsset.findUnique.mockResolvedValue({
        id: '123',
        scope: 'RENTAL_PRODUCT',
        resourceType: 'IMAGE',
        status: 'READY',
        mimeType: 'image/jpeg',
        sizeBytes: BigInt(1024),
        width: 800,
        height: 600,
        durationMs: null,
        captureSource: 'CAMERA',
        provenanceStatus: 'DIRECT_CAPTURE',
        readyAt: new Date(),
        uploadIntentExpiresAt: new Date(),
        providerPublicId: 'trekgo/test/123',
        deliveryType: 'upload',
        version: 1, // raw Prisma entity might have this
      });

      const result = await adapter.findById({ id: '123' });
      
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.sizeBytes).toBe(1024);
      expect(typeof result.sizeBytes).toBe('number');
      // Should not return raw Prisma entity fields like version
      expect((result as unknown as Record<string, unknown>).version).toBeUndefined();
    });

    it('throws MEDIA_INVALID_STATE if markReady affects 0 rows and asset is not READY', async () => {
      // Mock updateMany to return count 0
      prismaMock.mediaAsset.updateMany.mockResolvedValue({ count: 0 });
      // Mock findUnique to return ARCHIVED state
      prismaMock.mediaAsset.findUnique.mockResolvedValue({
        id: '123',
        ownerUserId: 'u1',
        status: 'ARCHIVED',
        scope: 'RENTAL_PRODUCT',
      });

      await expect(adapter.markReady({
        id: '123', ownerUserId: 'u1', providerAssetId: 'p1', providerPublicId: 'pub1',
        format: 'jpg', sizeBytes: 100, width: 10, height: 10, durationMs: null, secureUrl: 'url', uploadedAt: new Date()
      })).rejects.toThrow(/Cannot complete upload for asset in ARCHIVED state/);
    });

    it('returns existing asset idempotently if markReady affects 0 rows but asset is READY', async () => {
      prismaMock.mediaAsset.updateMany.mockResolvedValue({ count: 0 });
      prismaMock.mediaAsset.findUnique.mockResolvedValue({
        id: '123',
        ownerUserId: 'u1',
        status: 'READY',
        scope: 'RENTAL_PRODUCT',
      });

      const result = await adapter.markReady({
        id: '123', ownerUserId: 'u1', providerAssetId: 'p1', providerPublicId: 'pub1',
        format: 'jpg', sizeBytes: 100, width: 10, height: 10, durationMs: null, secureUrl: 'url', uploadedAt: new Date()
      });

      expect(result.status).toBe('READY');
      expect(result.id).toBe('123');
    });
  });

  describe('CloudinaryStorageAdapter', () => {
    it('missing configuration follows the projects accepted M0.1 behavior (warns but does not throw)', () => {
      // In M0.1 it might just mock or safely initialize without crashing.
      const adapter = new CloudinaryStorageAdapter();
      const loggerSpy = jest.spyOn((adapter as any).logger, 'warn').mockImplementation(() => {});
      
      const originalCloudName = process.env.CLOUDINARY_CLOUD_NAME;
      // Note: the adapter imports the already-evaluated config.ts, so we can't easily change process.env and have it reflect.
      // But we can mock the config module or just mock the values if it was a class property.
      // Actually, since it imports `envConfig`, we can mutate `envConfig` temporarily.
      // We already import envConfig from config at the top? No, we will just use process.env and let the mock handle it if we could, but we can't easily.
      // We will use a dynamic import or just disable the lint line.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const envConfig = require('../../shared/config').default;
      const originalCloudNameFromConfig = envConfig.CLOUDINARY_CLOUD_NAME;
      envConfig.CLOUDINARY_CLOUD_NAME = undefined;

      adapter.onModuleInit();
      // Should instantiate and run init safely without throwing
      expect(adapter).toBeDefined();
      expect(loggerSpy).toHaveBeenCalled();
      
      envConfig.CLOUDINARY_CLOUD_NAME = originalCloudNameFromConfig;
      loggerSpy.mockRestore();
    });
  });
});
