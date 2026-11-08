import { Inject, Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../shared/services/prisma.service'
import { AppError, COMMON_ERROR_CODES, PUBLIC_TRIP_IMAGES_ERROR_CODES as E } from '../../../shared/errors'
import envConfig from '../../../shared/config'
import { MEDIA_STORAGE_PORT, type MediaStoragePort } from '../../media/application/ports/media-storage.port'
import type { Actor } from '../application/trip.types'
import { withTripTransaction } from '../infrastructure/adapters/prisma-trip.adapter'
import { publicTripImagesSchema, type PublicTripImagesInput } from './public-trip-images.dto'

const editable = ['DRAFT', 'OPEN', 'FULL', 'CLOSED']

@Injectable()
export class PublicTripImagesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MEDIA_STORAGE_PORT) private readonly storage: MediaStoragePort,
  ) {}

  async replace(actor: Actor, tripId: string, input: PublicTripImagesInput) {
    if (actor.role !== 'LEADER' || actor.status !== 'ACTIVE')
      throw new AppError({ code: COMMON_ERROR_CODES.FORBIDDEN })
    // Also protect callers outside HTTP; the controller uses ZodValidationPipe.
    const parsed = publicTripImagesSchema.safeParse(input)
    if (!parsed.success) throw new AppError({ code: COMMON_ERROR_CODES.VALIDATION_ERROR })
    const { expectedVersion, mediaIds } = parsed.data
    return withTripTransaction(this.prisma, actor.id, tripId, async (tx) => {
      const currentActor = await tx.user.findUnique({ where: { id: actor.id } })
      if (currentActor?.role !== 'LEADER' || currentActor.status !== 'ACTIVE')
        throw new AppError({ code: COMMON_ERROR_CODES.FORBIDDEN })
      const trip = await tx.trip.findUnique({ where: { id: tripId } })
      if (!trip || trip.tripType !== 'PUBLIC') throw new AppError({ code: E.NOT_FOUND })
      if (trip.creatorId !== actor.id || trip.leaderId !== actor.id)
        throw new AppError({ code: COMMON_ERROR_CODES.FORBIDDEN })
      if (!editable.includes(trip.status)) throw new AppError({ code: E.LOCKED })
      if (trip.version !== expectedVersion) throw new AppError({ code: E.VERSION_CONFLICT })

      const previous = await tx.publicTripImage.findMany({ where: { tripId } })
      const lockIds = [...new Set([...mediaIds, ...previous.map((row) => row.mediaAssetId)])].sort()
      if (lockIds.length) {
        await tx.$queryRaw(Prisma.sql`SELECT id FROM media_assets
          WHERE id IN (${Prisma.join(lockIds.map((id) => Prisma.sql`${id}::uuid`))})
          ORDER BY id FOR UPDATE`)
      }
      const assets = await tx.mediaAsset.findMany({ where: { id: { in: mediaIds } } })
      const valid = assets.length === mediaIds.length && assets.every((asset) =>
        asset.ownerUserId === actor.id && asset.scope === 'PUBLIC_TRIP' && asset.resourceType === 'IMAGE' &&
        asset.status === 'READY' && asset.provider === 'CLOUDINARY' && asset.deliveryType === 'upload' &&
        !!asset.providerAssetId && !!asset.providerPublicId && !!asset.readyAt &&
        ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(asset.format ?? '') &&
        (asset.sizeBytes ?? 0) > 0 && (asset.sizeBytes ?? 0) <= envConfig.MEDIA_MAX_IMAGE_BYTES &&
        (asset.width ?? 0) >= envConfig.MEDIA_IMAGE_MIN_WIDTH &&
        (asset.height ?? 0) >= envConfig.MEDIA_IMAGE_MIN_HEIGHT &&
        (asset.width ?? Infinity) <= envConfig.MEDIA_IMAGE_MAX_WIDTH &&
        (asset.height ?? Infinity) <= envConfig.MEDIA_IMAGE_MAX_HEIGHT)
      if (!valid) throw new AppError({ code: E.INVALID_MEDIA })

      await tx.publicTripImage.deleteMany({ where: { tripId } })
      if (mediaIds.length) {
        await tx.publicTripImage.createMany({
          data: mediaIds.map((mediaAssetId, index) => ({ tripId, mediaAssetId, position: index + 1 })),
        })
        await tx.mediaAsset.updateMany({
          where: { id: { in: mediaIds } }, data: { retentionUntil: null },
        })
      }
      const removed = previous.map((row) => row.mediaAssetId).filter((id) => !mediaIds.includes(id))
      if (removed.length) await tx.mediaAsset.updateMany({
        where: { id: { in: removed }, publicTripImages: { none: {} } },
        data: { retentionUntil: new Date(Date.now() + envConfig.MEDIA_CATALOG_ORPHAN_RETENTION_DAYS * 86400000) },
      })
      const updated = await tx.trip.update({ where: { id: tripId }, data: { version: { increment: 1 } } })
      const [gallery] = await this.decorateWith(tx, [{ id: tripId }], false)
      return { tripId, version: updated.version, images: gallery.images!,
        coverImage: gallery.coverImage, imageCount: gallery.imageCount }
    })
  }

  decorate<T extends { id: string }>(trips: T[], summary: boolean) {
    return this.decorateWith(this.prisma, trips, summary)
  }

  private async decorateWith<T extends { id: string }>(db: Prisma.TransactionClient, trips: T[], summary: boolean) {
    if (!trips.length) return []
    const rows = await db.trip.findMany({
      where: { id: { in: trips.map((trip) => trip.id) }, tripType: 'PUBLIC' },
      select: {
        id: true,
        _count: { select: { publicTripImages: true } },
        publicTripImages: {
          orderBy: { position: 'asc' }, take: summary ? 1 : 10,
          select: { mediaAssetId: true, position: true, mediaAsset: {
            select: { providerPublicId: true, width: true, height: true },
          } },
        },
      },
    })
    const byId = new Map(await Promise.all(rows.map(async (row) => {
      const images = await Promise.all(row.publicTripImages.map(async (image) => {
        const delivery = await this.storage.createDeliveryUrl({
          providerPublicId: image.mediaAsset.providerPublicId!, resourceType: 'IMAGE', deliveryType: 'upload',
          variant: summary ? 'CATALOG_CARD' : 'CATALOG_DETAIL',
        })
        return { mediaId: image.mediaAssetId, position: image.position, url: delivery.url,
          width: image.mediaAsset.width!, height: image.mediaAsset.height! }
      }))
      return [row.id, { images, coverImage: images[0] ?? null, imageCount: row._count.publicTripImages }] as const
    })))
    return trips.map((trip) => {
      const gallery = byId.get(trip.id) ?? { images: [], coverImage: null, imageCount: 0 }
      return { ...trip, ...(summary ? {} : { images: gallery.images }),
        coverImage: gallery.coverImage, imageCount: gallery.imageCount }
    })
  }
}
