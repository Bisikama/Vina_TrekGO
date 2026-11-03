import { Inject, Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../../shared/services/prisma.service'
import { AppError } from '../../../../shared/errors/app-error'
import { GEAR_ERROR_CODES as G } from '../../../../shared/errors/codes/gear.error-codes'
import { USER_GEAR_REPOSITORY_PORT } from '../ports/user-gear.repository.port'
import type { UserGearRepositoryPort } from '../ports/user-gear.repository.port'
import { GearPlanService } from './gear-plan.service'
import { normalizeCreateAttributes, validateAttributesForCategory } from '../dtos/user-gear.dto'
import type { CatalogCreateItemInput, PersonalCatalogDraftInput, PersonalCatalogUpdateInput, PreparationSelectionInput } from '../dtos/gear-phase2.dto'
import type { GearCategory } from '../../domain/gear.types'

@Injectable()
export class GearPhase2Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: GearPlanService,
    @Inject(USER_GEAR_REPOSITORY_PORT) private readonly items: UserGearRepositoryPort,
  ) {}

  async getSelections(planId: string, userId: string) {
    await this.plans.getPlan(planId, userId)
    const row = await this.prisma.gearPlanPreparationSelection.findUnique({ where: { planId } })
    return row ?? { planId, choices: [], version: 0, updatedAt: null }
  }

  async putSelections(planId: string, userId: string, input: PreparationSelectionInput) {
    await this.plans.getPlan(planId, userId)
    if (input.expectedVersion === 0) {
      try {
        return await this.prisma.gearPlanPreparationSelection.create({ data: { planId, choices: input.choices } })
      } catch (error: any) {
        if (error.code === 'P2002') throw AppError.fromCode(G.GEAR_PROGRESS_CAS_CONFLICT)
        throw error
      }
    }
    const updated = await this.prisma.gearPlanPreparationSelection.updateMany({
      where: { planId, version: input.expectedVersion },
      data: { choices: input.choices, version: { increment: 1 }, updatedAt: new Date() },
    })
    if (!updated.count) throw AppError.fromCode(G.GEAR_PROGRESS_CAS_CONFLICT)
    return this.prisma.gearPlanPreparationSelection.findUniqueOrThrow({ where: { planId } })
  }

  private validateDraft(input: PersonalCatalogDraftInput) {
    let attributes: Record<string, unknown>
    try { attributes = validateAttributesForCategory(input.category, input.attributes) }
    catch { throw AppError.fromCode(G.GEAR_CATEGORY_MISMATCH, { message: 'Thông số không hợp lệ cho danh mục' }) }
    const fields = Object.keys(attributes).filter((field) => attributes[field] !== null && attributes[field] !== undefined)
    if (!fields.length || fields.some((field) => !input.evidence[field]) || Object.keys(input.evidence).some((field) => !fields.includes(field))) {
      throw AppError.fromCode(G.GEAR_CATEGORY_MISMATCH, { message: 'Mỗi thông số đã khai báo cần một nguồn minh chứng; không gửi nguồn cho trường chưa có giá trị' })
    }
    return attributes
  }

  async createDraft(actorId: string, input: PersonalCatalogDraftInput) {
    const attributes = this.validateDraft(input)
    return this.prisma.gearPersonalCatalogItem.create({ data: {
      name: input.name, brand: input.brand ?? null, category: input.category,
      attributes: attributes as Prisma.InputJsonValue, evidence: input.evidence, createdBy: actorId,
    } })
  }

  async updateDraft(id: string, input: PersonalCatalogUpdateInput) {
    const attributes = this.validateDraft(input)
    const updated = await this.prisma.gearPersonalCatalogItem.updateMany({ where: { id, state: 'DRAFT', version: input.expectedVersion },
      data: { name: input.name, brand: input.brand ?? null, category: input.category, attributes: attributes as Prisma.InputJsonValue,
        evidence: input.evidence, version: { increment: 1 } } })
    if (!updated.count) throw AppError.fromCode(G.GEAR_PROFILE_VERSION_CONFLICT, { message: 'Bản nháp không tồn tại hoặc phiên bản đã thay đổi' })
    return this.prisma.gearPersonalCatalogItem.findUniqueOrThrow({ where: { id } })
  }

  async listDrafts() {
    return this.prisma.gearPersonalCatalogItem.findMany({ where: { state: 'DRAFT' }, orderBy: { createdAt: 'desc' }, take: 50 })
  }

  async verify(id: string, actorId: string, expectedVersion: number) {
    const updated = await this.prisma.gearPersonalCatalogItem.updateMany({
      where: { id, state: 'DRAFT', version: expectedVersion },
      data: { state: 'VERIFIED', reviewedBy: actorId, reviewedAt: new Date(), version: { increment: 1 } },
    })
    if (!updated.count) throw AppError.fromCode(G.GEAR_PROFILE_VERSION_CONFLICT, { message: 'Bản nháp không tồn tại, đã duyệt hoặc phiên bản đã thay đổi' })
    return this.prisma.gearPersonalCatalogItem.findUniqueOrThrow({ where: { id } })
  }

  async revoke(id: string, actorId: string, expectedVersion: number) {
    const updated = await this.prisma.gearPersonalCatalogItem.updateMany({
      where: { id, state: 'VERIFIED', version: expectedVersion },
      data: { state: 'REVOKED', revokedBy: actorId, revokedAt: new Date(), version: { increment: 1 } },
    })
    if (!updated.count) throw AppError.fromCode(G.GEAR_PROFILE_VERSION_CONFLICT, { message: 'Hồ sơ không còn được công bố hoặc phiên bản đã thay đổi' })
    return this.prisma.gearPersonalCatalogItem.findUniqueOrThrow({ where: { id } })
  }

  async search(query: { q?: string; category?: GearCategory; cursor?: string; limit?: number }) {
    const limit = query.limit ?? 20
    const rows = await this.prisma.gearPersonalCatalogItem.findMany({
      where: { state: 'VERIFIED', ...(query.category ? { category: query.category } : {}),
        ...(query.q ? { OR: [{ name: { contains: query.q, mode: 'insensitive' } }, { brand: { contains: query.q, mode: 'insensitive' } }] } : {}) },
      select: { id: true, name: true, brand: true, category: true, attributes: true, evidence: true, version: true, reviewedAt: true },
      orderBy: { id: 'asc' }, take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    })
    const items = rows.slice(0, limit)
    return { items, nextCursor: rows.length > limit ? items[items.length - 1].id : null }
  }

  async getCatalogItem(id: string) {
    const record = await this.prisma.gearPersonalCatalogItem.findFirst({ where: { id, state: { in: ['VERIFIED', 'REVOKED'] } },
      select: { id: true, name: true, brand: true, category: true, attributes: true, evidence: true, version: true, reviewedAt: true, state: true, revokedAt: true } })
    if (!record) throw AppError.fromCode(G.GEAR_ITEM_NOT_FOUND, { message: 'Không tìm thấy hồ sơ sản phẩm' })
    if (record.state === 'REVOKED') return { id: record.id, state: record.state, revokedAt: record.revokedAt }
    return record
  }

  async createItemFromCatalog(id: string, userId: string, input: CatalogCreateItemInput) {
    const record = await this.prisma.gearPersonalCatalogItem.findFirst({ where: { id, state: 'VERIFIED' } })
    if (!record) throw AppError.fromCode(G.GEAR_ITEM_NOT_FOUND, { message: 'Không tìm thấy sản phẩm đã được kiểm duyệt' })
    const attributes = normalizeCreateAttributes(record.category, record.attributes)
    const attributeProvenance = Object.fromEntries(Object.entries(attributes).filter(([, value]) => value !== null && value !== undefined)
      .map(([field]) => [field, { source: 'VERIFIED_CATALOG', referenceId: record.id }]))
    return this.items.create({ userId, name: record.name, brand: record.brand, category: record.category,
      condition: input.condition, attributes, attributeProvenance, catalogReference: { id: record.id, version: record.version },
      photoRef: null, source: 'MANUAL', acknowledgeDuplicate: input.acknowledgeDuplicate })
  }
}
