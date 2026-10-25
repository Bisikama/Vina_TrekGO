import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../../shared/services/prisma.service'
import { AppError } from '../../../../shared/errors/app-error'
import { GEAR_ERROR_CODES } from '../../../../shared/errors/codes/gear.error-codes'
import {
  GearCategory,
  GearCondition,
  GearItemSource,
  UserGearItemDomain,
  UserGearItemPhotoDomain,
} from '../../domain/gear.types'
import {
  CreateUserGearItemRepoInput,
  UserGearPatchInput,
  UserGearRepositoryPort,
} from '../../application/ports/user-gear.repository.port'
import { findSimilarItems } from '../../domain/duplicate-detector'
import { validateAttributesForCategory } from '../../application/dtos/user-gear.dto'

function isUuid(val: string | null | undefined): boolean {
  if (!val || typeof val !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val)
}

@Injectable()
export class PrismaUserGearRepository implements UserGearRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdAndUser(id: string, userId: string): Promise<UserGearItemDomain | null> {
    const record = await this.prisma.userGearItem.findFirst({
      where: { id, userId },
      include: { photos: { orderBy: { position: 'asc' } } },
    })
    return record ? this.toDomain(record) : null
  }

  async findByIdsAndUser(ids: string[], userId: string): Promise<UserGearItemDomain[]> {
    if (ids.length === 0) return []
    const records = await this.prisma.userGearItem.findMany({
      where: {
        id: { in: ids },
        userId,
      },
      include: { photos: { orderBy: { position: 'asc' } } },
    })
    return records.map((r) => this.toDomain(r))
  }

  async findAllByUser(userId: string, category?: GearCategory): Promise<UserGearItemDomain[]> {
    const records = await this.prisma.userGearItem.findMany({
      where: {
        userId,
        ...(category ? { category: category as any } : {}),
      },
      include: { photos: { orderBy: { position: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    })
    return records.map((r) => this.toDomain(r))
  }

  async countByUser(userId: string): Promise<number> {
    return this.prisma.userGearItem.count({
      where: { userId },
    })
  }

  /**
   * B04-04: Creates a user gear item within an exclusive owner critical section.
   * Serializes concurrent requests by locking the owner user row, checking the configurable limit,
   * querying candidates and running pure duplicate detection inside the critical section,
   * and inserting item and photos atomically.
   */
  async create(
    item: CreateUserGearItemRepoInput,
    photos?: Array<{ storageRef: string; position: number }>,
    maxLimit: number = 50,
  ): Promise<UserGearItemDomain> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Acquire owner lock to serialize concurrent creation requests per user
      if (typeof tx.$executeRaw === 'function') {
        try {
          await tx.$executeRaw`SELECT id FROM users WHERE id = ${item.userId}::uuid FOR UPDATE`
        } catch (err: any) {
          if (err instanceof AppError) throw err
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, {
            message: 'Không tìm thấy người dùng sở hữu tương ứng',
          })
        }
      }

      // 2. Enforce configurable item limit (default 50)
      const currentCount = await tx.userGearItem.count({
        where: { userId: item.userId },
      })

      if (currentCount >= maxLimit) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_LIMIT_EXCEEDED, {
          message: `Tủ đồ đã đạt giới hạn tối đa ${maxLimit} món (không thể thêm mới)`,
        })
      }

      // 3. Duplicate check inside owner critical section
      if (!item.acknowledgeDuplicate) {
        const candidateRecords = await tx.userGearItem.findMany({
          where: { userId: item.userId },
          include: { photos: { orderBy: { position: 'asc' } } },
        })
        const candidates = candidateRecords.map((r) => this.toDomain(r))

        const duplicateDetails = findSimilarItems(
          {
            category: item.category,
            condition: item.condition,
            attributes: item.attributes,
          },
          candidates,
        )

        if (duplicateDetails) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_POSSIBLE_DUPLICATE, {
            message: 'Phát hiện món đồ có thông số tương tự trong tủ đồ',
            details: duplicateDetails as unknown as Record<string, unknown>,
          })
        }
      }

      // 4. Check photo limit (max 3 photos, positions 0..2)
      if (photos && photos.length > 3) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PHOTO_LIMIT_EXCEEDED, {
          message: 'Mỗi món đồ chỉ được tối đa 3 ảnh (vị trí 0..2)',
        })
      }

      if (photos && photos.length > 0) {
        const positions = photos.map((p) => p.position)
        if (new Set(positions).size !== positions.length) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PHOTO_LIMIT_EXCEEDED, {
            message: 'Vị trí ảnh bị trùng lặp trong yêu cầu tạo',
          })
        }
        if (positions.some((pos) => pos < 0 || pos > 2)) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PHOTO_LIMIT_EXCEEDED, {
            message: 'Vị trí ảnh không hợp lệ (chỉ chấp nhận 0, 1 hoặc 2)',
          })
        }
      }

      // 5. Determine cover photoRef (must be UUID of MediaAsset) and synchronize photos list
      let effectivePhotos = photos
      if (item.photoRef && isUuid(item.photoRef) && (!effectivePhotos || effectivePhotos.length === 0)) {
        effectivePhotos = [{ storageRef: item.photoRef, position: 0 }]
      }

      const coverPhoto = effectivePhotos?.find((p) => p.position === 0)
      let photoRefToSave: string | null = null
      if (coverPhoto && isUuid(coverPhoto.storageRef)) {
        photoRefToSave = coverPhoto.storageRef
      } else if (item.photoRef && isUuid(item.photoRef)) {
        photoRefToSave = item.photoRef
      }

      const record = await tx.userGearItem.create({
        data: {
          userId: item.userId,
          name: item.name,
          category: item.category as any,
          brand: item.brand ?? null,
          condition: item.condition as any,
          attributes: (item.attributes ?? {}) as any,
          photoRef: photoRefToSave,
          source: item.source as any,
          version: 1,
          ...(effectivePhotos && effectivePhotos.length > 0
            ? {
                photos: {
                  create: effectivePhotos.map((p) => ({
                    storageRef: p.storageRef,
                    position: p.position,
                  })),
                },
              }
            : {}),
        },
        include: { photos: { orderBy: { position: 'asc' } } },
      })

      return this.toDomain(record)
    })
  }

  async patch(
    id: string,
    userId: string,
    patch: UserGearPatchInput,
    expectedVersion?: number,
  ): Promise<UserGearItemDomain> {
    const maxRetries = expectedVersion !== undefined ? 1 : 3

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const result = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.userGearItem.findFirst({
          where: { id, userId },
          include: { photos: { orderBy: { position: 'asc' } } },
        })

        if (!existing) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, {
            message: 'Món đồ cá nhân không tồn tại hoặc không thuộc quyền sở hữu của bạn',
          })
        }

        if (expectedVersion !== undefined && existing.version !== expectedVersion) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_VERSION_CONFLICT, {
            message: `Xung đột phiên bản món đồ cá nhân (hiện tại: ${existing.version}, yêu cầu: ${expectedVersion})`,
          })
        }

        const targetCategory = patch.category ?? existing.category
        const isCategoryChange = patch.category !== undefined && patch.category !== existing.category
        let newAttributes: Record<string, unknown>

        if (isCategoryChange) {
          // Discard old category attributes completely
          newAttributes = { ...(patch.attributes ?? {}) }
        } else {
          newAttributes = { ...((existing.attributes as Record<string, unknown>) || {}) }
          if (patch.attributes) {
            for (const [key, value] of Object.entries(patch.attributes)) {
              if (value === null) {
                newAttributes[key] = null
              } else if (value !== undefined) {
                newAttributes[key] = value
              }
            }
          }
          // Validate merged attributes against target category rules to avoid corrupt/invalid data
          try {
            newAttributes = validateAttributesForCategory(targetCategory, newAttributes)
          } catch (err: any) {
            throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CATEGORY_MISMATCH, {
              message: err?.message || 'Thuộc tính sau khi hợp nhất không hợp lệ cho danh mục hiện tại',
              details: { errors: err?.errors || err?.message },
            })
          }
        }

        let photoRefUuid = patch.photoRef !== undefined ? (isUuid(patch.photoRef) ? patch.photoRef : null) : undefined
        if (patch.photoRef !== undefined) {
          if (photoRefUuid) {
            if (existing.photos.length > 0) {
              await tx.userGearItemPhoto.update({
                where: { id: existing.photos[0].id },
                data: { storageRef: photoRefUuid },
              })
            } else {
              await tx.userGearItemPhoto.create({
                data: { itemId: id, storageRef: photoRefUuid, position: 0 },
              })
            }
          } else if (patch.photoRef === null && existing.photos.length > 0) {
            await tx.userGearItemPhoto.delete({
              where: { id: existing.photos[0].id },
            })
            const remaining = existing.photos.slice(1)
            for (let i = 0; i < remaining.length; i++) {
              await tx.userGearItemPhoto.update({
                where: { id: remaining[i].id },
                data: { position: i },
              })
            }
            photoRefUuid = remaining[0] ? remaining[0].storageRef : null
          }
        }

        const updateResult = await tx.userGearItem.updateMany({
          where: {
            id,
            userId,
            version: existing.version,
          },
          data: {
            ...(patch.name !== undefined ? { name: patch.name } : {}),
            ...(patch.brand !== undefined ? { brand: patch.brand } : {}),
            ...(patch.condition !== undefined ? { condition: patch.condition as any } : {}),
            ...(patch.category !== undefined ? { category: patch.category as any } : {}),
            ...(photoRefUuid !== undefined ? { photoRef: photoRefUuid } : {}),
            attributes: newAttributes as any,
            version: { increment: 1 },
          },
        })

        if (updateResult.count > 0) {
          // Read updated snapshot within the same transaction to guarantee consistency
          const updated = await tx.userGearItem.findFirstOrThrow({
            where: { id, userId },
            include: { photos: { orderBy: { position: 'asc' } } },
          })
          return this.toDomain(updated)
        }

        return null
      })

      if (result) {
        return result
      }

      if (expectedVersion !== undefined) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_VERSION_CONFLICT, {
          message: 'Xung đột phiên bản khi cập nhật món đồ cá nhân (CAS conflict)',
        })
      }
    }

    throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_VERSION_CONFLICT, {
      message: 'Không thể hoàn thành cập nhật do xung đột phiên bản sau nhiều lần thử',
    })
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const existing = await this.prisma.userGearItem.findFirst({
      where: { id, userId },
    })
    if (!existing) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, {
        message: 'Món đồ cá nhân không tồn tại hoặc không thuộc quyền sở hữu của bạn',
      })
    }

    // Hard delete per Section 1.1.H (cascades photos via DB FK cascade)
    await this.prisma.userGearItem.delete({
      where: { id },
    })
    return true
  }

  async addPhoto(
    itemId: string,
    userId: string,
    storageRef: string,
    position?: number,
  ): Promise<UserGearItemPhotoDomain> {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.userGearItem.findFirst({
        where: { id: itemId, userId },
        include: { photos: { orderBy: { position: 'asc' } } },
      })

      if (!item) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, {
          message: 'Món đồ cá nhân không tồn tại hoặc không thuộc quyền sở hữu của bạn',
        })
      }

      if (item.photos.length >= 3) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PHOTO_LIMIT_EXCEEDED, {
          message: 'Món đồ đã có tối đa 3 ảnh',
        })
      }

      const occupiedSlots = new Set(item.photos.map((p) => p.position))
      let assignedPos = position

      if (assignedPos === undefined) {
        // Find smallest available slot in [0, 1, 2]
        for (let slot = 0; slot <= 2; slot++) {
          if (!occupiedSlots.has(slot)) {
            assignedPos = slot
            break
          }
        }
      }

      if (assignedPos === undefined || assignedPos < 0 || assignedPos > 2 || occupiedSlots.has(assignedPos)) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PHOTO_LIMIT_EXCEEDED, {
          message: 'Vị trí ảnh đã tồn tại hoặc không hợp lệ (chỉ chấp nhận 0, 1 hoặc 2)',
        })
      }

      const photoRecord = await tx.userGearItemPhoto.create({
        data: {
          itemId,
          storageRef,
          position: assignedPos,
        },
      })

      // Synchronize cover photoRef atomically if position === 0
      if (assignedPos === 0) {
        const coverRef = isUuid(storageRef) ? storageRef : null
        await tx.userGearItem.update({
          where: { id: itemId },
          data: { photoRef: coverRef },
        })
      }

      return {
        id: photoRecord.id,
        itemId: photoRecord.itemId,
        storageRef: photoRecord.storageRef,
        position: photoRecord.position,
        createdAt: photoRecord.createdAt,
      }
    })
  }

  async deletePhoto(itemId: string, photoId: string, userId: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.userGearItem.findFirst({
        where: { id: itemId, userId },
        include: { photos: { orderBy: { position: 'asc' } } },
      })

      if (!item) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, {
          message: 'Món đồ cá nhân không tồn tại hoặc không thuộc quyền sở hữu của bạn',
        })
      }

      const targetPhoto = item.photos.find((p) => p.id === photoId)
      if (!targetPhoto) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, {
          message: 'Không tìm thấy ảnh của món đồ',
        })
      }

      // 1. Delete target photo
      await tx.userGearItemPhoto.delete({
        where: { id: photoId },
      })

      // 2. Compact remaining photos to positions 0, 1, ...
      const remaining = item.photos.filter((p) => p.id !== photoId).sort((a, b) => a.position - b.position)

      // Phase 1: assign temporary negative positions to eliminate unique collision risks
      for (let i = 0; i < remaining.length; i++) {
        await tx.userGearItemPhoto.update({
          where: { id: remaining[i].id },
          data: { position: -100 - i },
        })
      }

      // Phase 2: assign compacted positions
      for (let i = 0; i < remaining.length; i++) {
        await tx.userGearItemPhoto.update({
          where: { id: remaining[i].id },
          data: { position: i },
        })
      }

      // 3. Atomically synchronize cover photoRef on item (or null if empty)
      const newCover = remaining[0]
      const newPhotoRef = newCover && isUuid(newCover.storageRef) ? newCover.storageRef : null
      await tx.userGearItem.update({
        where: { id: itemId },
        data: { photoRef: newPhotoRef },
      })

      return true
    })
  }

  async reorderPhotos(
    itemId: string,
    userId: string,
    photoOrders: Array<{ photoId: string; position: number }>,
  ): Promise<UserGearItemPhotoDomain[]> {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.userGearItem.findFirst({
        where: { id: itemId, userId },
        include: { photos: { orderBy: { position: 'asc' } } },
      })

      if (!item) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, {
          message: 'Món đồ cá nhân không tồn tại hoặc không thuộc quyền sở hữu của bạn',
        })
      }

      // Check all photoIds belong to this item
      const itemPhotoIds = new Set(item.photos.map((p) => p.id))
      for (const order of photoOrders) {
        if (!itemPhotoIds.has(order.photoId)) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, {
            message: `Ảnh '${order.photoId}' không thuộc món đồ này`,
          })
        }
      }

      // Must cover all photos of the item
      if (photoOrders.length !== item.photos.length) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PHOTO_LIMIT_EXCEEDED, {
          message: 'Thao tác sắp xếp lại ảnh phải bao gồm toàn bộ ảnh hiện có của món đồ',
        })
      }

      // Positions must be exact permutation of 0..N-1
      const positions = photoOrders.map((o) => o.position).sort((a, b) => a - b)
      for (let i = 0; i < item.photos.length; i++) {
        if (positions[i] !== i) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PHOTO_LIMIT_EXCEEDED, {
            message: `Vị trí ảnh phải là hoán vị hợp lệ từ 0 đến ${item.photos.length - 1}`,
          })
        }
      }

      // Phase 1: Assign temporary negative positions to eliminate unique collision risks
      for (let i = 0; i < photoOrders.length; i++) {
        await tx.userGearItemPhoto.update({
          where: { id: photoOrders[i].photoId },
          data: { position: -100 - i },
        })
      }

      // Phase 2: Assign final positions
      for (const order of photoOrders) {
        await tx.userGearItemPhoto.update({
          where: { id: order.photoId },
          data: { position: order.position },
        })
      }

      const updatedPhotos = await tx.userGearItemPhoto.findMany({
        where: { itemId },
        orderBy: { position: 'asc' },
      })

      // Synchronize cover photoRef
      const cover = updatedPhotos.find((p) => p.position === 0)
      const coverRef = cover && isUuid(cover.storageRef) ? cover.storageRef : null
      await tx.userGearItem.update({
        where: { id: itemId },
        data: { photoRef: coverRef },
      })

      return updatedPhotos.map((p) => ({
        id: p.id,
        itemId: p.itemId,
        storageRef: p.storageRef,
        position: p.position,
        createdAt: p.createdAt,
      }))
    })
  }

  private toDomain(record: any): UserGearItemDomain {
    const photos: UserGearItemPhotoDomain[] = Array.isArray(record.photos)
      ? record.photos.map((p: any) => ({
          id: p.id,
          itemId: p.itemId,
          storageRef: p.storageRef,
          position: p.position,
          createdAt: p.createdAt,
        }))
      : []

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
      photos,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }
}
