import { randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { PublicTripImagesService } from './public-trip-images.service'
import { PublicTripImagesController } from './public-trip-images.controller'
import { PrismaService } from '../../../shared/services/prisma.service'
import { GlobalErrorFilter } from '../../../shared/errors'
import { MEDIA_STORAGE_PORT } from '../../media/application/ports/media-storage.port'

describe('Public trip gallery HTTP and business rules', () => {
  let app: INestApplication
  let service: PublicTripImagesService
  const actor = { id: randomUUID(), role: 'LEADER', status: 'ACTIVE' }
  const tripId = randomUUID()
  const ids = [randomUUID(), randomUUID()]
  const media = (id: string) => ({ id, ownerUserId: actor.id, scope: 'PUBLIC_TRIP', resourceType: 'IMAGE',
    status: 'READY', provider: 'CLOUDINARY', deliveryType: 'upload', providerAssetId: `asset-${id}`,
    providerPublicId: `trekgo/public-trip/${id}`, format: 'jpg', width: 1200, height: 800,
    sizeBytes: 1000, readyAt: new Date() })
  let trip: any
  let assets: any[]
  let links: any[]
  let currentActor: any
  const storage = { createDeliveryUrl: jest.fn(async (input) => ({ url: `https://cdn.example/${input.variant}/${input.providerPublicId}` })) }
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    user: { findUnique: jest.fn(async () => currentActor) },
    trip: {
      findUnique: jest.fn(async () => trip),
      update: jest.fn(async () => ({ ...trip, version: ++trip.version })),
      findMany: jest.fn(async (query) => query.where.id.in.map((id: string) => ({ id,
        _count: { publicTripImages: links.filter((link) => link.tripId === id).length },
        publicTripImages: links.filter((link) => link.tripId === id).slice(0, query.select.publicTripImages.take)
          .map((link) => ({ ...link, mediaAsset: media(link.mediaAssetId) })),
      }))),
    },
    mediaAsset: { findMany: jest.fn(async () => assets), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    publicTripImage: {
      findMany: jest.fn(async () => [...links]),
      deleteMany: jest.fn(async () => { links = []; return { count: 1 } }),
      createMany: jest.fn(async ({ data }) => { links = data; return { count: data.length } }),
    },
  }
  const prisma = { ...tx, $transaction: jest.fn(async (work) => work(tx)) }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PublicTripImagesController],
      providers: [PublicTripImagesService, { provide: PrismaService, useValue: prisma },
        { provide: MEDIA_STORAGE_PORT, useValue: storage }],
    }).compile()
    service = module.get(PublicTripImagesService)
    app = module.createNestApplication()
    app.setGlobalPrefix('api/v1')
    app.useGlobalFilters(new GlobalErrorFilter())
    app.use((req: any, _res: unknown, next: () => void) => { req.user = actor; next() })
    await app.init()
  })
  afterAll(async () => { await app?.close() })
  beforeEach(() => {
    jest.clearAllMocks()
    currentActor = { ...actor }
    trip = { id: tripId, tripType: 'PUBLIC', creatorId: actor.id, leaderId: actor.id, version: 3, status: 'DRAFT' }
    assets = ids.map(media)
    links = []
  })
  const put = (body: unknown, id = tripId) => request(app.getHttpServer())
    .put(`/api/v1/leader/public-trips/${id}/images`).set('x-request-id', 'gallery-test').send(body)

  it('saves requested order, makes first image the cover and returns the new version', async () => {
    const response = await put({ expectedVersion: 3, mediaIds: [...ids].reverse() }).expect(200)
    expect(response.body).toMatchObject({ tripId, version: 4, imageCount: 2,
      coverImage: { mediaId: ids[1], position: 1, width: 1200, height: 800 } })
    expect(response.body.images.map((image: any) => image.mediaId)).toEqual([...ids].reverse())
    expect(storage.createDeliveryUrl).toHaveBeenCalledWith(expect.objectContaining({ variant: 'CATALOG_DETAIL' }))
  })
  it('removes all images and schedules only unreferenced media for cleanup', async () => {
    links = [{ tripId, mediaAssetId: ids[0], position: 1 }]
    assets = []
    const response = await put({ expectedVersion: 3, mediaIds: [] }).expect(200)
    expect(response.body).toMatchObject({ version: 4, images: [], coverImage: null, imageCount: 0 })
    expect(tx.mediaAsset.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: [ids[0]] }, publicTripImages: { none: {} } },
      data: { retentionUntil: expect.any(Date) },
    }))
  })
  it.each(['DRAFT', 'OPEN', 'FULL', 'CLOSED'])('allows gallery editing in %s', async (status) => {
    trip.status = status
    await put({ expectedVersion: 3, mediaIds: ids }).expect(200)
  })
  it.each(['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'CANCEL_PENDING', 'INTERRUPTED'])('locks gallery in %s', async (status) => {
    trip.status = status
    const response = await put({ expectedVersion: 3, mediaIds: ids }).expect(409)
    expect(response.body.error.code).toBe('PUBLIC_TRIP_IMAGES_LOCKED')
    expect(tx.publicTripImage.deleteMany).not.toHaveBeenCalled()
  })
  it.each([
    { ownerUserId: randomUUID() }, { scope: 'USER_GEAR' }, { resourceType: 'VIDEO' },
    { status: 'PENDING_UPLOAD' }, { status: 'DELETE_PENDING' }, { providerPublicId: null },
    { providerAssetId: null }, { width: null }, { format: 'pdf' }, { sizeBytes: 0 }, { deliveryType: 'authenticated' },
  ])('rejects invalid media before altering any link: %j', async (patch) => {
    assets[1] = { ...assets[1], ...patch }
    const response = await put({ expectedVersion: 3, mediaIds: ids }).expect(422)
    expect(response.body.error).toMatchObject({ code: 'PUBLIC_TRIP_IMAGES_INVALID_MEDIA', retryable: false })
    expect(tx.publicTripImage.deleteMany).not.toHaveBeenCalled()
    expect(tx.trip.update).not.toHaveBeenCalled()
  })
  it('rejects missing media without partial writes', async () => {
    assets = assets.slice(0, 1)
    await put({ expectedVersion: 3, mediaIds: ids }).expect(422)
    expect(tx.publicTripImage.deleteMany).not.toHaveBeenCalled()
  })
  it('uses the global error envelope for stale versions, with request metadata', async () => {
    const response = await put({ expectedVersion: 2, mediaIds: ids }).expect(409)
    expect(response.body).toMatchObject({ error: { code: 'PUBLIC_TRIP_IMAGES_VERSION_CONFLICT', retryable: false },
      meta: { requestId: 'gallery-test', contractVersion: '0.2.0-final-flow', serverTime: expect.any(String) } })
    expect(response.body).not.toHaveProperty('code')
    expect(tx.publicTripImage.deleteMany).not.toHaveBeenCalled()
  })
  it.each([
    { expectedVersion: 3, mediaIds: [ids[0], ids[0]] },
    { expectedVersion: 3, mediaIds: [ids[0], ids[0].toUpperCase()] },
    { expectedVersion: 3, mediaIds: Array.from({ length: 11 }, () => randomUUID()) },
    { expectedVersion: 0, mediaIds: [] }, { expectedVersion: 3, mediaIds: ['https://example.com/a.jpg'] },
    { expectedVersion: 3, mediaIds: [], extra: true },
  ])('validates invalid gallery payloads using shared validation: %j', async (body) => {
    const response = await put(body).expect(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
    expect(response.body.error.details).toBeTruthy()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
  it('validates the trip UUID and accepts exactly ten images', async () => {
    await put({ expectedVersion: 3, mediaIds: [] }, 'invalid-id').expect(400)
    assets = Array.from({ length: 10 }, () => media(randomUUID()))
    const response = await put({ expectedVersion: 3, mediaIds: assets.map((asset) => asset.id) }).expect(200)
    expect(response.body.images).toHaveLength(10)
  })
  it('rejects nonowners, private trips, missing trips and demoted leaders', async () => {
    trip.creatorId = randomUUID()
    await put({ expectedVersion: 3, mediaIds: ids }).expect(403)
    trip.creatorId = actor.id
    trip.tripType = 'PRIVATE'
    await put({ expectedVersion: 3, mediaIds: ids }).expect(404)
    trip = null
    await put({ expectedVersion: 3, mediaIds: ids }).expect(404)
    currentActor.status = 'SUSPENDED'
    await put({ expectedVersion: 3, mediaIds: ids }).expect(403)
    await expect(service.replace({ ...actor, role: 'USER' }, tripId, { expectedVersion: 3, mediaIds: [] }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  it('batches gallery reads, emits only the cover for lists and defaults old trips to an empty gallery', async () => {
    links = ids.map((mediaAssetId, i) => ({ tripId, mediaAssetId, position: i + 1 }))
    const result = await service.decorate([{ id: tripId }, { id: randomUUID() }], true)
    expect(tx.trip.findMany).toHaveBeenCalledTimes(1)
    expect(result[0]).toMatchObject({ imageCount: 2, coverImage: { mediaId: ids[0] } })
    expect(result[0]).not.toHaveProperty('images')
    expect(storage.createDeliveryUrl).toHaveBeenCalledTimes(1)
    expect(storage.createDeliveryUrl).toHaveBeenCalledWith(expect.objectContaining({ variant: 'CATALOG_CARD' }))
    const [empty] = await service.decorate([{ id: randomUUID() }], false)
    expect(empty).toMatchObject({ images: [], coverImage: null })
  })
  it('documents the write contract and typed success response', () => {
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Gallery').build())
    const op = doc.paths['/api/v1/leader/public-trips/{id}/images'].put!
    expect(op.requestBody).toBeDefined()
    expect((op.responses['200'] as any).content['application/json'].schema.properties.images).toBeDefined()
  })
})
