import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { AppError } from '../../../../shared/errors/app-error';
import { GEAR_ERROR_CODES } from '../../../../shared/errors/codes/gear.error-codes';
import {
  GearCategory,
  GearCondition,
  GearExtractionDraftDomain,
  GearExtractionSourceType,
  GearExtractionStatus,
  GearItemSource,
  UserGearItemDomain,
} from '../../domain/gear.types';
import {
  ConfirmDraftResult,
  CreateDraftInput,
  GearExtractionDraftRepositoryPort,
} from '../../application/ports/gear-extraction-draft.repository.port';

@Injectable()
export class PrismaGearExtractionDraftRepository implements GearExtractionDraftRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async createDraft(input: CreateDraftInput): Promise<GearExtractionDraftDomain> {
    const record = await this.prisma.gearExtractionDraft.create({
      data: {
        userId: input.userId,
        sourceType: input.sourceType as any,
        sourceHash: input.sourceHash,
        status: 'PENDING',
        expiresAt: input.expiresAt,
        version: 1,
      },
    });
    return this.toDomain(record);
  }

  async findByIdAndUser(id: string, userId: string): Promise<GearExtractionDraftDomain | null> {
    const record = await this.prisma.gearExtractionDraft.findFirst({
      where: { id, userId },
    });
    return record ? this.toDomain(record) : null;
  }

  async updateExtractedData(
    id: string,
    extractedData: Record<string, unknown>,
    status: GearExtractionStatus,
    expectedVersion?: number,
  ): Promise<GearExtractionDraftDomain> {
    const updateRes = await this.prisma.gearExtractionDraft.updateMany({
      where: {
        id,
        status: { notIn: ['CONFIRMED', 'FAILED'] as any },
        ...(expectedVersion !== undefined ? { version: expectedVersion } : {}),
      },
      data: {
        extractedData: extractedData as any,
        status: status as any,
        version: { increment: 1 },
      },
    });

    if (updateRes.count === 0) {
      const existing = await this.prisma.gearExtractionDraft.findUnique({
        where: { id },
      });
      if (!existing) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_EXTRACTION_DRAFT_NOT_FOUND, {
          message: 'Bản nháp trích xuất không tồn tại',
        });
      }
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CONCURRENCY_CONFLICT, {
        message: 'Không thể ghi đè bản nháp đã xác nhận/thất bại hoặc xung đột phiên bản',
      });
    }

    const updated = await this.prisma.gearExtractionDraft.findUniqueOrThrow({
      where: { id },
    });
    return this.toDomain(updated);
  }

  async confirmDraft(
    draftId: string,
    userId: string,
    payloadHash: string,
    itemData: Omit<UserGearItemDomain, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
    expectedVersion?: number,
  ): Promise<ConfirmDraftResult> {
    return this.prisma.$transaction(async (tx) => {
      const draft = await tx.gearExtractionDraft.findFirst({
        where: { id: draftId, userId },
      });

      if (!draft) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_EXTRACTION_DRAFT_NOT_FOUND, {
          message: 'Bản nháp trích xuất không tồn tại hoặc không thuộc quyền sở hữu của bạn',
        });
      }

      if (draft.status === 'CONFIRMED') {
        if (draft.confirmationPayloadHash === payloadHash && draft.confirmedItemId) {
          // Idempotent replay: fetch confirmed item
          const existingItem = await tx.userGearItem.findFirst({
            where: { id: draft.confirmedItemId, userId },
          });
          if (existingItem) {
            return {
              item: this.toItemDomain(existingItem),
              replayed: true,
            };
          }
          // Confirmed item was deleted by user: do NOT recreate
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_DRAFT_ALREADY_CONFIRMED, {
            message: 'Bản nháp đã được xác nhận trước đó và món đồ đã được quản lý riêng',
          });
        }
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_DRAFT_PAYLOAD_MISMATCH, {
          message: 'Bản nháp đã được xác nhận với nội dung khác, không thể xác nhận lại',
        });
      }

      // Check READY status
      if (draft.status !== 'READY') {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_DRAFT_NOT_READY, {
          message: `Bản nháp chưa sẵn sàng để xác nhận (trạng thái hiện tại: ${draft.status})`,
        });
      }

      if (draft.expiresAt < new Date()) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_DRAFT_EXPIRED, {
          message: 'Bản nháp trích xuất đã hết hạn',
        });
      }

      if (expectedVersion !== undefined && draft.version !== expectedVersion) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CONCURRENCY_CONFLICT, {
          message: `Xung đột phiên bản bản nháp (hiện tại: ${draft.version}, yêu cầu: ${expectedVersion})`,
        });
      }

      // Map source correctly: IMAGE -> AI_IMAGE, LINK -> AI_LINK
      const mappedSource: GearItemSource =
        draft.sourceType === 'IMAGE' ? 'AI_IMAGE' : 'AI_LINK';

      const newItem = await tx.userGearItem.create({
        data: {
          userId,
          name: itemData.name,
          category: itemData.category as any,
          brand: itemData.brand ?? null,
          condition: itemData.condition as any,
          attributes: (itemData.attributes ?? {}) as any,
          photoRef: itemData.photoRef ?? null,
          source: mappedSource as any,
          version: 1,
        },
      });

      // Atomic CAS update to CONFIRMED
      const updateRes = await tx.gearExtractionDraft.updateMany({
        where: {
          id: draftId,
          userId,
          status: 'READY',
          version: draft.version,
        },
        data: {
          status: 'CONFIRMED',
          confirmedItemId: newItem.id,
          confirmationPayloadHash: payloadHash,
          version: { increment: 1 },
        },
      });

      if (updateRes.count === 0) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CONCURRENCY_CONFLICT, {
          message: 'Xung đột khi xác nhận bản nháp đồng thời',
        });
      }

      return {
        item: this.toItemDomain(newItem),
        replayed: false,
      };
    });
  }

  private toDomain(record: any): GearExtractionDraftDomain {
    return {
      id: record.id,
      userId: record.userId,
      sourceType: record.sourceType as GearExtractionSourceType,
      sourceHash: record.sourceHash,
      status: record.status as GearExtractionStatus,
      extractedData: record.extractedData as Record<string, unknown> | null,
      confirmedItemId: record.confirmedItemId,
      confirmationPayloadHash: record.confirmationPayloadHash,
      version: record.version,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private toItemDomain(record: any): UserGearItemDomain {
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
