import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/shared/services/prisma.service';
import { RecordStatus, RentalProductStatus, DepositPolicyType } from '@prisma/client';
import type {
  ChangeRentalProductStatusParams,
  ListRentalProductsParams,
  ListStaffRentalProductsParams,
  RentalProductPort,
  RentalProductView,
  CreateRentalProductParams,
  UpdateRentalProductParams,
} from '../../application/ports/rental-product.port';
import { AppError, RENTAL_ERROR_CODES } from '../../../../../shared/errors';

@Injectable()
export class PrismaRentalProductAdapter implements RentalProductPort {
  constructor(private readonly prisma: PrismaService) {}

  private mapToView(product: any): RentalProductView {
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
        amount: product.depositPolicyType === 'FIXED' ? product.depositValue.toNumber() : (product.replacementValue.toNumber() * product.depositValue.toNumber()) / 100,
        referenceValue: product.depositPolicyType === 'PERCENT_REPLACEMENT_VALUE' ? product.replacementValue.toNumber() : undefined,
        percentage: product.depositPolicyType === 'PERCENT_REPLACEMENT_VALUE' ? product.depositValue.toNumber() : undefined,
      },
      currency: product.currency,
      replacementValue: product.replacementValue.toNumber(),
      status: product.status,
      version: product.version,
      // Media integration not yet available. Expose stored IDs.
      imageMediaIds: Array.isArray(product.images) ? product.images : [],
      spec: product.specifications || {},
      recommendationTags: Array.isArray(product.recommendationTags) ? product.recommendationTags : [],
    };
  }

  async listActiveProducts(params: ListRentalProductsParams): Promise<{ items: RentalProductView[]; total: number }> {
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
      items: items.map(this.mapToView),
      total,
    };
  }

  async getProductById(id: string): Promise<RentalProductView | null> {
    const product = await this.prisma.rentalProduct.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!product) return null;
    return this.mapToView(product);
  }

  async listStaffProducts(params: ListStaffRentalProductsParams): Promise<{ items: RentalProductView[]; total: number }> {
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
      items: items.map(this.mapToView),
      total,
    };
  }

  async changeStatus(params: ChangeRentalProductStatusParams): Promise<RentalProductView> {
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
        throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_PRODUCT_NOT_FOUND, { details: { id } });
      }
      throw AppError.fromCode(RENTAL_ERROR_CODES.VERSION_CONFLICT, { details: { id, expectedVersion } });
    }

    const product = await this.prisma.rentalProduct.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!product) {
      throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_PRODUCT_NOT_FOUND, { details: { id } });
    }

    return this.mapToView(product);
  }

  async createProduct(params: CreateRentalProductParams): Promise<RentalProductView> {
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
          depositValue: params.depositPolicy.type === 'FIXED' ? (params.depositPolicy.amount ?? 0) : (params.depositPolicy.percentage ?? 0),
          images: params.imageMediaIds ? params.imageMediaIds : undefined,
          specifications: params.spec ? params.spec : undefined,
          recommendationTags: params.recommendationTags ? params.recommendationTags : undefined,
          status: RentalProductStatus.ACTIVE,
          version: 1,
        },
        include: { category: true },
      });
      return this.mapToView(product);
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_PRODUCT_SKU_EXISTS, { details: { sku: params.sku } });
      }
      throw e;
    }
  }

  async updateProduct(params: UpdateRentalProductParams): Promise<RentalProductView> {
    const dataToUpdate: any = {
      version: { increment: 1 },
    };

    if (params.name !== undefined) dataToUpdate.name = params.name;
    if (params.description !== undefined) dataToUpdate.description = params.description;
    if (params.dailyPrice !== undefined) dataToUpdate.dailyPrice = params.dailyPrice;
    if (params.replacementValue !== undefined) dataToUpdate.replacementValue = params.replacementValue;
    if (params.depositPolicy) {
      dataToUpdate.depositPolicyType = params.depositPolicy.type as DepositPolicyType;
      dataToUpdate.depositValue = params.depositPolicy.type === 'FIXED' ? (params.depositPolicy.amount ?? 0) : (params.depositPolicy.percentage ?? 0);
    }
    if (params.imageMediaIds !== undefined) dataToUpdate.images = params.imageMediaIds;
    if (params.spec !== undefined) dataToUpdate.specifications = params.spec;
    if (params.recommendationTags !== undefined) dataToUpdate.recommendationTags = params.recommendationTags;

    const updated = await this.prisma.rentalProduct.updateMany({
      where: {
        id: params.id,
        version: params.expectedVersion,
      },
      data: dataToUpdate,
    });

    if (updated.count === 0) {
      const exists = await this.prisma.rentalProduct.findUnique({ where: { id: params.id } });
      if (!exists) {
        throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_PRODUCT_NOT_FOUND, { details: { id: params.id } });
      }
      throw AppError.fromCode(RENTAL_ERROR_CODES.VERSION_CONFLICT, { details: { id: params.id, expectedVersion: params.expectedVersion } });
    }

    const product = await this.prisma.rentalProduct.findUnique({
      where: { id: params.id },
      include: { category: true },
    });

    if (!product) {
      throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_PRODUCT_NOT_FOUND, { details: { id: params.id } });
    }

    return this.mapToView(product);
  }
}
