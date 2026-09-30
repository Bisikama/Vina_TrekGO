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
      // Mock findUnique to return REJECTED state
      prismaMock.mediaAsset.findUnique.mockResolvedValue({
        id: '123',
        ownerUserId: 'u1',
        status: 'REJECTED',
        scope: 'RENTAL_PRODUCT',
      });

      await expect(adapter.markReady({
        id: '123', ownerUserId: 'u1', providerAssetId: 'p1', providerPublicId: 'pub1',
        format: 'jpg', sizeBytes: 100, width: 10, height: 10, durationMs: null, secureUrl: 'url', uploadedAt: new Date()
      })).rejects.toThrow(/Cannot complete upload for asset in REJECTED state/);

      // Explicitly assert atomic update requirements
      expect(prismaMock.mediaAsset.updateMany).toHaveBeenCalledWith({
        where: {
          id: '123',
          ownerUserId: 'u1',
          status: 'PENDING_UPLOAD',
        },
        data: expect.objectContaining({
          status: 'READY',
          version: { increment: 1 },
        }),
      });
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
    let adapter: CloudinaryStorageAdapter;
    let envConfig: Record<string, unknown>;

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      envConfig = require('../../shared/config').default;
      adapter = new CloudinaryStorageAdapter();
    });

    it('does not throw when disabled and missing credentials', () => {
      const original = envConfig.MEDIA_ENABLED;
      envConfig.MEDIA_ENABLED = false;
      expect(() => adapter.onModuleInit()).not.toThrow();
      envConfig.MEDIA_ENABLED = original;
    });

    it('initializes successfully when enabled with valid credentials', () => {
      const origEnabled = envConfig.MEDIA_ENABLED;
      const origCloud = envConfig.CLOUDINARY_CLOUD_NAME;
      const origKey = envConfig.CLOUDINARY_API_KEY;
      const origSecret = envConfig.CLOUDINARY_API_SECRET;
      const origAlgo = envConfig.CLOUDINARY_SIGNATURE_ALGORITHM;

      envConfig.MEDIA_ENABLED = true;
      envConfig.CLOUDINARY_CLOUD_NAME = 'cloud';
      envConfig.CLOUDINARY_API_KEY = 'key';
      envConfig.CLOUDINARY_API_SECRET = 'secret';
      envConfig.CLOUDINARY_SIGNATURE_ALGORITHM = 'sha256';

      expect(() => adapter.onModuleInit()).not.toThrow();

      envConfig.MEDIA_ENABLED = origEnabled;
      envConfig.CLOUDINARY_CLOUD_NAME = origCloud;
      envConfig.CLOUDINARY_API_KEY = origKey;
      envConfig.CLOUDINARY_API_SECRET = origSecret;
      envConfig.CLOUDINARY_SIGNATURE_ALGORITHM = origAlgo;
    });

    it('throws error when enabled but missing cloud name', () => {
      const origEnabled = envConfig.MEDIA_ENABLED;
      const origCloud = envConfig.CLOUDINARY_CLOUD_NAME;
      
      envConfig.MEDIA_ENABLED = true;
      envConfig.CLOUDINARY_CLOUD_NAME = undefined;

      expect(() => adapter.onModuleInit()).toThrow('Cloudinary credentials are required when MEDIA_ENABLED is true');

      envConfig.MEDIA_ENABLED = origEnabled;
      envConfig.CLOUDINARY_CLOUD_NAME = origCloud;
    });

    it('throws error when enabled but missing api key', () => {
      const origEnabled = envConfig.MEDIA_ENABLED;
      const origKey = envConfig.CLOUDINARY_API_KEY;
      
      envConfig.MEDIA_ENABLED = true;
      envConfig.CLOUDINARY_API_KEY = undefined;

      expect(() => adapter.onModuleInit()).toThrow('Cloudinary credentials are required when MEDIA_ENABLED is true');

      envConfig.MEDIA_ENABLED = origEnabled;
      envConfig.CLOUDINARY_API_KEY = origKey;
    });

    it('throws error when enabled but missing api secret', () => {
      const origEnabled = envConfig.MEDIA_ENABLED;
      const origSecret = envConfig.CLOUDINARY_API_SECRET;
      
      envConfig.MEDIA_ENABLED = true;
      envConfig.CLOUDINARY_API_SECRET = undefined;

      expect(() => adapter.onModuleInit()).toThrow('Cloudinary credentials are required when MEDIA_ENABLED is true');

      envConfig.MEDIA_ENABLED = origEnabled;
      envConfig.CLOUDINARY_API_SECRET = origSecret;
    });

    it('throws error when signature algorithm is not sha256', () => {
      const origEnabled = envConfig.MEDIA_ENABLED;
      const origAlgo = envConfig.CLOUDINARY_SIGNATURE_ALGORITHM;
      
      envConfig.MEDIA_ENABLED = true;
      envConfig.CLOUDINARY_CLOUD_NAME = 'cloud';
      envConfig.CLOUDINARY_API_KEY = 'key';
      envConfig.CLOUDINARY_API_SECRET = 'secret';
      envConfig.CLOUDINARY_SIGNATURE_ALGORITHM = 'sha1';

      expect(() => adapter.onModuleInit()).toThrow('Cloudinary signature algorithm must be exactly sha256');

      envConfig.MEDIA_ENABLED = origEnabled;
      envConfig.CLOUDINARY_SIGNATURE_ALGORITHM = origAlgo;
    });
  });
});
