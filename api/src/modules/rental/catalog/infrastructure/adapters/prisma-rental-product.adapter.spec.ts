import { PrismaRentalProductAdapter } from './prisma-rental-product.adapter';
import {
  MediaScope,
  MediaResourceType,
  MediaStatus,
  RentalProductStatus,
} from '@prisma/client';
import {
  MEDIA_ERROR_CODES,
  RENTAL_ERROR_CODES,
} from '../../../../../shared/errors';
import type { PrismaService } from 'src/shared/services/prisma.service';

describe('PrismaRentalProductAdapter — Media Integration & Catalog Lifecycle', () => {
  const MEDIA_ID_1 = '11111111-1111-4111-8111-111111111111';
  const MEDIA_ID_2 = '22222222-2222-4222-8222-222222222222';
  const MEDIA_ID_3 = '33333333-3333-4333-8333-333333333333';

  let adapter: PrismaRentalProductAdapter;
  let mockPrisma: {
    rentalProduct: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      updateMany: jest.Mock;
    };
    mediaAsset: {
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  const makeDecimal = (num: number) => ({
    toNumber: () => num,
    toString: () => String(num),
  });

  const makeRawProduct = (overrides: Record<string, any> = {}) => ({
    id: 'prod-1',
    sku: 'TENT-4P-001',
    name: 'Lều 4 người',
    category: { id: 'cat-1', name: 'Lều trại', status: 'ACTIVE' },
    description: 'Lều chống nước 2 lớp',
    dailyPrice: makeDecimal(150000),
    depositPolicyType: 'FIXED',
    depositValue: makeDecimal(500000),
    currency: 'VND',
    replacementValue: makeDecimal(2000000),
    status: RentalProductStatus.ACTIVE,
    version: 1,
    images: [MEDIA_ID_1, MEDIA_ID_2],
    specifications: { weight: '2.5kg' },
    recommendationTags: ['camping'],
    ...overrides,
  });

  const makeReadyMediaRow = (id: string, overrides: Record<string, any> = {}) => ({
    id,
    scope: MediaScope.RENTAL_PRODUCT,
    resourceType: MediaResourceType.IMAGE,
    status: MediaStatus.READY,
    providerPublicId: `trekgo/rental-product/${id}`,
    secureUrl: `https://res.cloudinary.com/demo/image/upload/v1700000000/trekgo/rental-product/${id}.jpg`,
    mimeType: 'image/jpeg',
    width: 1920,
    height: 1080,
    ...overrides,
  });

  beforeEach(() => {
    mockPrisma = {
      rentalProduct: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      mediaAsset: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    adapter = new PrismaRentalProductAdapter(
      mockPrisma as unknown as PrismaService,
    );
  });

  describe('Reading & Resolving Product Media (listActiveProducts / getProductById)', () => {
    it('resolves imageMediaIds into structured images with Cloudinary transformation variants in order', async () => {
      const rawProduct = makeRawProduct({ images: [MEDIA_ID_2, MEDIA_ID_1] });
      mockPrisma.rentalProduct.findUnique.mockResolvedValue(rawProduct);
      mockPrisma.mediaAsset.findMany.mockResolvedValue([
        makeReadyMediaRow(MEDIA_ID_1),
        makeReadyMediaRow(MEDIA_ID_2),
      ]);

      const view = await adapter.getProductById('prod-1');

      expect(view).not.toBeNull();
      expect(view!.imageMediaIds).toEqual([MEDIA_ID_2, MEDIA_ID_1]);
      expect(view!.images).toHaveLength(2);
      // Preserves exact order of product.images
      expect(view!.images![0]).toEqual({
        mediaId: MEDIA_ID_2,
        url: `https://res.cloudinary.com/demo/image/upload/v1700000000/trekgo/rental-product/${MEDIA_ID_2}.jpg`,
        thumbnailUrl: `https://res.cloudinary.com/demo/image/upload/c_limit,f_auto,q_auto,w_320/v1700000000/trekgo/rental-product/${MEDIA_ID_2}.jpg`,
        cardUrl: `https://res.cloudinary.com/demo/image/upload/c_limit,f_auto,q_auto,w_720/v1700000000/trekgo/rental-product/${MEDIA_ID_2}.jpg`,
        detailUrl: `https://res.cloudinary.com/demo/image/upload/c_limit,f_auto,q_auto,w_1600/v1700000000/trekgo/rental-product/${MEDIA_ID_2}.jpg`,
        mimeType: 'image/jpeg',
        width: 1920,
        height: 1080,
      });
      expect(view!.images![1].mediaId).toBe(MEDIA_ID_1);
    });

    it('batches media resolution into a single query when listing multiple products', async () => {
      mockPrisma.rentalProduct.findMany.mockResolvedValue([
        makeRawProduct({ id: 'prod-1', images: [MEDIA_ID_1] }),
        makeRawProduct({ id: 'prod-2', images: [MEDIA_ID_2] }),
      ]);
      mockPrisma.rentalProduct.count.mockResolvedValue(2);
      mockPrisma.mediaAsset.findMany.mockResolvedValue([
        makeReadyMediaRow(MEDIA_ID_1),
        makeReadyMediaRow(MEDIA_ID_2),
      ]);

      const result = await adapter.listActiveProducts({ page: 1, pageSize: 20 });

      expect(mockPrisma.mediaAsset.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.mediaAsset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: { in: [MEDIA_ID_1, MEDIA_ID_2] },
            scope: MediaScope.RENTAL_PRODUCT,
            resourceType: MediaResourceType.IMAGE,
            status: MediaStatus.READY,
            deletedAt: null,
          },
        }),
      );
      expect(result.items[0].images).toHaveLength(1);
      expect(result.items[1].images).toHaveLength(1);
    });
  });

  describe('Creating Product with Media Validation & Retention Sync (createProduct)', () => {
    const baseCreateParams = {
      categoryId: 'cat-1',
      sku: 'TENT-4P-001',
      name: 'Lều 4 người',
      dailyPrice: 150000,
      currency: 'VND',
      replacementValue: 2000000,
      depositPolicy: { type: 'FIXED', amount: 500000 },
    };

    it('validates READY RENTAL_PRODUCT images, deduplicates IDs, and clears retentionUntil', async () => {
      mockPrisma.mediaAsset.findMany
        // 1st call: validation
        .mockResolvedValueOnce([
          makeReadyMediaRow(MEDIA_ID_1),
          makeReadyMediaRow(MEDIA_ID_2),
        ])
        // 2nd call: resolveMediaMap for response view
        .mockResolvedValueOnce([
          makeReadyMediaRow(MEDIA_ID_1),
          makeReadyMediaRow(MEDIA_ID_2),
        ]);
      mockPrisma.rentalProduct.create.mockResolvedValue(
        makeRawProduct({ images: [MEDIA_ID_1, MEDIA_ID_2] }),
      );
      mockPrisma.mediaAsset.updateMany.mockResolvedValue({ count: 2 });

      const result = await adapter.createProduct({
        ...baseCreateParams,
        imageMediaIds: [MEDIA_ID_1, MEDIA_ID_2, MEDIA_ID_1],
      });

      expect(mockPrisma.rentalProduct.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            images: [MEDIA_ID_1, MEDIA_ID_2],
          }),
        }),
      );
      expect(mockPrisma.mediaAsset.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [MEDIA_ID_1, MEDIA_ID_2] } },
        data: { retentionUntil: null },
      });
      expect(result.imageMediaIds).toEqual([MEDIA_ID_1, MEDIA_ID_2]);
      expect(result.images).toHaveLength(2);
    });

    it('throws MEDIA_NOT_FOUND (404) when any imageMediaId does not exist or is deleted', async () => {
      mockPrisma.mediaAsset.findMany.mockResolvedValue([
        makeReadyMediaRow(MEDIA_ID_1),
      ]);

      await expect(
        adapter.createProduct({
          ...baseCreateParams,
          imageMediaIds: [MEDIA_ID_1, MEDIA_ID_2],
        }),
      ).rejects.toMatchObject({
        code: MEDIA_ERROR_CODES.MEDIA_NOT_FOUND,
        details: { mediaIds: [MEDIA_ID_2] },
      });
      expect(mockPrisma.rentalProduct.create).not.toHaveBeenCalled();
    });

    it('throws MEDIA_INVALID_SCOPE (422) when media belongs to a non-catalog scope', async () => {
      mockPrisma.mediaAsset.findMany.mockResolvedValue([
        makeReadyMediaRow(MEDIA_ID_1, { scope: MediaScope.CONDITION_EVIDENCE }),
      ]);

      await expect(
        adapter.createProduct({
          ...baseCreateParams,
          imageMediaIds: [MEDIA_ID_1],
        }),
      ).rejects.toMatchObject({
        code: MEDIA_ERROR_CODES.MEDIA_INVALID_SCOPE,
        details: {
          mediaIds: [MEDIA_ID_1],
          expectedScope: MediaScope.RENTAL_PRODUCT,
        },
      });
      expect(mockPrisma.rentalProduct.create).not.toHaveBeenCalled();
    });

    it('throws MEDIA_INVALID_RESOURCE_TYPE (422) when media is VIDEO instead of IMAGE', async () => {
      mockPrisma.mediaAsset.findMany.mockResolvedValue([
        makeReadyMediaRow(MEDIA_ID_1, { resourceType: MediaResourceType.VIDEO }),
      ]);

      await expect(
        adapter.createProduct({
          ...baseCreateParams,
          imageMediaIds: [MEDIA_ID_1],
        }),
      ).rejects.toMatchObject({
        code: MEDIA_ERROR_CODES.MEDIA_INVALID_RESOURCE_TYPE,
        details: {
          mediaIds: [MEDIA_ID_1],
          expectedResourceType: MediaResourceType.IMAGE,
        },
      });
      expect(mockPrisma.rentalProduct.create).not.toHaveBeenCalled();
    });

    it('throws MEDIA_INVALID_STATE (409) when media is still PENDING_UPLOAD or REJECTED', async () => {
      mockPrisma.mediaAsset.findMany.mockResolvedValue([
        makeReadyMediaRow(MEDIA_ID_1, { status: MediaStatus.PENDING_UPLOAD }),
      ]);

      await expect(
        adapter.createProduct({
          ...baseCreateParams,
          imageMediaIds: [MEDIA_ID_1],
        }),
      ).rejects.toMatchObject({
        code: MEDIA_ERROR_CODES.MEDIA_INVALID_STATE,
        details: {
          mediaIds: [MEDIA_ID_1],
          expectedStatus: MediaStatus.READY,
        },
      });
      expect(mockPrisma.rentalProduct.create).not.toHaveBeenCalled();
    });
  });

  describe('Updating Product Media & Orphan Retention Restoration (updateProduct)', () => {
    it('clears retentionUntil for attached images and restores orphan retentionUntil for unreferenced removed images', async () => {
      // Validation returns READY for MEDIA_ID_2 and MEDIA_ID_3
      mockPrisma.mediaAsset.findMany
        .mockResolvedValueOnce([
          makeReadyMediaRow(MEDIA_ID_2),
          makeReadyMediaRow(MEDIA_ID_3),
        ])
        .mockResolvedValueOnce([
          makeReadyMediaRow(MEDIA_ID_2),
          makeReadyMediaRow(MEDIA_ID_3),
        ]);

      // 1st findUnique: existing product has [MEDIA_ID_1, MEDIA_ID_2]
      // 2nd findUnique: updated product has [MEDIA_ID_2, MEDIA_ID_3]
      mockPrisma.rentalProduct.findUnique
        .mockResolvedValueOnce({ images: [MEDIA_ID_1, MEDIA_ID_2] })
        .mockResolvedValueOnce(
          makeRawProduct({ version: 2, images: [MEDIA_ID_2, MEDIA_ID_3] }),
        );
      mockPrisma.rentalProduct.updateMany.mockResolvedValue({ count: 1 });
      // MEDIA_ID_1 is no longer referenced by any product
      mockPrisma.rentalProduct.count.mockResolvedValue(0);
      mockPrisma.mediaAsset.updateMany.mockResolvedValue({ count: 1 });

      const updated = await adapter.updateProduct({
        id: 'prod-1',
        expectedVersion: 1,
        imageMediaIds: [MEDIA_ID_2, MEDIA_ID_3],
      });

      expect(updated.version).toBe(2);
      expect(updated.imageMediaIds).toEqual([MEDIA_ID_2, MEDIA_ID_3]);

      // Attached media gets retentionUntil: null
      expect(mockPrisma.mediaAsset.updateMany).toHaveBeenNthCalledWith(1, {
        where: { id: { in: [MEDIA_ID_2, MEDIA_ID_3] } },
        data: { retentionUntil: null },
      });

      // Removed unreferenced MEDIA_ID_1 gets orphan retentionUntil restored
      expect(mockPrisma.rentalProduct.count).toHaveBeenCalledWith({
        where: { images: { array_contains: [MEDIA_ID_1] } },
      });
      expect(mockPrisma.mediaAsset.updateMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { id: { in: [MEDIA_ID_1] }, status: MediaStatus.READY },
          data: { retentionUntil: expect.any(Date) },
        }),
      );
    });

    it('does not set orphan retentionUntil if removed image is still referenced by another product', async () => {
      mockPrisma.mediaAsset.findMany
        .mockResolvedValueOnce([makeReadyMediaRow(MEDIA_ID_2)])
        .mockResolvedValueOnce([makeReadyMediaRow(MEDIA_ID_2)]);
      mockPrisma.rentalProduct.findUnique
        .mockResolvedValueOnce({ images: [MEDIA_ID_1, MEDIA_ID_2] })
        .mockResolvedValueOnce(
          makeRawProduct({ version: 2, images: [MEDIA_ID_2] }),
        );
      mockPrisma.rentalProduct.updateMany.mockResolvedValue({ count: 1 });
      // MEDIA_ID_1 is still referenced by 1 other product
      mockPrisma.rentalProduct.count.mockResolvedValue(1);
      mockPrisma.mediaAsset.updateMany.mockResolvedValue({ count: 1 });

      await adapter.updateProduct({
        id: 'prod-1',
        expectedVersion: 1,
        imageMediaIds: [MEDIA_ID_2],
      });

      expect(mockPrisma.mediaAsset.updateMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.mediaAsset.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [MEDIA_ID_2] } },
        data: { retentionUntil: null },
      });
    });

    it('throws VERSION_CONFLICT (409) when expectedVersion does not match', async () => {
      mockPrisma.rentalProduct.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.rentalProduct.findUnique.mockResolvedValue(makeRawProduct());

      await expect(
        adapter.updateProduct({
          id: 'prod-1',
          expectedVersion: 1,
          name: 'Changed',
        }),
      ).rejects.toMatchObject({
        code: RENTAL_ERROR_CODES.VERSION_CONFLICT,
      });
    });
  });
});
