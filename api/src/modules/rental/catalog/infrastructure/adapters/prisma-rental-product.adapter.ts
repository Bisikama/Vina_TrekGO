import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from 'src/shared/services/prisma.service';
import {
  Prisma,
  RentalProductStatus,
  DepositPolicyType,
  MediaScope,
  MediaResourceType,
  MediaStatus,
  UserRole as PrismaUserRole,
} from '@prisma/client';
import {
  assertFinancialFieldsAllowed,
  assertGradedDepositIsFixed,
  assertGradePriceOrder,
  depositValueOf,
  isAdminRole,
  type GradePricingSnapshot,
} from '../../application/services/rental-grade-pricing.rules';
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
import { calculateDepositPerUnit, describeDeposit, parseWholeVnd, toSafeNumber } from '../../../ordering/application/services/rental-ordering.rules';

type RawCatalogMediaAsset = {
  id: string;
  providerPublicId: string | null;
  secureUrl: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
};

/** Lý do của bản ghi lịch sử giá sinh ra khi đồng bộ replacementValue trong nhóm hạng. */
const GROUP_REPLACEMENT_SYNC_REASON = 'GRADE_GROUP_REPLACEMENT_SYNC';

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
    // Older catalog data and local demo seeds can contain direct HTTPS image URLs.
    // PostgreSQL media IDs are UUIDs, so URLs must not be passed to that query.
    const uniqueIds = [...new Set(mediaIds.filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))];
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
      .map((id) => /^https:\/\//i.test(id)
        ? { mediaId: id, url: id, thumbnailUrl: id, cardUrl: id, detailUrl: id, mimeType: null, width: null, height: null }
        : mediaById.get(id))
      .filter((item): item is RentalProductImageView => Boolean(item));

    // Dữ liệu cũ có thể không phải VND nguyên; không để một dòng lỗi làm hỏng API catalog.
    let depositPerUnit: number | null = null;
    let depositExplanation = { percentageOfReplacementValue: null as number | null, formula: 'depositPerUnit / replacementValue * 100' };
    try {
      const replacementValue = parseWholeVnd(product.replacementValue.toString());
      const deposit = calculateDepositPerUnit({
        depositPolicyType: product.depositPolicyType,
        depositValue: product.depositValue.toString(),
        replacementValue: product.replacementValue.toString(),
      });
      if (replacementValue >= 0n) {
        depositPerUnit = toSafeNumber(deposit);
        depositExplanation = describeDeposit(deposit, replacementValue);
      }
    } catch {
      // Quote cũng không thể tính từ dữ liệu này; client ẩn phần giải thích.
    }

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
          depositPerUnit ?? (product.depositPolicyType === 'FIXED'
            ? product.depositValue.toNumber()
            : (product.replacementValue.toNumber() * product.depositValue.toNumber()) / 100),
        referenceValue:
          product.depositPolicyType === 'PERCENT_REPLACEMENT_VALUE'
            ? product.replacementValue.toNumber()
            : undefined,
        percentage:
          product.depositPolicyType === 'PERCENT_REPLACEMENT_VALUE'
            ? product.depositValue.toNumber()
            : undefined,
      },
      depositPerUnit,
      depositExplanation,
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
      gradeGroupId: product.gradeGroupId ?? null,
      grade: product.grade ?? null,
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

  private toNumber(value: { toString(): string }): number {
    return Number(value.toString());
  }

  /** Thời gian lấy từ DB trong transaction tài chính (quy ước của repo), không dùng new Date(). */
  private async dbNow(tx: Prisma.TransactionClient): Promise<Date> {
    const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
    return now;
  }

  /**
   * Khoá sản phẩm; nếu sản phẩm có nhóm hạng thì khoá cả nhóm, theo thứ tự id để tránh deadlock.
   * Nhóm hạng không đổi sau khi tạo, nên đọc grade_group_id trước khi khoá là an toàn.
   */
  private async lockProductAndGroup(tx: Prisma.TransactionClient, productId: string): Promise<void> {
    const rows = await tx.$queryRaw<{ grade_group_id: string | null }[]>`
      SELECT grade_group_id FROM rental_products WHERE id = ${productId}::uuid`;
    if (rows.length === 0) {
      throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_PRODUCT_NOT_FOUND, { details: { id: productId } });
    }
    const groupId = rows[0].grade_group_id;
    if (groupId) {
      await tx.$queryRaw`SELECT id FROM rental_products WHERE grade_group_id = ${groupId}::uuid ORDER BY id FOR UPDATE`;
    } else {
      await tx.$queryRaw`SELECT id FROM rental_products WHERE id = ${productId}::uuid FOR UPDATE`;
    }
  }

  private async lockGroup(tx: Prisma.TransactionClient, gradeGroupId: string): Promise<any[]> {
    await tx.$queryRaw`SELECT id FROM rental_products WHERE grade_group_id = ${gradeGroupId}::uuid ORDER BY id FOR UPDATE`;
    return tx.rentalProduct.findMany({ where: { gradeGroupId }, orderBy: { id: 'asc' } });
  }

  private toGradeSnapshot(product: any): GradePricingSnapshot {
    return {
      id: product.id,
      grade: product.grade,
      status: product.status,
      dailyPrice: this.toNumber(product.dailyPrice),
      depositPolicyType: product.depositPolicyType,
      depositValue: this.toNumber(product.depositValue),
    };
  }

  private async assertGroupPriceOrder(tx: Prisma.TransactionClient, gradeGroupId: string): Promise<void> {
    const group = await tx.rentalProduct.findMany({ where: { gradeGroupId } });
    assertGradePriceOrder(group.map((p: any) => this.toGradeSnapshot(p)));
  }

  /** Đóng bản ghi giá đang hiệu lực và mở bản ghi mới (Policy: cọc có phiên bản). */
  private async recordPriceHistory(
    tx: Prisma.TransactionClient,
    product: any,
    actorUserId: string,
    now: Date,
    reason: string,
  ): Promise<void> {
    await tx.rentalProductPriceHistory.updateMany({
      where: { productId: product.id, effectiveTo: null },
      data: { effectiveTo: now },
    });
    await tx.rentalProductPriceHistory.create({
      data: {
        productId: product.id,
        dailyPrice: product.dailyPrice,
        replacementValue: product.replacementValue,
        depositPolicyType: product.depositPolicyType,
        depositValue: product.depositValue,
        currency: product.currency,
        effectiveFrom: now,
        changedBy: actorUserId,
        reason,
      },
    });
  }

  /** replacementValue bằng nhau trong cả nhóm hạng: đổi một bên thì các bên còn lại đổi theo. */
  private async syncGroupReplacementValue(
    tx: Prisma.TransactionClient,
    siblings: any[],
    replacementValue: Prisma.Decimal | number,
    actorUserId: string,
    now: Date,
  ): Promise<void> {
    const target = new Prisma.Decimal(replacementValue);
    for (const sibling of siblings) {
      if (new Prisma.Decimal(sibling.replacementValue).equals(target)) continue;
      const updated = await tx.rentalProduct.update({
        where: { id: sibling.id },
        data: { replacementValue: target, version: { increment: 1 } },
      });
      await this.recordPriceHistory(tx, updated, actorUserId, now, GROUP_REPLACEMENT_SYNC_REASON);
    }
  }

  /**
   * Sản phẩm có lịch sử giá chỉ được kích hoạt khi ADMIN đã duyệt cả cọc lẫn replacementValue hiện tại.
   * - Cọc: phải có bản ghi ADMIN tự đặt (CREATE/UPDATE). Bản ghi đồng bộ nhóm do ADMIN đổi replacementValue
   *   của hạng khác không tính là duyệt cọc, vì nó chỉ chép lại cọc đang có (có thể là cọc 0 do staff tạo).
   * - replacementValue: bản ghi ADMIN bất kỳ, kể cả đồng bộ nhóm (đó chính là quyết định của ADMIN).
   * Sản phẩm cũ (tạo trước khi có lịch sử giá) chưa có bản ghi nào: giữ hành vi cũ.
   */
  private async assertPricingApproved(tx: Prisma.TransactionClient, product: any): Promise<void> {
    const historyCount = await tx.rentalProductPriceHistory.count({ where: { productId: product.id } });
    if (historyCount === 0) return;
    const byAdmin = { productId: product.id, changedByUser: { role: PrismaUserRole.ADMIN } };
    const [depositApproved, replacementApproved] = await Promise.all([
      tx.rentalProductPriceHistory.findFirst({
        where: {
          ...byAdmin,
          depositPolicyType: product.depositPolicyType,
          depositValue: product.depositValue,
          reason: { not: GROUP_REPLACEMENT_SYNC_REASON },
        },
        select: { id: true },
      }),
      tx.rentalProductPriceHistory.findFirst({
        where: { ...byAdmin, replacementValue: product.replacementValue },
        select: { id: true },
      }),
    ]);
    if (!depositApproved || !replacementApproved) {
      throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_PRODUCT_PRICING_NOT_APPROVED, {
        details: { id: product.id },
      });
    }
  }

  async changeStatus(
    params: ChangeRentalProductStatusParams,
  ): Promise<RentalProductView> {
    const { id, status, expectedVersion } = params;

    const product = await this.prisma.$transaction(async (tx) => {
      await this.lockProductAndGroup(tx, id);
      const current = await tx.rentalProduct.findUnique({ where: { id } });
      if (!current) {
        throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_PRODUCT_NOT_FOUND, { details: { id } });
      }
      if (current.version !== expectedVersion) {
        throw AppError.fromCode(RENTAL_ERROR_CODES.VERSION_CONFLICT, {
          details: { id, expectedVersion },
        });
      }

      if (status === RentalProductStatus.ACTIVE && current.status !== RentalProductStatus.ACTIVE) {
        await this.assertPricingApproved(tx, current);
        if (current.gradeGroupId) {
          const group = await tx.rentalProduct.findMany({ where: { gradeGroupId: current.gradeGroupId } });
          assertGradePriceOrder(
            group.map((p: any) => this.toGradeSnapshot(p.id === id ? { ...p, status: RentalProductStatus.ACTIVE } : p)),
          );
        }
      }

      return tx.rentalProduct.update({
        where: { id },
        data: { status: status as RentalProductStatus, version: { increment: 1 } },
        include: { category: true },
      });
    });

    return this.mapOneToView(product);
  }

  async createProduct(
    params: CreateRentalProductParams,
  ): Promise<RentalProductView> {
    const normalizedMediaIds = await this.validateProductMediaIds(
      params.imageMediaIds,
    );
    const isAdmin = isAdminRole(params.actorRole);

    try {
      const product = await this.prisma.$transaction(async (tx) => {
        const now = await this.dbNow(tx);

        let gradeGroupId: string | null = null;
        let siblings: any[] = [];
        if (params.grade) {
          if (params.gradeGroupId) {
            siblings = await this.lockGroup(tx, params.gradeGroupId);
            if (siblings.length === 0) {
              throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_GRADE_GROUP_NOT_FOUND, {
                details: { gradeGroupId: params.gradeGroupId },
              });
            }
            if (siblings.some((s) => s.categoryId !== params.categoryId || s.currency !== params.currency)) {
              throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_GRADE_GROUP_CATEGORY_MISMATCH, {
                details: { gradeGroupId: params.gradeGroupId },
              });
            }
            if (siblings.some((s) => s.grade === params.grade)) {
              throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_GRADE_ALREADY_IN_GROUP, {
                details: { gradeGroupId: params.gradeGroupId, grade: params.grade },
              });
            }
            gradeGroupId = params.gradeGroupId;
          } else {
            gradeGroupId = randomUUID();
          }
        }

        // STAFF_INVENTORY: chưa có cọc (FIXED 0), replacementValue lấy theo nhóm nếu có; sản phẩm ở INACTIVE chờ ADMIN.
        const groupReplacementValue = siblings.length > 0 ? siblings[0].replacementValue : undefined;
        const replacementValue = isAdmin ? params.replacementValue! : (groupReplacementValue ?? 0);
        const depositPolicyType = isAdmin ? params.depositPolicy!.type : 'FIXED';
        const depositValue = isAdmin ? depositValueOf(params.depositPolicy!) : 0;

        const created = await tx.rentalProduct.create({
          data: {
            categoryId: params.categoryId,
            sku: params.sku,
            name: params.name,
            description: params.description,
            dailyPrice: params.dailyPrice,
            currency: params.currency,
            replacementValue,
            depositPolicyType: depositPolicyType as DepositPolicyType,
            depositValue,
            images: normalizedMediaIds !== undefined ? normalizedMediaIds : undefined,
            specifications: params.spec ? params.spec : undefined,
            recommendationTags: params.recommendationTags
              ? params.recommendationTags
              : undefined,
            requiresDeepReturnInspection: params.requiresDeepInspectionAfterReturn ?? false,
            gradeGroupId,
            grade: params.grade ?? null,
            status: isAdmin ? RentalProductStatus.ACTIVE : RentalProductStatus.INACTIVE,
            version: 1,
          },
          include: { category: true },
        });

        await this.recordPriceHistory(tx, created, params.actorUserId, now, 'CREATE');
        if (isAdmin && siblings.length > 0) {
          await this.syncGroupReplacementValue(tx, siblings, created.replacementValue, params.actorUserId, now);
        }
        if (gradeGroupId) {
          await this.assertGroupPriceOrder(tx, gradeGroupId);
        }
        return created;
      });

      if (normalizedMediaIds && normalizedMediaIds.length > 0) {
        await this.syncProductMediaRetention(normalizedMediaIds);
      }

      return this.mapOneToView(product);
    } catch (e: any) {
      if (e.code === 'P2002') {
        if (JSON.stringify(e.meta?.target ?? '').includes('grade')) {
          throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_GRADE_ALREADY_IN_GROUP, {
            details: { gradeGroupId: params.gradeGroupId, grade: params.grade },
          });
        }
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
      dataToUpdate.depositValue = depositValueOf(params.depositPolicy);
    }
    if (normalizedMediaIds !== undefined) dataToUpdate.images = normalizedMediaIds;
    if (params.spec !== undefined) dataToUpdate.specifications = params.spec;
    if (params.recommendationTags !== undefined) dataToUpdate.recommendationTags = params.recommendationTags;
    if (params.requiresDeepInspectionAfterReturn !== undefined) {
      dataToUpdate.requiresDeepReturnInspection = params.requiresDeepInspectionAfterReturn;
    }

    await this.prisma.$transaction(async (tx) => {
      await this.lockProductAndGroup(tx, params.id);
      const current = await tx.rentalProduct.findUnique({ where: { id: params.id } });
      if (!current) {
        throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_PRODUCT_NOT_FOUND, {
          details: { id: params.id },
        });
      }
      if (current.version !== params.expectedVersion) {
        throw AppError.fromCode(RENTAL_ERROR_CODES.VERSION_CONFLICT, {
          details: { id: params.id, expectedVersion: params.expectedVersion },
        });
      }

      assertFinancialFieldsAllowed(
        params.actorRole,
        { replacementValue: params.replacementValue, depositPolicy: params.depositPolicy },
        {
          replacementValue: this.toNumber(current.replacementValue),
          depositPolicyType: current.depositPolicyType,
          depositValue: this.toNumber(current.depositValue),
        },
      );
      assertGradedDepositIsFixed(current.grade, params.depositPolicy?.type);

      const updated = await tx.rentalProduct.updateMany({
        where: { id: params.id, version: params.expectedVersion },
        data: dataToUpdate,
      });
      if (updated.count === 0) {
        throw AppError.fromCode(RENTAL_ERROR_CODES.VERSION_CONFLICT, {
          details: { id: params.id, expectedVersion: params.expectedVersion },
        });
      }

      const after = await tx.rentalProduct.findUnique({ where: { id: params.id } });
      if (!after) {
        throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_PRODUCT_NOT_FOUND, {
          details: { id: params.id },
        });
      }

      const replacementChanged = !new Prisma.Decimal(after.replacementValue).equals(current.replacementValue);
      const financialChanged =
        replacementChanged ||
        !new Prisma.Decimal(after.dailyPrice).equals(current.dailyPrice) ||
        after.depositPolicyType !== current.depositPolicyType ||
        !new Prisma.Decimal(after.depositValue).equals(current.depositValue);

      if (financialChanged) {
        const now = await this.dbNow(tx);
        await this.recordPriceHistory(tx, after, params.actorUserId, now, 'UPDATE');
        if (after.gradeGroupId && replacementChanged) {
          const siblings = await tx.rentalProduct.findMany({
            where: { gradeGroupId: after.gradeGroupId, id: { not: after.id } },
          });
          await this.syncGroupReplacementValue(tx, siblings, after.replacementValue, params.actorUserId, now);
        }
      }
      // Chỉ kiểm thứ tự giá khi giá/cọc đổi: sửa tên/mô tả không thể làm sai thứ tự giữa hai hạng.
      if (after.gradeGroupId && financialChanged) {
        await this.assertGroupPriceOrder(tx, after.gradeGroupId);
      }
    });

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
