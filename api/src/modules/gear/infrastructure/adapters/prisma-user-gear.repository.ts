import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { AppError } from '../../../../shared/errors/app-error';
import { GEAR_ERROR_CODES } from '../../../../shared/errors/codes/gear.error-codes';
import {
  GearCategory,
  GearCondition,
  GearItemSource,
  UserGearItemDomain,
} from '../../domain/gear.types';
import {
  UserGearPatchInput,
  UserGearRepositoryPort,
} from '../../application/ports/user-gear.repository.port';

@Injectable()
export class PrismaUserGearRepository implements UserGearRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdAndUser(id: string, userId: string): Promise<UserGearItemDomain | null> {
    const record = await this.prisma.userGearItem.findFirst({
      where: { id, userId },
    });
    return record ? this.toDomain(record) : null;
  }

  async findAllByUser(userId: string, category?: GearCategory): Promise<UserGearItemDomain[]> {
    const records = await this.prisma.userGearItem.findMany({
      where: {
        userId,
        ...(category ? { category: category as any } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async create(
    item: Omit<UserGearItemDomain, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
  ): Promise<UserGearItemDomain> {
    const record = await this.prisma.userGearItem.create({
      data: {
        userId: item.userId,
        name: item.name,
        category: item.category as any,
        brand: item.brand ?? null,
        condition: item.condition as any,
        attributes: (item.attributes ?? {}) as any,
        photoRef: item.photoRef ?? null,
        source: item.source as any,
        version: 1,
      },
    });
    return this.toDomain(record);
  }

  async patch(
    id: string,
    userId: string,
    patch: UserGearPatchInput,
    expectedVersion?: number,
  ): Promise<UserGearItemDomain> {
    // Interactive transaction for atomic read-merge-CAS
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.userGearItem.findFirst({
        where: { id, userId },
      });

      if (!existing) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, {
          message: 'Món đồ cá nhân không tồn tại hoặc không thuộc quyền sở hữu của bạn',
        });
      }

      if (expectedVersion !== undefined && existing.version !== expectedVersion) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_VERSION_CONFLICT, {
          message: `Xung đột phiên bản món đồ cá nhân (hiện tại: ${existing.version}, yêu cầu: ${expectedVersion})`,
        });
      }

      const isCategoryChange = patch.category !== undefined && patch.category !== existing.category;
      let newAttributes: Record<string, unknown>;

      if (isCategoryChange) {
        // Discard old category attributes completely!
        newAttributes = { ...(patch.attributes ?? {}) };
      } else {
        newAttributes = { ...((existing.attributes as Record<string, unknown>) || {}) };
        if (patch.attributes) {
          for (const [key, value] of Object.entries(patch.attributes)) {
            // Keep explicit null as required by REQUIREMENT_POLICY! Do NOT delete key.
            newAttributes[key] = value;
          }
        }
      }

      const versionToMatch = expectedVersion !== undefined ? expectedVersion : existing.version;

      // Scoped write: both id, userId, and version in the filter
      const updateResult = await tx.userGearItem.updateMany({
        where: {
          id,
          userId,
          version: versionToMatch,
        },
        data: {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.brand !== undefined ? { brand: patch.brand } : {}),
          ...(patch.condition !== undefined ? { condition: patch.condition as any } : {}),
          ...(patch.category !== undefined ? { category: patch.category as any } : {}),
          ...(patch.photoRef !== undefined ? { photoRef: patch.photoRef } : {}),
          attributes: newAttributes as any,
          version: { increment: 1 },
        },
      });

      if (updateResult.count === 0) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_VERSION_CONFLICT, {
          message: 'Xung đột phiên bản khi cập nhật món đồ cá nhân (CAS conflict)',
        });
      }

      const updated = await tx.userGearItem.findFirstOrThrow({
        where: { id, userId },
      });

      return this.toDomain(updated);
    });
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await this.prisma.userGearItem.deleteMany({
      where: { id, userId },
    });
    if (result.count === 0) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, {
        message: 'Món đồ cá nhân không tồn tại hoặc không thuộc quyền sở hữu của bạn',
      });
    }
    return true;
  }

  private toDomain(record: any): UserGearItemDomain {
    return {
      id: record.id,
      userId: record.userId,
      name: record.name,
      category: record.category as GearCategory,
      brand: record.brand,
      condition: record.condition as GearCondition,
      attributes: (record.attributes as Record<string, unknown>) || {},
      photoRef: record.photoRef,
      source: record.source as GearItemSource,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
