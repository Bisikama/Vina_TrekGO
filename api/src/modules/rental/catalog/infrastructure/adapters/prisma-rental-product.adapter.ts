import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/shared/services/prisma.service';
import {
  RentalProductStatus,
  DepositPolicyType,
  MediaScope,
  MediaResourceType,
  MediaStatus,
} from '@prisma/client';
import type {
  ChangeRentalProductStatusParams,
  ListRentalProductsParams,
  ListStaffRentalProductsParams,
  RentalProductPort,
  RentalProductView,
  RentalProductImageView,
  CreateRentalProductParams,
  UpdateRentalProductParams,
} from '../../application/ports/rental-product.port';
import {
  AppError,
  RENTAL_ERROR_CODES,
  MEDIA_ERROR_CODES,
} from '../../../../../shared/errors';
import envConfig from '../../../../../shared/config';

type RawCatalogMediaAsset = {
  id: string;
  providerPublicId: string | null;
  secureUrl: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
};

@Injectable()
export class PrismaRentalProductAdapter implements RentalProductPort {
  constructor(private readonly prisma: PrismaService) {}

  private extractMediaIds(rawImages: unknown): string[] {
    if (!Array.isArray(rawImages)) {
      return [];
    }
    return rawImages.filter((item): item is string => typeof item === 'string');
  }

  private buildCatalogImageView(asset: RawCatalogMediaAsset): RentalProductImageView {
    const secureUrl = asset.secureUrl ?? '';
    let url = secureUrl;
    let thumbnailUrl = secureUrl;
    let cardUrl = secureUrl;
    let detailUrl = secureUrl;

    if (secureUrl.includes('/image/upload/')) {
      thumbnailUrl = secureUrl.replace('/image/upload/', '/image/upload/c_limit,f_auto,q_auto,w_320/');
      cardUrl = secureUrl.replace('/image/upload/', '/image/upload/c_limit,f_auto,q_auto,w_720/');
      detailUrl = secureUrl.replace('/image/upload/', '/image/upload/c_limit,f_auto,q_auto,w_1600/');
    } else if (asset.providerPublicId && envConfig.CLOUDINARY_CLOUD_NAME) {
      const base = `https://res.cloudinary.com/${envConfig.CLOUDINARY_CLOUD_NAME}/image/upload`;
      thumbnailUrl = `${base}/c_limit,f_auto,q_auto,w_320/${asset.providerPublicId}`;
      cardUrl = `${base}/c_limit,f_auto,q_auto,w_720/${asset.providerPublicId}`;
      detailUrl = `${base}/c_limit,f_auto,q_auto,w_1600/${asset.providerPublicId}`;
      if (!url) {
        url = detailUrl;
      }
    }

    return {
      mediaId: asset.id,
      url,
      thumbnailUrl,
      cardUrl,
      detailUrl,
      mimeType: asset.mimeType ?? null,
      width: asset.width ?? null,
      height: asset.height ?? null,
    };
  }

  private async resolveMediaMap(mediaIds: string[]): Promise<Map<string, RentalProductImageView>> {
    const uniqueIds = [...new Set(mediaIds)];
    if (uniqueIds.length === 0 || typeof this.prisma.mediaAsset?.findMany !== 'function') {
      return new Map();
    }

    const assets = await this.prisma.mediaAsset.findMany({
      where: {
        id: { in: uniqueIds },
        scope: MediaScope.RENTAL_PRODUCT,
        resourceType: MediaResourceType.IMAGE,
        status: MediaStatus.READY,
        deletedAt: null,
      },
      select: {
        id: true,
        providerPublicId: true,
        secureUrl: true,
        mimeType: true,
        width: true,
        height: true,
      },
    });

    return new Map(
      assets.map((asset: RawCatalogMediaAsset) => [
        asset.id,
        this.buildCatalogImageView(asset),
      ]),
    );
  }

  private async validateProductMediaIds(mediaIds: string[] | undefined): Promise<string[] | undefined> {
    if (mediaIds === undefined) {
      return undefined;
    }

    const uniqueIds = [...new Set(mediaIds)];
    if (uniqueIds.length === 0) {
      return [];
    }

    if (typeof this.prisma.mediaAsset?.findMany !== 'function') {
      return uniqueIds;
    }

    const assets = await this.prisma.mediaAsset.findMany({
      where: {
        id: { in: uniqueIds },
        deletedAt: null,
      },
      select: {
        id: true,
        scope: true,
        resourceType: true,
        status: true,
      },
    });

    const foundById = new Map(assets.map((asset: any) => [asset.id, asset]));
    const missingIds = uniqueIds.filter((id) => !foundById.has(id));
    if (missingIds.length > 0) {
      throw AppError.fromCode(MEDIA_ERROR_CODES.MEDIA_NOT_FOUND, {
        details: { mediaIds: missingIds },
      });
    }

    const invalidScopeIds = assets
      .filter((asset: any) => asset.scope !== MediaScope.RENTAL_PRODUCT)
      .map((asset: any) => asset.id);
    if (invalidScopeIds.length > 0) {
      throw AppError.fromCode(MEDIA_ERROR_CODES.MEDIA_INVALID_SCOPE, {
        details: {
          mediaIds: invalidScopeIds,
          expectedScope: MediaScope.RENTAL_PRODUCT,
        },
      });
    }

    const invalidResourceTypeIds = assets
      .filter((asset: any) => asset.resourceType !== MediaResourceType.IMAGE)
      .map((asset: any) => asset.id);
    if (invalidResourceTypeIds.length > 0) {
      throw AppError.fromCode(MEDIA_ERROR_CODES.MEDIA_INVALID_RESOURCE_TYPE, {
        details: {
          mediaIds: invalidResourceTypeIds,
          expectedResourceType: MediaResourceType.IMAGE,
        },
      });
    }

    const notReadyIds = assets
      .filter((asset: any) => asset.status !== MediaStatus.READY)
      .map((asset: any) => asset.id);
    if (notReadyIds.length > 0) {
      throw AppError.fromCode(MEDIA_ERROR_CODES.MEDIA_INVALID_STATE, {
        details: {
          mediaIds: notReadyIds,
          expectedStatus: MediaStatus.READY,
        },
      });
    }

    return uniqueIds;
  }

  private async syncProductMediaRetention(
    attachedIds: string[],
    removedCandidateIds: string[] = [],
  ): Promise<void> {
    if (typeof this.prisma.mediaAsset?.updateMany !== 'function') {
      return;
    }

    if (attachedIds.length > 0) {
      await this.prisma.mediaAsset.updateMany({
        where: { id: { in: attachedIds } },
        data: { retentionUntil: null },
      });
    }

    const detachedIds = [...new Set(removedCandidateIds)].filter(
      (id) => !attachedIds.includes(id),
    );
    if (detachedIds.length === 0) {
      return;
    }

    const orphanIds: string[] = [];
    for (const mediaId of detachedIds) {
      if (typeof this.prisma.rentalProduct?.count === 'function') {
        const refCount = await this.prisma.rentalProduct.count({
          where: {
            images: {
              array_contains: [mediaId],
            },
          },
        });
        if (refCount === 0) {
          orphanIds.push(mediaId);
        }
      } else {
        orphanIds.push(mediaId);
      }
    }

    if (orphanIds.length > 0) {
      const orphanRetentionUntil = new Date(
        Date.now() + envConfig.MEDIA_CATALOG_ORPHAN_RETENTION_DAYS * 86400 * 1000,
      );
      await this.prisma.mediaAsset.updateMany({
        where: {
          id: { in: orphanIds },
          status: MediaStatus.READY,
        },
        data: { retentionUntil: orphanRetentionUntil },
      });
    }
  }

  private mapToView(
    product: any,
    mediaById: Map<string, RentalProductImageView>,
  ): RentalProductView {
    const imageMediaIds = this.extractMediaIds(product.images);
    const images = imageMediaIds
      .map((id) => mediaById.get(id))
      .filter((item): item is RentalProductImageView => Boolean(item));

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: {
        id: product.category.id,
        name: product.category.name,
        status: product.category.status,
      },
      description: product.description,
      dailyPrice: product.dailyPrice.toNumber(),
      depositPolicy: {
        type: product.depositPolicyType,
        amount:
          product.depositPolicyType === 'FIXED'
            ? product.depositValue.toNumber()
            : (product.replacementValue.toNumber() * product.depositValue.toNumber()) / 100,
        referenceValue:
          product.depositPolicyType === 'PERCENT_REPLACEMENT_VALUE'
            ? product.replacementValue.toNumber()
            : undefined,
        percentage:
          product.depositPolicyType === 'PERCENT_REPLACEMENT_VALUE'
            ? product.depositValue.toNumber()
            : undefined,
      },
      currency: product.currency,
      replacementValue: product.replacementValue.toNumber(),
      status: product.status,
      version: product.version,
      imageMediaIds,
      images,
      spec: product.specifications || {},
      recommendationTags: Array.isArray(product.recommendationTags)
        ? product.recommendationTags
        : [],
      requiresDeepInspectionAfterReturn: Boolean(product.requiresDeepReturnInspection),
    };
  }

  private async mapManyToView(products: any[]): Promise<RentalProductView[]> {
    const allMediaIds = products.flatMap((product) =>
      this.extractMediaIds(product.images),
    );
    const mediaById = await this.resolveMediaMap(allMediaIds);
    return products.map((product) => this.mapToView(product, mediaById));
  }

  private async mapOneToView(product: any): Promise<RentalProductView> {
    const mediaIds = this.extractMediaIds(product.images);
    const mediaById = await this.resolveMediaMap(mediaIds);
    return this.mapToView(product, mediaById);
  }

  async listActiveProducts(
    params: ListRentalProductsParams,
  ): Promise<{ items: RentalProductView[]; total: number }> {
    const { page, pageSize, search, categoryId } = params;
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const where: any = { status: RentalProductStatus.ACTIVE };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.rentalProduct.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { category: true },
      }),
      this.prisma.rentalProduct.count({ where }),
    ]);

    return {
      items: await this.mapManyToView(items),
      total,
    };
  }

  async getProductById(id: string): Promise<RentalProductView | null> {
    const product = await this.prisma.rentalProduct.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!product) return null;
    return this.mapOneToView(product);
  }

  async listStaffProducts(
    params: ListStaffRentalProductsParams,
  ): Promise<{ items: RentalProductView[]; total: number }> {
    const { page, pageSize, status } = params;
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const where: any = {};
    if (status) {
      where.status = status as RentalProductStatus;
    }

    const [items, total] = await Promise.all([
      this.prisma.rentalProduct.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { category: true },
      }),
      this.prisma.rentalProduct.count({ where }),
    ]);

    return {
      items: await this.mapManyToView(items),
      total,
    };
  }

  async changeStatus(
    params: ChangeRentalProductStatusParams,
  ): Promise<RentalProductView> {
    const { id, status, expectedVersion } = params;

    const updated = await this.prisma.rentalProduct.updateMany({
      where: {
        id,
        version: expectedVersion,
      },
      data: {
        status: status as RentalProductStatus,
        version: { increment: 1 },
      },
    });

    if (updated.count === 0) {
      const exists = await this.prisma.rentalProduct.findUnique({ where: { id } });
      if (!exists) {
        throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_PRODUCT_NOT_FOUND, {
          details: { id },
        });
      }
      throw AppError.fromCode(RENTAL_ERROR_CODES.VERSION_CONFLICT, {
        details: { id, expectedVersion },
      });
    }

    const product = await this.prisma.rentalProduct.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!product) {
      throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_PRODUCT_NOT_FOUND, {
        details: { id },
      });
    }

    return this.mapOneToView(product);
  }

  async createProduct(
    params: CreateRentalProductParams,
  ): Promise<RentalProductView> {
    const normalizedMediaIds = await this.validateProductMediaIds(
      params.imageMediaIds,
    );

    try {
      const product = await this.prisma.rentalProduct.create({
        data: {
          categoryId: params.categoryId,
          sku: params.sku,
          name: params.name,
          description: params.description,
          dailyPrice: params.dailyPrice,
          currency: params.currency,
          replacementValue: params.replacementValue,
          depositPolicyType: params.depositPolicy.type as DepositPolicyType,
          depositValue:
            params.depositPolicy.type === 'FIXED'
              ? (params.depositPolicy.amount ?? 0)
              : (params.depositPolicy.percentage ?? 0),
          images: normalizedMediaIds !== undefined ? normalizedMediaIds : undefined,
          specifications: params.spec ? params.spec : undefined,
          recommendationTags: params.recommendationTags
            ? params.recommendationTags
            : undefined,
          requiresDeepReturnInspection: params.requiresDeepInspectionAfterReturn ?? false,
          status: RentalProductStatus.ACTIVE,
          version: 1,
        },
        include: { category: true },
      });

      if (normalizedMediaIds && normalizedMediaIds.length > 0) {
        await this.syncProductMediaRetention(normalizedMediaIds);
      }

      return this.mapOneToView(product);
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_PRODUCT_SKU_EXISTS, {
          details: { sku: params.sku },
        });
      }
      throw e;
    }
  }

  async updateProduct(
    params: UpdateRentalProductParams,
  ): Promise<RentalProductView> {
    const normalizedMediaIds = await this.validateProductMediaIds(
      params.imageMediaIds,
    );

    let previousMediaIds: string[] = [];
    if (normalizedMediaIds !== undefined) {
      const existingProduct = await this.prisma.rentalProduct.findUnique({
        where: { id: params.id },
        select: { images: true },
      });
      previousMediaIds = this.extractMediaIds(existingProduct?.images);
    }

    const dataToUpdate: any = {
      version: { increment: 1 },
    };

    if (params.name !== undefined) dataToUpdate.name = params.name;
    if (params.description !== undefined) dataToUpdate.description = params.description;
    if (params.dailyPrice !== undefined) dataToUpdate.dailyPrice = params.dailyPrice;
    if (params.replacementValue !== undefined) dataToUpdate.replacementValue = params.replacementValue;
    if (params.depositPolicy) {
      dataToUpdate.depositPolicyType = params.depositPolicy.type as DepositPolicyType;
      dataToUpdate.depositValue =
        params.depositPolicy.type === 'FIXED'
          ? (params.depositPolicy.amount ?? 0)
          : (params.depositPolicy.percentage ?? 0);
    }
    if (normalizedMediaIds !== undefined) dataToUpdate.images = normalizedMediaIds;
    if (params.spec !== undefined) dataToUpdate.specifications = params.spec;
    if (params.recommendationTags !== undefined) dataToUpdate.recommendationTags = params.recommendationTags;
    if (params.requiresDeepInspectionAfterReturn !== undefined) {
      dataToUpdate.requiresDeepReturnInspection = params.requiresDeepInspectionAfterReturn;
    }

    const updated = await this.prisma.rentalProduct.updateMany({
      where: {
        id: params.id,
        version: params.expectedVersion,
      },
      data: dataToUpdate,
    });

    if (updated.count === 0) {
      const exists = await this.prisma.rentalProduct.findUnique({
        where: { id: params.id },
      });
      if (!exists) {
        throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_PRODUCT_NOT_FOUND, {
          details: { id: params.id },
        });
      }
      throw AppError.fromCode(RENTAL_ERROR_CODES.VERSION_CONFLICT, {
        details: { id: params.id, expectedVersion: params.expectedVersion },
      });
    }

    if (normalizedMediaIds !== undefined) {
      await this.syncProductMediaRetention(normalizedMediaIds, previousMediaIds);
    }

    const product = await this.prisma.rentalProduct.findUnique({
      where: { id: params.id },
      include: { category: true },
    });

    if (!product) {
      throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_PRODUCT_NOT_FOUND, {
        details: { id: params.id },
      });
    }

    return this.mapOneToView(product);
  }
}
