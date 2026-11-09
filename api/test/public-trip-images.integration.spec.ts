import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import type { PrismaService } from '../src/shared/services/prisma.service'
import { PublicTripImagesService } from '../src/modules/trips/images/public-trip-images.service'
import { PublicTripUseCase } from '../src/modules/trips/application/use-cases/public-trip.use-case'
import { PrismaTripAdapter } from '../src/modules/trips/infrastructure/adapters/prisma-trip.adapter'
import type { MediaStoragePort } from '../src/modules/media/application/ports/media-storage.port'
import { PrismaMediaAssetAdapter } from '../src/modules/media/infrastructure/adapters/prisma-media-asset.adapter'
import { PrismaMediaReferenceAdapter } from '../src/modules/media/infrastructure/adapters/prisma-media-reference.adapter'
import { RequestMediaDeletionUseCase } from '../src/modules/media/application/use-cases/request-media-deletion.use-case'
import { MediaCleanupUseCase } from '../src/modules/media/application/use-cases/media-cleanup.use-case'

// Explicit opt-in. Creates/deletes only uniquely identified fixtures, never resets the DB.
const url = process.env.PUBLIC_TRIP_IMAGES_TEST_DATABASE_URL
const suite = url ? describe : describe.skip
suite('Public trip gallery PostgreSQL transactions and media lifecycle', () => {
  const db = new PrismaClient({ datasourceUrl: url || 'postgresql://unused:unused@localhost:1/unused' })
  const prisma = db as unknown as PrismaService
  const storage = {
    createDeliveryUrl: jest.fn(async (input) => ({ url: `https://cdn.example/${input.variant}/${input.providerPublicId}` })),
    deleteAsset: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<MediaStoragePort>
  const gallery = new PublicTripImagesService(prisma, storage)
  const trips = new PublicTripUseCase(new PrismaTripAdapter(prisma), gallery)
  const media = new PrismaMediaAssetAdapter(prisma)
  const references = new PrismaMediaReferenceAdapter(prisma)
  let actor: { id: string; role: string; status: string }
  let destinationId: string
  let tripId: string
  let mediaIds: string[]
  beforeAll(async () => { await db.$connect() })
  afterAll(async () => { await db.$disconnect() })
  beforeEach(async () => {
    jest.clearAllMocks()
    const user = await db.user.create({ data: { authUserId: randomUUID(), email: `${randomUUID()}@gallery.test`,
      fullName: 'Gallery fixture', role: 'LEADER', status: 'ACTIVE' } })
    actor = { id: user.id, role: user.role, status: user.status }
    destinationId = (await db.destination.create({ data: { name: `Gallery fixture ${randomUUID()}` } })).id
    tripId = (await db.trip.create({ data: { creatorId: actor.id, leaderId: actor.id, destinationId,
      tripType: 'PUBLIC', title: 'Gallery transaction fixture', maxPax: 10,
      startAt: new Date(Date.now() + 7 * 86400000), endAt: new Date(Date.now() + 8 * 86400000) } })).id
    mediaIds = []
    for (let i = 0; i < 2; i++) {
      const id = randomUUID()
      await db.mediaAsset.create({ data: { id, ownerUserId: actor.id, provider: 'CLOUDINARY', scope: 'PUBLIC_TRIP',
        resourceType: 'IMAGE', status: 'READY', providerAssetId: randomUUID(), providerPublicId: `gallery-test/${id}`,
        deliveryType: 'upload', format: 'jpg', mimeType: 'image/jpeg', sizeBytes: 1200, width: 1200, height: 800,
        captureSource: 'GALLERY', readyAt: new Date() } })
      mediaIds.push(id)
    }
  })
  afterEach(async () => {
    // All selectors are tied to this test's UUIDs; no shared/project data is removed.
    if (tripId) await db.trip.deleteMany({ where: { id: tripId } })
    if (actor?.id) await db.mediaAsset.deleteMany({ where: { ownerUserId: actor.id } })
    if (destinationId) await db.destination.deleteMany({ where: { id: destinationId } })
    if (actor?.id) await db.user.deleteMany({ where: { id: actor.id } })
  })
  it('persists order, serves anonymous public detail and returns only cover in lists', async () => {
    const result = await gallery.replace(actor, tripId, { expectedVersion: 1, mediaIds: [...mediaIds].reverse() })
    expect(result.version).toBe(2)
    expect(result.images.map((image) => image.mediaId)).toEqual([...mediaIds].reverse())
    expect(await trips.detail(actor, tripId)).toMatchObject({ images: result.images, imageCount: 2 })
    await expect(trips.publicDetail(tripId)).rejects.toMatchObject({ status: 404 })
    await db.trip.update({ where: { id: tripId }, data: { status: 'OPEN', publishedAt: new Date() } })
    const publicDetail = await trips.publicDetail(tripId)
    expect(publicDetail).toMatchObject({ images: result.images, coverImage: { mediaId: mediaIds[1] } })
    expect(publicDetail).not.toHaveProperty('creatorId')
    expect(publicDetail).not.toHaveProperty('priceExplanation')
    const listed = (await trips.publicList({ page: 1, pageSize: 100 })).find((trip) => trip.id === tripId)!
    expect(listed).toMatchObject({ imageCount: 2, coverImage: { mediaId: mediaIds[1] } })
    expect(listed).not.toHaveProperty('images')
    expect((listed as any).coverImage.url).toContain('CATALOG_CARD')
    expect(storage.deleteAsset).not.toHaveBeenCalled()
  })
  it('rolls back links, retention and version when any selected media is invalid', async () => {
    await gallery.replace(actor, tripId, { expectedVersion: 1, mediaIds: [mediaIds[0]] })
    await db.mediaAsset.update({ where: { id: mediaIds[1] }, data: { status: 'PENDING_UPLOAD' } })
    await expect(gallery.replace(actor, tripId, { expectedVersion: 2, mediaIds: [...mediaIds].reverse() }))
      .rejects.toMatchObject({ code: 'PUBLIC_TRIP_IMAGES_INVALID_MEDIA' })
    expect((await db.trip.findUniqueOrThrow({ where: { id: tripId } })).version).toBe(2)
    expect(await db.publicTripImage.findMany({ where: { tripId } })).toEqual([
      { tripId, mediaAssetId: mediaIds[0], position: 1 },
    ])
    expect((await db.mediaAsset.findUniqueOrThrow({ where: { id: mediaIds[0] } })).retentionUntil).toBeNull()
  })
  it('serializes concurrent editors, then allows reorder/removal and schedules orphan cleanup', async () => {
    const results = await Promise.allSettled([
      gallery.replace(actor, tripId, { expectedVersion: 1, mediaIds }),
      gallery.replace(actor, tripId, { expectedVersion: 1, mediaIds: [...mediaIds].reverse() }),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect((results.find((result) => result.status === 'rejected') as PromiseRejectedResult).reason)
      .toMatchObject({ code: 'PUBLIC_TRIP_IMAGES_VERSION_CONFLICT' })
    await gallery.replace(actor, tripId, { expectedVersion: 2, mediaIds: [mediaIds[1]] })
    expect(await references.hasActiveReferences(mediaIds[1])).toBe(true)
    expect(await references.hasActiveReferences(mediaIds[0])).toBe(false)
    expect((await db.mediaAsset.findUniqueOrThrow({ where: { id: mediaIds[0] } })).retentionUntil!.getTime())
      .toBeGreaterThan(Date.now())
    const empty = await gallery.replace(actor, tripId, { expectedVersion: 3, mediaIds: [] })
    expect(empty).toMatchObject({ version: 4, images: [], coverImage: null, imageCount: 0 })
  })
  it('prevents stale deletion/cleanup reference checks from deleting an image attached concurrently', async () => {
    let entered!: () => void
    const reachedCheck = new Promise<void>((resolve) => { entered = resolve })
    let proceed!: () => void
    const resume = new Promise<void>((resolve) => { proceed = resolve })
    const staleReferences = { hasActiveReferences: async () => { entered(); await resume; return false } }
    const deletion = new RequestMediaDeletionUseCase(media, staleReferences, storage)
    const outcome = deletion.execute({ assetId: mediaIds[0], requesterUser: actor }).catch((error) => error)
    await reachedCheck
    await gallery.replace(actor, tripId, { expectedVersion: 1, mediaIds: [mediaIds[0]] })
    proceed()
    expect(await outcome).toMatchObject({ code: 'MEDIA_INVALID_STATE' })
    expect(storage.deleteAsset).not.toHaveBeenCalled()
    expect((await db.mediaAsset.findUniqueOrThrow({ where: { id: mediaIds[0] } })).status).toBe('READY')
    // DB trigger also protects direct updates that bypass the adapter's atomic predicate.
    await expect(db.mediaAsset.update({ where: { id: mediaIds[0] }, data: { status: 'DELETE_PENDING' } })).rejects.toThrow()
  })
  it('rejects attaching an image after deletion has already claimed it', async () => {
    await media.markDeletePending({ id: mediaIds[0] })
    await expect(gallery.replace(actor, tripId, { expectedVersion: 1, mediaIds: [mediaIds[0]] }))
      .rejects.toMatchObject({ code: 'PUBLIC_TRIP_IMAGES_INVALID_MEDIA' })
    expect(await db.publicTripImage.count({ where: { tripId } })).toBe(0)
  })
  it('cleanup retains referenced media and removes expired gallery orphans through the shared pipeline', async () => {
    await gallery.replace(actor, tripId, { expectedVersion: 1, mediaIds: [mediaIds[0]] })
    await db.mediaAsset.updateMany({ where: { id: { in: mediaIds } }, data: { retentionUntil: new Date(0) } })
    const snapshots = await media.findByIds(mediaIds)
    // Restrict cleanup inputs to our fixtures; never run cleanup over project media.
    const candidates = jest.spyOn(media, 'findDeletePendingAssets').mockResolvedValue(snapshots)
    try {
      await new MediaCleanupUseCase(media, storage, references).execute()
      expect(storage.deleteAsset).toHaveBeenCalledTimes(1)
      expect(storage.deleteAsset).toHaveBeenCalledWith(expect.objectContaining({ providerPublicId: `gallery-test/${mediaIds[1]}` }))
      expect((await db.mediaAsset.findUniqueOrThrow({ where: { id: mediaIds[0] } })).status).toBe('READY')
      expect((await db.mediaAsset.findUniqueOrThrow({ where: { id: mediaIds[0] } })).retentionUntil).toBeNull()
      expect((await db.mediaAsset.findUniqueOrThrow({ where: { id: mediaIds[1] } })).status).toBe('DELETED')
    } finally { candidates.mockRestore() }
  })
})
