import { Injectable } from '@nestjs/common';
import { RentalProductStatus } from '@prisma/client';
import { PrismaService } from 'src/shared/services/prisma.service';
import type {
  RentalCatalogPort,
  RentalProductTransactionData,
} from '../../application/ports/rental-catalog.port';

@Injectable()
export class PrismaRentalCatalogAdapter implements RentalCatalogPort {
  constructor(private readonly prisma: PrismaService) {}

  async getProductsByIds(
    productIds: string[],
  ): Promise<RentalProductTransactionData[]> {
    const products = await this.prisma.rentalProduct.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        status: true,
        dailyPrice: true,
        currency: true,
        depositPolicyType: true,
        depositValue: true,
        replacementValue: true,
        categoryId: true,
        recommendationTags: true,
        requiresDeepReturnInspection: true,
      },
    });

    // Bước hạ tầng: Decimal chỉ được chuyển sang string.
    // Application layer sẽ tính tiền bằng BigInt, không dùng Number(p.dailyPrice).
    return products.map(mapProduct);
  }

  async listActiveProducts(
    categoryId?: string,
  ): Promise<RentalProductTransactionData[]> {
    const products = await this.prisma.rentalProduct.findMany({
      where: {
        status: RentalProductStatus.ACTIVE,
        ...(categoryId ? { categoryId } : {}),
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        status: true,
        dailyPrice: true,
        currency: true,
        depositPolicyType: true,
        depositValue: true,
        replacementValue: true,
        categoryId: true,
        recommendationTags: true,
        requiresDeepReturnInspection: true,
      },
    });

    return products.map(mapProduct);
  }
}

function mapProduct(product: {
  id: string;
  name: string;
  status: string;
  dailyPrice: { toString(): string };
  currency: string;
  depositPolicyType: string;
  depositValue: { toString(): string };
  replacementValue: { toString(): string };
  categoryId: string;
  recommendationTags: unknown;
  requiresDeepReturnInspection: boolean;
}): RentalProductTransactionData {
  return {
    id: product.id,
    name: product.name,
    status: product.status,
    dailyPrice: product.dailyPrice.toString(),
    currency: product.currency,
    depositPolicyType: product.depositPolicyType,
    depositValue: product.depositValue.toString(),
    replacementValue: product.replacementValue.toString(),
    categoryId: product.categoryId,
    recommendationTags: asStringArray(product.recommendationTags),
    requiresDeepInspectionAfterReturn: product.requiresDeepReturnInspection,
  };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}