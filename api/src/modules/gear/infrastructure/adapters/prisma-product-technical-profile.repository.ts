import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { AppError } from '../../../../shared/errors/app-error';
import { GEAR_ERROR_CODES } from '../../../../shared/errors/codes/gear.error-codes';
import { GearCategory, ProductTechnicalProfileDomain } from '../../domain/gear.types';
import { ProductTechnicalProfileRepositoryPort } from '../../application/ports/product-technical-profile.repository.port';

@Injectable()
export class PrismaProductTechnicalProfileRepository
  implements ProductTechnicalProfileRepositoryPort
{
  constructor(private readonly prisma: PrismaService) {}

  async findByProductId(productId: string): Promise<ProductTechnicalProfileDomain | null> {
    const record = await this.prisma.productTechnicalProfile.findUnique({
      where: { productId },
    });
    return record ? this.toDomain(record) : null;
  }

  async upsertProfile(
    productId: string,
    category: GearCategory,
    attributes: Record<string, unknown>,
    expectedVersion?: number,
    schemaVersion?: string,
    sources?: Record<string, unknown>,
    actorId?: string,
  ): Promise<ProductTechnicalProfileDomain> {
    const existing = await this.prisma.productTechnicalProfile.findUnique({
      where: { productId },
    });

    const persistAttrs: Record<string, unknown> = {
      ...attributes,
      ...(schemaVersion ? { _schemaVersion: schemaVersion } : {}),
      ...(sources ? { _sources: sources } : {}),
      ...(actorId ? { _lastModifiedBy: actorId } : {}),
    };

    if (!existing) {
      if (expectedVersion !== undefined && expectedVersion !== 1 && expectedVersion !== 0) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PROFILE_VERSION_CONFLICT, {
          message: 'Hồ sơ kỹ thuật sản phẩm chưa tồn tại nhưng yêu cầu phiên bản cập nhật',
        });
      }

      try {
        const created = await this.prisma.productTechnicalProfile.create({
          data: {
            productId,
            category: category as any,
            attributes: persistAttrs as any,
            version: 1,
          },
        });
        return this.toDomain(created);
      } catch (err: any) {
        if (err?.code === 'P2002') {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PROFILE_VERSION_CONFLICT, {
            message: 'Xung đột khi tạo đồng thời hồ sơ kỹ thuật sản phẩm',
          });
        }
        if (err?.code === 'P2003') {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, {
            message: 'Sản phẩm thuê không tồn tại trong hệ thống',
          });
        }
        throw err;
      }
    }

    if (expectedVersion !== undefined && existing.version !== expectedVersion) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PROFILE_VERSION_CONFLICT, {
        message: `Xung đột phiên bản hồ sơ kỹ thuật sản phẩm (hiện tại: ${existing.version}, yêu cầu: ${expectedVersion})`,
      });
    }

    const versionToMatch = expectedVersion !== undefined ? expectedVersion : existing.version;

    const result = await this.prisma.productTechnicalProfile.updateMany({
      where: {
        productId,
        version: versionToMatch,
      },
      data: {
        category: category as any,
        attributes: persistAttrs as any,
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PROFILE_VERSION_CONFLICT, {
        message: 'Xung đột phiên bản khi cập nhật hồ sơ kỹ thuật sản phẩm đồng thời',
      });
    }

    const updated = await this.prisma.productTechnicalProfile.findUniqueOrThrow({
      where: { productId },
    });
    return this.toDomain(updated);
  }

  private toDomain(record: any): ProductTechnicalProfileDomain {
    const rawAttrs = (record.attributes as Record<string, unknown>) || {};
    const schemaVersion = typeof rawAttrs._schemaVersion === 'string' ? rawAttrs._schemaVersion : undefined;
    const sources = (rawAttrs._sources as Record<string, unknown>) || undefined;

    const cleanAttrs = { ...rawAttrs };
    delete cleanAttrs._schemaVersion;
    delete cleanAttrs._sources;
    delete cleanAttrs._lastModifiedBy;

    return {
      id: record.id,
      productId: record.productId,
      category: record.category as GearCategory,
      attributes: cleanAttrs,
      schemaVersion,
      sources,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
