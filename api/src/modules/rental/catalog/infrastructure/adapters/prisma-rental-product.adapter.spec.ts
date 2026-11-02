import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { RentalProductController } from '../../presentation/controllers/rental-product.controller';
import { GetRentalProductUseCase } from '../../application/use-cases/get-rental-product.use-case';
import { ListRentalProductsUseCase } from '../../application/use-cases/list-rental-products.use-case';
import { RENTAL_PRODUCT_PORT } from '../../application/ports/rental-product.port';
import { CreateRentalProductSchema } from '../../presentation/dtos/create-rental-product.dto';
import { UpdateRentalProductSchema } from '../../presentation/dtos/update-rental-product.dto';
import { PrismaRentalProductAdapter } from './prisma-rental-product.adapter';
import {
  MediaScope,
  MediaResourceType,
  MediaStatus,
  Prisma,
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
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
    rentalProduct: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    rentalProductPriceHistory: {
      updateMany: jest.Mock;
      create: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
    };
    mediaAsset: {
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  /** grade_group_id trả về khi adapter đọc nhóm của sản phẩm trước khi khoá. */
  let lockedGroupId: string | null;

  const makeDecimal = (num: number) => new Prisma.Decimal(num);

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
    lockedGroupId = null;
    mockPrisma = {
      // Transaction chạy callback trên chính mock, để kiểm được các lệnh ghi bên trong.
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(mockPrisma)),
      $queryRaw: jest.fn((strings: TemplateStringsArray) => {
        const sql = strings.join('?');
        if (sql.includes('clock_timestamp')) return Promise.resolve([{ now: new Date('2026-10-30T00:00:00Z') }]);
        if (sql.includes('SELECT grade_group_id')) return Promise.resolve([{ grade_group_id: lockedGroupId }]);
        return Promise.resolve([]);
      }),
      rentalProduct: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      rentalProductPriceHistory: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
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
    it('returns seed image URLs without querying them as media UUIDs', async () => {
      const url = 'https://example.com/tent.jpg';
      mockPrisma.rentalProduct.findUnique.mockResolvedValue(makeRawProduct({ images: [url, MEDIA_ID_1] }));
      mockPrisma.mediaAsset.findMany.mockResolvedValue([makeReadyMediaRow(MEDIA_ID_1)]);
      const view = await adapter.getProductById('prod-1');
      expect(mockPrisma.mediaAsset.findMany.mock.calls[0][0].where.id.in).toEqual([MEDIA_ID_1]);
      expect(view!.images![0]).toMatchObject({ url, cardUrl: url });
      expect(view!.images![1].mediaId).toBe(MEDIA_ID_1);
    });
    it.each([
      ['fixed', { depositPolicyType: 'FIXED', depositValue: makeDecimal(400000), replacementValue: makeDecimal(2000000) }, 400000, 20],
      ['percentage rounded to VND', { depositPolicyType: 'PERCENT_REPLACEMENT_VALUE', depositValue: makeDecimal(33.33), replacementValue: makeDecimal(10) }, 3, 30],
      ['zero replacement value', { depositPolicyType: 'FIXED', depositValue: makeDecimal(400000), replacementValue: makeDecimal(0) }, 400000, null],
      ['fractional legacy amount', { depositPolicyType: 'FIXED', depositValue: makeDecimal(400000.5), replacementValue: makeDecimal(2000000) }, null, null],
    ])('maps %s deposit consistently with quote without breaking catalog reads', async (_name, overrides, depositPerUnit, percentage) => {
      mockPrisma.rentalProduct.findUnique.mockResolvedValue(makeRawProduct({ ...overrides, images: [] }));
      const result = await adapter.getProductById('prod-1');
      expect(result).toMatchObject({
        depositPerUnit,
        depositExplanation: { percentageOfReplacementValue: percentage, formula: 'depositPerUnit / replacementValue * 100' },
      });
      if (depositPerUnit !== null) expect(result!.depositPolicy.amount).toBe(depositPerUnit);
    });

    it('lists each grade with its own deposit explanation', async () => {
      mockPrisma.rentalProduct.findMany.mockResolvedValue([
        makeRawProduct({ id: 'new', images: [], grade: 'LIKE_NEW', depositValue: makeDecimal(600000) }),
        makeRawProduct({ id: 'used', images: [], grade: 'GOOD_USED', depositValue: makeDecimal(400000) }),
      ]);
      mockPrisma.rentalProduct.count.mockResolvedValue(2);
      const result = await adapter.listActiveProducts({ page: 1, pageSize: 20 });
      expect(result.items.map(item => [item.depositPerUnit, item.depositExplanation?.percentageOfReplacementValue]))
        .toEqual([[600000, 30], [400000, 20]]);
    });

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
      actorUserId: 'admin-1',
      actorRole: 'ADMIN',
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

      // 1st findUnique: existing images [MEDIA_ID_1, MEDIA_ID_2] (read before the transaction)
      // 2nd/3rd findUnique: row before/after the write inside the transaction
      // 4th findUnique: updated product returned to the caller
      mockPrisma.rentalProduct.findUnique
        .mockResolvedValueOnce({ images: [MEDIA_ID_1, MEDIA_ID_2] })
        .mockResolvedValueOnce(makeRawProduct({ version: 1 }))
        .mockResolvedValueOnce(makeRawProduct({ version: 2, images: [MEDIA_ID_2, MEDIA_ID_3] }))
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
        actorUserId: 'staff-1',
        actorRole: 'STAFF_INVENTORY',
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
        .mockResolvedValueOnce(makeRawProduct({ version: 1 }))
        .mockResolvedValueOnce(makeRawProduct({ version: 2, images: [MEDIA_ID_2] }))
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
        actorUserId: 'staff-1',
        actorRole: 'STAFF_INVENTORY',
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
          actorUserId: 'staff-1',
          actorRole: 'STAFF_INVENTORY',
        }),
      ).rejects.toMatchObject({
        code: RENTAL_ERROR_CODES.VERSION_CONFLICT,
      });
    });
  });

  describe('Pricing rules: financial fields, price history, grade groups', () => {
    const GROUP_ID = '99999999-9999-4999-8999-999999999999';
    const admin = { actorUserId: 'admin-1', actorRole: 'ADMIN' };
    const staff = { actorUserId: 'staff-1', actorRole: 'STAFF_INVENTORY' };

    it('STAFF_INVENTORY cannot change the deposit; nothing is written', async () => {
      mockPrisma.rentalProduct.findUnique.mockResolvedValue(makeRawProduct());

      await expect(
        adapter.updateProduct({ ...staff, id: 'prod-1', expectedVersion: 1, depositPolicy: { type: 'FIXED', amount: 1 } }),
      ).rejects.toMatchObject({
        code: RENTAL_ERROR_CODES.RENTAL_PRODUCT_FINANCIAL_FIELDS_ADMIN_ONLY,
        details: { fields: ['depositPolicy'] },
      });
      expect(mockPrisma.rentalProduct.updateMany).not.toHaveBeenCalled();
    });

    it('STAFF_INVENTORY may resend the current deposit and change dailyPrice; history is recorded', async () => {
      mockPrisma.rentalProduct.findUnique
        .mockResolvedValueOnce(makeRawProduct())
        .mockResolvedValueOnce(makeRawProduct({ version: 2, dailyPrice: makeDecimal(170000) }))
        .mockResolvedValueOnce(makeRawProduct({ version: 2, dailyPrice: makeDecimal(170000) }));
      mockPrisma.rentalProduct.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.mediaAsset.findMany.mockResolvedValue([]);

      await adapter.updateProduct({
        ...staff,
        id: 'prod-1',
        expectedVersion: 1,
        dailyPrice: 170000,
        depositPolicy: { type: 'FIXED', amount: 500000 },
      });

      expect(mockPrisma.rentalProductPriceHistory.updateMany).toHaveBeenCalledWith({
        where: { productId: 'prod-1', effectiveTo: null },
        data: { effectiveTo: new Date('2026-10-30T00:00:00Z') },
      });
      expect(mockPrisma.rentalProductPriceHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ productId: 'prod-1', changedBy: 'staff-1', reason: 'UPDATE' }),
      });
    });

    it('STAFF_INVENTORY creates an INACTIVE product with no deposit yet', async () => {
      mockPrisma.rentalProduct.create.mockResolvedValue(makeRawProduct({ status: RentalProductStatus.INACTIVE, images: [] }));
      mockPrisma.mediaAsset.findMany.mockResolvedValue([]);

      await adapter.createProduct({
        ...staff,
        categoryId: 'cat-1',
        sku: 'TENT-NEW',
        name: 'Lều mới',
        dailyPrice: 150000,
        currency: 'VND',
      });

      expect(mockPrisma.rentalProduct.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: RentalProductStatus.INACTIVE,
            depositPolicyType: 'FIXED',
            depositValue: 0,
            replacementValue: 0,
          }),
        }),
      );
    });

    it('ADMIN adding a grade syncs replacementValue to the sibling and keeps LIKE_NEW above GOOD_USED', async () => {
      const likeNew = makeRawProduct({
        id: 'prod-ln',
        gradeGroupId: GROUP_ID,
        grade: 'LIKE_NEW',
        categoryId: 'cat-1',
        replacementValue: makeDecimal(1800000),
      });
      const goodUsed = makeRawProduct({
        id: 'prod-gu',
        gradeGroupId: GROUP_ID,
        grade: 'GOOD_USED',
        categoryId: 'cat-1',
        dailyPrice: makeDecimal(100000),
        depositValue: makeDecimal(400000),
        replacementValue: makeDecimal(2000000),
        images: [],
      });
      mockPrisma.rentalProduct.findMany
        .mockResolvedValueOnce([likeNew]) // nhóm sau khi khoá
        .mockResolvedValueOnce([{ ...likeNew, replacementValue: makeDecimal(2000000) }, goodUsed]); // kiểm thứ tự giá
      mockPrisma.rentalProduct.create.mockResolvedValue(goodUsed);
      mockPrisma.rentalProduct.update.mockResolvedValue({ ...likeNew, replacementValue: makeDecimal(2000000) });
      mockPrisma.mediaAsset.findMany.mockResolvedValue([]);

      const result = await adapter.createProduct({
        ...admin,
        categoryId: 'cat-1',
        sku: 'TENT-GU',
        name: 'Lều – Đã sử dụng tốt',
        dailyPrice: 100000,
        currency: 'VND',
        replacementValue: 2000000,
        depositPolicy: { type: 'FIXED', amount: 400000 },
        grade: 'GOOD_USED',
        gradeGroupId: GROUP_ID,
      });

      expect(mockPrisma.rentalProduct.update).toHaveBeenCalledWith({
        where: { id: 'prod-ln' },
        data: { replacementValue: new Prisma.Decimal(2000000), version: { increment: 1 } },
      });
      expect(mockPrisma.rentalProductPriceHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ productId: 'prod-ln', reason: 'GRADE_GROUP_REPLACEMENT_SYNC' }),
      });
      expect(result).toMatchObject({ gradeGroupId: GROUP_ID, grade: 'GOOD_USED' });
    });

    it('rejects a GOOD_USED deposit that is not below LIKE_NEW when both are ACTIVE', async () => {
      const likeNew = makeRawProduct({ id: 'prod-ln', gradeGroupId: GROUP_ID, grade: 'LIKE_NEW', categoryId: 'cat-1' });
      const goodUsed = makeRawProduct({
        id: 'prod-gu',
        gradeGroupId: GROUP_ID,
        grade: 'GOOD_USED',
        categoryId: 'cat-1',
        dailyPrice: makeDecimal(100000),
        depositValue: makeDecimal(500000), // bằng LIKE_NEW
      });
      mockPrisma.rentalProduct.findMany.mockResolvedValueOnce([likeNew]).mockResolvedValueOnce([likeNew, goodUsed]);
      mockPrisma.rentalProduct.create.mockResolvedValue(goodUsed);

      await expect(
        adapter.createProduct({
          ...admin,
          categoryId: 'cat-1',
          sku: 'TENT-GU',
          name: 'Lều – Đã sử dụng tốt',
          dailyPrice: 100000,
          currency: 'VND',
          replacementValue: 2000000,
          depositPolicy: { type: 'FIXED', amount: 500000 },
          grade: 'GOOD_USED',
          gradeGroupId: GROUP_ID,
        }),
      ).rejects.toMatchObject({
        code: RENTAL_ERROR_CODES.RENTAL_GRADE_PRICE_ORDER_INVALID,
        details: { fields: ['deposit'] },
      });
    });

    it('rejects adding a grade that already exists in the group', async () => {
      mockPrisma.rentalProduct.findMany.mockResolvedValueOnce([
        makeRawProduct({ id: 'prod-ln', gradeGroupId: GROUP_ID, grade: 'LIKE_NEW', categoryId: 'cat-1' }),
      ]);

      await expect(
        adapter.createProduct({
          ...admin,
          categoryId: 'cat-1',
          sku: 'TENT-LN-2',
          name: 'Lều – Rất mới (trùng)',
          dailyPrice: 150000,
          currency: 'VND',
          replacementValue: 2000000,
          depositPolicy: { type: 'FIXED', amount: 600000 },
          grade: 'LIKE_NEW',
          gradeGroupId: GROUP_ID,
        }),
      ).rejects.toMatchObject({ code: RENTAL_ERROR_CODES.RENTAL_GRADE_ALREADY_IN_GROUP });
      expect(mockPrisma.rentalProduct.create).not.toHaveBeenCalled();
    });

    it('blocks activation until ADMIN has set the deposit and replacement value', async () => {
      mockPrisma.rentalProduct.findUnique.mockResolvedValue(makeRawProduct({ status: RentalProductStatus.INACTIVE }));
      mockPrisma.rentalProductPriceHistory.count.mockResolvedValue(1);
      mockPrisma.rentalProductPriceHistory.findFirst.mockResolvedValue(null);

      await expect(
        adapter.changeStatus({ id: 'prod-1', status: 'ACTIVE', expectedVersion: 1 }),
      ).rejects.toMatchObject({ code: RENTAL_ERROR_CODES.RENTAL_PRODUCT_PRICING_NOT_APPROVED });
      expect(mockPrisma.rentalProduct.update).not.toHaveBeenCalled();
    });

    it('does not treat a group replacement-value sync row as ADMIN approval of the deposit', async () => {
      // Staff tạo hạng với cọc 0; ADMIN chỉ đổi replacementValue của hạng anh em → có dòng sync do ADMIN,
      // nhưng cọc chưa từng được ADMIN đặt. Dòng sync chỉ được tính cho replacementValue.
      mockPrisma.rentalProduct.findUnique.mockResolvedValue(makeRawProduct({ status: RentalProductStatus.INACTIVE }));
      mockPrisma.rentalProductPriceHistory.count.mockResolvedValue(2);
      mockPrisma.rentalProductPriceHistory.findFirst.mockImplementation(({ where }: any) =>
        Promise.resolve(where.reason ? null : { id: 'sync-row' }),
      );

      await expect(
        adapter.changeStatus({ id: 'prod-1', status: 'ACTIVE', expectedVersion: 1 }),
      ).rejects.toMatchObject({ code: RENTAL_ERROR_CODES.RENTAL_PRODUCT_PRICING_NOT_APPROVED });
      expect(mockPrisma.rentalProductPriceHistory.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ reason: { not: 'GRADE_GROUP_REPLACEMENT_SYNC' } }),
        }),
      );
      expect(mockPrisma.rentalProduct.update).not.toHaveBeenCalled();
    });

    it('activates a legacy product that has no price history, as before', async () => {
      mockPrisma.rentalProduct.findUnique.mockResolvedValue(makeRawProduct({ status: RentalProductStatus.INACTIVE }));
      mockPrisma.rentalProductPriceHistory.count.mockResolvedValue(0);
      mockPrisma.rentalProduct.update.mockResolvedValue(makeRawProduct({ version: 2, images: [] }));
      mockPrisma.mediaAsset.findMany.mockResolvedValue([]);

      const result = await adapter.changeStatus({ id: 'prod-1', status: 'ACTIVE', expectedVersion: 1 });

      expect(result.status).toBe(RentalProductStatus.ACTIVE);
      expect(mockPrisma.rentalProductPriceHistory.findFirst).not.toHaveBeenCalled();
    });
  });
});


describe('Public rental product detail HTTP', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const prisma = {
      rentalProduct: { findUnique: jest.fn().mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111111', sku: 'TENT', name: 'Tent',
        category: { id: 'cat', name: 'Tent', status: 'ACTIVE' }, description: null,
        dailyPrice: new Prisma.Decimal(65000), depositPolicyType: 'FIXED',
        depositValue: new Prisma.Decimal(400000), replacementValue: new Prisma.Decimal(2000000),
        currency: 'VND', status: 'ACTIVE', version: 1, images: [],
      }) },
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [RentalProductController],
      providers: [GetRentalProductUseCase, ListRentalProductsUseCase,
        { provide: RENTAL_PRODUCT_PORT, useValue: new PrismaRentalProductAdapter(prisma as never) }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });
  afterAll(async () => { await app.close(); });
  it('returns deposit explanation from the real catalog mapper', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/rental-products/11111111-1111-4111-8111-111111111111').expect(200);
    expect(response.body).toMatchObject({
      depositPolicy: { amount: 400000 }, depositPerUnit: 400000, replacementValue: 2000000,
      depositExplanation: { percentageOfReplacementValue: 20, formula: 'depositPerUnit / replacementValue * 100' },
    });
  });
});

describe('Rental product VND validation', () => {
  it('rejects fractional VND but allows fractional percentage', () => {
    const input = { categoryId: '11111111-1111-4111-8111-111111111111', sku: 'TENT', name: 'Tent', dailyPrice: 10, replacementValue: 100, depositPolicy: { type: 'PERCENT_REPLACEMENT_VALUE', percentage: 33.33 } }
    expect(CreateRentalProductSchema.safeParse(input).success).toBe(true)
    expect(CreateRentalProductSchema.safeParse({ ...input, dailyPrice: 10.5 }).success).toBe(false)
    expect(UpdateRentalProductSchema.safeParse({ expectedVersion: 1, replacementValue: 1.5 }).success).toBe(false)
    expect(UpdateRentalProductSchema.safeParse({ expectedVersion: 1, depositPolicy: { type: 'FIXED', amount: 1.5 } }).success).toBe(false)
  })
})
