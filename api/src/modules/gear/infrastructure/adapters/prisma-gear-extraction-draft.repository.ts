import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../../shared/services/prisma.service'
import { AppError } from '../../../../shared/errors/app-error'
import { GEAR_ERROR_CODES } from '../../../../shared/errors/codes/gear.error-codes'
import { confirmedExtractionProvenance } from '../../domain/attribute-provenance'
import {
  GearCategory,
  GearCondition,
  GearExtractionDraftDomain,
  GearExtractionSourceType,
  GearExtractionStatus,
  GearItemSource,
  UserGearItemDomain,
} from '../../domain/gear.types'
import {
  ConfirmDraftResult,
  CreateDraftInput,
  GearExtractionDraftRepositoryPort,
} from '../../application/ports/gear-extraction-draft.repository.port'

@Injectable()
export class PrismaGearExtractionDraftRepository implements GearExtractionDraftRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdAndUser(id: string, userId: string): Promise<GearExtractionDraftDomain | null> {
    const record = await this.prisma.gearExtractionDraft.findFirst({
      where: { id, userId },
    })
    return record ? this.toDomain(record) : null
  }

  async createDraft(input: CreateDraftInput, client?: any): Promise<GearExtractionDraftDomain> {
    const db = client || this.prisma
    const record = await db.gearExtractionDraft.create({
      data: {
        userId: input.userId,
        sourceType: input.sourceType as any,
        sourceHash: input.sourceHash,
        status: 'PENDING',
        expiresAt: input.expiresAt,
        version: 1,
      },
    })
    return this.toDomain(record)
  }

  async updateExtractedData(
    id: string,
    extractedData: Record<string, unknown>,
    status: GearExtractionStatus,
    expectedVersion?: number,
  ): Promise<GearExtractionDraftDomain> {
    const draft = await this.prisma.gearExtractionDraft.findUnique({
      where: { id },
    })

    if (!draft) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_EXTRACTION_DRAFT_NOT_FOUND, {
        message: 'Không tìm thấy bản nháp trích xuất trang bị',
      })
    }

    if (draft.status === 'CONFIRMED' || draft.status === 'FAILED') {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_DRAFT_ALREADY_CONFIRMED, {
        message: `Bản nháp đã ở trạng thái kết thúc (${draft.status}), không thể cập nhật kết quả`,
      })
    }

    const versionToMatch = expectedVersion !== undefined ? expectedVersion : draft.version

    const res = await this.prisma.gearExtractionDraft.updateMany({
      where: {
        id,
        version: versionToMatch,
      },
      data: {
        extractedData: extractedData as any,
        status: status as any,
        version: { increment: 1 },
      },
    })

    if (res.count === 0) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CONCURRENCY_CONFLICT, {
        message: 'Xung đột phiên bản khi cập nhật dữ liệu bản nháp',
      })
    }

    const updated = await this.prisma.gearExtractionDraft.findUniqueOrThrow({
      where: { id },
    })
    return this.toDomain(updated)
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
      })

      if (!draft) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_EXTRACTION_DRAFT_NOT_FOUND, {
          message: 'Không tìm thấy bản nháp trích xuất hoặc không thuộc quyền sở hữu của bạn',
        })
      }

      // Check expiry
      if (draft.expiresAt <= new Date()) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_DRAFT_EXPIRED, {
          message: 'Bản nháp trích xuất trang bị đã hết hạn',
        })
      }

      if (draft.status === 'CONFIRMED') {
        if (draft.confirmationPayloadHash !== payloadHash) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_DRAFT_PAYLOAD_MISMATCH, {
            message: 'Bản nháp đã được xác nhận với nội dung khác, không thể xác nhận lại',
          })
        }

        // Hash matches: check if confirmed item still exists
        if (!draft.confirmedItemId) {
          // Confirmed item was hard-deleted (onDelete: SetNull): return 404 per MASTER 1.1.H
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, {
            message: 'Món đồ cá nhân đã được xác nhận từ bản nháp này nhưng sau đó đã bị xóa khỏi tủ đồ',
          })
        }

        const existingItem = await tx.userGearItem.findFirst({
          where: { id: draft.confirmedItemId, userId },
        })

        if (existingItem) {
          return {
            item: this.toItemDomain(existingItem),
            replayed: true,
          }
        }

        // Confirmed item was hard-deleted by user: return 404 per MASTER 1.1.H
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, {
          message: 'Món đồ cá nhân đã được xác nhận từ bản nháp này nhưng sau đó đã bị xóa khỏi tủ đồ',
        })
      }

      // Check READY status
      if (draft.status !== 'READY') {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_DRAFT_NOT_READY, {
          message: `Bản nháp chưa sẵn sàng để xác nhận (trạng thái hiện tại: ${draft.status})`,
        })
      }

      // Check expectedVersion if supplied
      if (expectedVersion !== undefined && draft.version !== expectedVersion) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CONCURRENCY_CONFLICT, {
          message: 'Xung đột phiên bản khi xác nhận bản nháp',
        })
      }

      // 1. Create UserGearItem
      const newItem = await tx.userGearItem.create({
        data: {
          userId,
          name: itemData.name,
          category: itemData.category as any,
          brand: itemData.brand ?? null,
          condition: itemData.condition as any,
          attributes: (itemData.attributes ?? {}) as any,
          attributeProvenance: confirmedExtractionProvenance(itemData.attributes ?? {}, draft.extractedData, itemData.category,
            draft.sourceType === 'IMAGE' ? 'AI_IMAGE' : 'AI_LINK', draftId) as any,
          photoRef: itemData.photoRef ?? null,
          source: (draft.sourceType === 'IMAGE' ? 'AI_IMAGE' : 'AI_LINK') as any,
          version: 1,
        },
      })

      // 2. CAS update draft to CONFIRMED
      const versionToMatch = expectedVersion !== undefined ? expectedVersion : draft.version
      const updateRes = await tx.gearExtractionDraft.updateMany({
        where: {
          id: draftId,
          version: versionToMatch,
          status: 'READY',
        },
        data: {
          status: 'CONFIRMED',
          confirmedItemId: newItem.id,
          confirmationPayloadHash: payloadHash,
          version: { increment: 1 },
        },
      })

      if (updateRes.count === 0) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CONCURRENCY_CONFLICT, {
          message: 'Xung đột khi xác nhận bản nháp đồng thời',
        })
      }

      return {
        item: this.toItemDomain(newItem),
        replayed: false,
      }
    })
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
    }
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
      attributeProvenance: (record.attributeProvenance as Record<string, unknown>) ?? null,
      photoRef: record.photoRef,
      source: record.source as GearItemSource,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }
}
