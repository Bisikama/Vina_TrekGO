import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { AppError } from '../../../../shared/errors/app-error';
import { GEAR_ERROR_CODES } from '../../../../shared/errors/codes/gear.error-codes';
import { COMMON_ERROR_CODES } from '../../../../shared/errors/codes/common.error-codes';
import { GearExtractionCacheDomain } from '../../domain/gear.types';
import {
  GearExtractionCachePort,
  LeaseValidationContext,
} from '../../application/ports/gear-extraction-cache.port';

@Injectable()
export class PrismaGearExtractionCacheAdapter implements GearExtractionCachePort {
  constructor(private readonly prisma: PrismaService) {}

  async getCache(
    ownerScope: string,
    contentHash: string,
    promptVersion: string,
    modelVersion: string,
    schemaVersion: string,
  ): Promise<GearExtractionCacheDomain | null> {
    const record = await this.prisma.gearExtractionCache.findUnique({
      where: {
        ownerScope_contentHash_promptVersion_modelVersion_schemaVersion: {
          ownerScope,
          contentHash,
          promptVersion,
          modelVersion,
          schemaVersion,
        },
      },
    });

    if (!record) return null;

    // Only SUCCESS status is considered a cache hit; PENDING/FAILED are misses
    if (record.status !== 'SUCCESS') {
      return null;
    }

    // Check expiration: expired records (expiresAt <= now) are not hits
    if (record.expiresAt <= new Date()) {
      return null;
    }

    return this.toDomain(record);
  }

  async setCache(
    data: Omit<GearExtractionCacheDomain, 'id' | 'createdAt'>,
    leaseValidation?: LeaseValidationContext,
  ): Promise<GearExtractionCacheDomain> {
    if (data.status !== 'SUCCESS') {
      throw AppError.fromCode(COMMON_ERROR_CODES.VALIDATION_ERROR, {
        message: `Chỉ lưu trữ kết quả trích xuất thành công (SUCCESS) vào cache, từ chối lưu trạng thái: ${data.status}`,
      });
    }

    const performUpsert = async (tx: any) => {
      // Validate lease if provided (conditional publish with row lock to eliminate worker race)
      if (leaseValidation) {
        let validLease: any = null;
        if (typeof tx.$queryRawUnsafe === 'function') {
          try {
            const rows = await tx.$queryRawUnsafe(
              `SELECT id, fencing_token FROM gear_extraction_leases WHERE resource_key = $1 AND owner_token = $2 AND fencing_token = $3 AND lease_expires_at > NOW() FOR UPDATE`,
              leaseValidation.resourceKey,
              leaseValidation.ownerToken,
              leaseValidation.fencingToken,
            );
            if (Array.isArray(rows) && rows.length > 0) {
              validLease = rows[0];
            }
          } catch {
            validLease = await tx.gearExtractionLease?.findFirst({
              where: {
                resourceKey: leaseValidation.resourceKey,
                ownerToken: leaseValidation.ownerToken,
                fencingToken: leaseValidation.fencingToken,
                leaseExpiresAt: { gt: new Date() },
              },
            });
          }
        } else {
          validLease = await tx.gearExtractionLease?.findFirst({
            where: {
              resourceKey: leaseValidation.resourceKey,
              ownerToken: leaseValidation.ownerToken,
              fencingToken: leaseValidation.fencingToken,
              leaseExpiresAt: { gt: new Date() },
            },
          });
        }

        if (!validLease) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CONCURRENCY_CONFLICT, {
            message: 'Khóa xử lý đã hết hạn hoặc bị takeover bởi tiến trình khác, từ chối xuất bản cache',
          });
        }
      }

      const record = await tx.gearExtractionCache.upsert({
        where: {
          ownerScope_contentHash_promptVersion_modelVersion_schemaVersion: {
            ownerScope: data.ownerScope,
            contentHash: data.contentHash,
            promptVersion: data.promptVersion,
            modelVersion: data.modelVersion,
            schemaVersion: data.schemaVersion,
          },
        },
        create: {
          ownerScope: data.ownerScope,
          contentHash: data.contentHash,
          promptVersion: data.promptVersion,
          modelVersion: data.modelVersion,
          schemaVersion: data.schemaVersion,
          status: 'SUCCESS', // Only SUCCESS is persisted as cacheable result
          resultJson: data.resultJson as any,
          expiresAt: data.expiresAt,
        },
        update: {
          status: 'SUCCESS',
          resultJson: data.resultJson as any,
          expiresAt: data.expiresAt,
        },
      });

      return this.toDomain(record);
    };

    if (leaseValidation) {
      return this.prisma.$transaction(async (tx) => performUpsert(tx));
    }
    return performUpsert(this.prisma);
  }

  private toDomain(record: any): GearExtractionCacheDomain {
    return {
      id: record.id,
      ownerScope: record.ownerScope,
      contentHash: record.contentHash,
      promptVersion: record.promptVersion,
      modelVersion: record.modelVersion,
      schemaVersion: record.schemaVersion,
      status: record.status,
      resultJson: (record.resultJson as Record<string, unknown>) || {},
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
    };
  }
}
