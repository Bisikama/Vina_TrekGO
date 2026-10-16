import { randomUUID } from 'crypto'
import { PrismaClient, User } from '@prisma/client'
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import request from 'supertest'
import { SharedModule } from '../src/shared/shared.module'
import { PrismaService } from '../src/shared/services/prisma.service'
import { SupabaseService } from '../src/shared/services/supabase.service'
import { GlobalErrorFilter } from '../src/shared/errors'
import { LeaderApplicationsModule } from '../src/modules/leader-applications/leader-applications.module'
import { LeaderApplicationsService } from '../src/modules/leader-applications/application/leader-applications.service'
import { MEDIA_STORAGE_PORT } from '../src/modules/media/application/ports/media-storage.port'
import { GetMediaDeliveryUseCase } from '../src/modules/media/application/use-cases/get-media-delivery.use-case'
import { PrivateTripUseCase } from '../src/modules/trips/application/use-cases/private-trip.use-case'
import { PrismaPrivateTripAdapter } from '../src/modules/trips/infrastructure/adapters/prisma-private-trip.adapter'
import { PublicTripUseCase } from '../src/modules/trips/application/use-cases/public-trip.use-case'
import { PrismaTripAdapter } from '../src/modules/trips/infrastructure/adapters/prisma-trip.adapter'
import {
  encodeCertificateType,
  decodeCertificateType,
} from '../src/modules/leader-applications/domain/certificate-types'
import { submitSchema } from '../src/modules/leader-applications/presentation/leader.schemas'
import env from '../src/shared/config'
import { MediaPolicyService } from '../src/modules/media/application/policies/media.policy'
import { CreateUploadIntentUseCase } from '../src/modules/media/application/use-cases/create-upload-intent.use-case'
import { CompleteUploadUseCase } from '../src/modules/media/application/use-cases/complete-upload.use-case'
import { PrismaMediaAssetAdapter } from '../src/modules/media/infrastructure/adapters/prisma-media-asset.adapter'
import { CloudinaryStorageAdapter } from '../src/modules/media/infrastructure/adapters/cloudinary-storage.adapter'
import { v2 as cloudinary } from 'cloudinary'

describe('SF01 DTO and type registry', () => {
  it('validates provider-detected PDF format and private delivery rather than trusting declared MIME', () => {
    const policy = new MediaPolicyService()
    const metadata = { format: 'pdf', bytes: 1024, resourceType: 'IMAGE', deliveryType: 'authenticated' } as any
    expect(() => policy.validateProviderMetadata('LEADER_CERTIFICATE', 'IMAGE', metadata)).not.toThrow()
    for (const invalid of [{ format: 'svg' }, { format: 'html' }, { deliveryType: 'upload' }, { bytes: 0 }])
      expect(() =>
        policy.validateProviderMetadata('LEADER_CERTIFICATE', 'IMAGE', { ...metadata, ...invalid }),
      ).toThrow()
  })
  it('round-trips OTHER and rejects impossible dates, reversed dates and client ownership', () => {
    expect(decodeCertificateType(encodeCertificateType('OTHER', '  Sơ cứu nâng cao  '))).toEqual({
      typeCode: 'OTHER',
      otherTypeName: 'Sơ cứu nâng cao',
    })
    const certificate = { typeCode: 'FIRST_AID', fileKey: randomUUID() }
    expect(submitSchema.safeParse({ certificates: [{ ...certificate, issuedAt: '2026-02-30' }] }).success).toBe(false)
    expect(
      submitSchema.safeParse({ certificates: [{ ...certificate, issuedAt: '2027-01-01', expiresAt: '2026-01-01' }] })
        .success,
    ).toBe(false)
    expect(submitSchema.safeParse({ userId: randomUUID(), certificates: [certificate] }).success).toBe(false)
  })
})

const url = process.env.SF01_TEST_DATABASE_URL
if (url) {
  const u = new URL(url)
  if (!['localhost', '127.0.0.1'].includes(u.hostname) || !u.pathname.startsWith('/sf01_test'))
    throw new Error('SF01 requires isolated localhost sf01_test database')
}
const suite = url ? describe : describe.skip
suite('SF01 HTTP, real PostgreSQL transactions and promotion', () => {
  const db = new PrismaClient({ datasourceUrl: url || 'postgresql://postgres@localhost:1/sf01_test' })
  let app: INestApplication, service: LeaderApplicationsService, admin: User, admin2: User, owner: User, other: User
  const storage = {
    createDeliveryUrl: jest.fn().mockResolvedValue({
      url: 'https://example.invalid/private-download',
      expiresAt: new Date(Date.now() + 300000),
    }),
  }
  const auth = (u: User) => `Bearer ${u.authUserId}`
  const fixtureUser = (role: 'USER' | 'ADMIN' | 'LEADER' = 'USER') =>
    db.user.create({
      data: { role, authUserId: randomUUID(), fullName: 'SF01 Fixture', email: `${randomUUID()}@sf01.test` },
    })
  const file = (u = owner, status: 'READY' | 'PENDING_UPLOAD' = 'READY') =>
    db.mediaAsset.create({
      data: {
        ownerUserId: u.id,
        provider: 'CLOUDINARY',
        scope: 'LEADER_CERTIFICATE',
        resourceType: 'IMAGE',
        status,
        deliveryType: 'authenticated',
        format: 'pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1000,
        providerAssetId: randomUUID(),
        providerPublicId: `trekgo/leader-certificate/${randomUUID()}`,
      },
    })
  const submit = async (u = owner, certificates?: object[]) => {
    const cs = certificates || [{ typeCode: 'FIRST_AID', fileKey: (await file(u)).id }]
    return request(app.getHttpServer())
      .post('/api/v1/leader-applications')
      .set('Authorization', auth(u))
      .send({ certificates: cs })
  }
  const approveInput = async (id: string) => ({
    decision: 'APPROVED' as const,
    certificateReviews: (await db.leaderCertificate.findMany({ where: { applicationId: id } })).map((c) => ({
      certificateId: c.id,
      status: 'VERIFIED' as const,
    })),
  })
  const review = (id: string, body: object, u = admin) =>
    request(app.getHttpServer())
      .patch(`/api/v1/admin/leader-applications/${id}/review`)
      .set('Authorization', auth(u))
      .set('x-request-id', 'sf01-test')
      .send(body)

  beforeAll(async () => {
    env.MEDIA_ENABLED = true
    const m = await Test.createTestingModule({ imports: [SharedModule, LeaderApplicationsModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .overrideProvider(SupabaseService)
      .useValue({
        verifyToken: async (token: string) => {
          const u = await db.user.findUnique({ where: { authUserId: token } })
          return u ? { id: u.authUserId, email: u.email } : null
        },
      })
      .overrideProvider(MEDIA_STORAGE_PORT)
      .useValue(storage)
      .compile()
    app = m.createNestApplication()
    app.setGlobalPrefix('api/v1')
    app.useGlobalFilters(new GlobalErrorFilter())
    await app.init()
    service = m.get(LeaderApplicationsService)
    admin = await fixtureUser('ADMIN')
    admin2 = await fixtureUser('ADMIN')
    other = await fixtureUser()
  })
  beforeEach(async () => {
    owner = await fixtureUser()
    storage.createDeliveryUrl.mockClear()
  })
  afterAll(async () => {
    await app?.close()
    await db.$disconnect()
  })

  const liveStorageTest = process.env.SF01_LIVE_STORAGE_TEST === '1' ? it : it.skip
  liveStorageTest(
    'live Cloudinary private PDF upload, canonical complete, owner delivery, expiry and unsigned denial',
    async () => {
      const provider = new CloudinaryStorageAdapter()
      provider.onModuleInit()
      const assets = new PrismaMediaAssetAdapter(db as unknown as PrismaService)
      const policy = new MediaPolicyService()
      const create = new CreateUploadIntentUseCase(assets, provider, policy)
      const complete = new CompleteUploadUseCase(assets, provider, {} as any, policy)
      const deliver = new GetMediaDeliveryUseCase(assets, provider, policy)
      // Synthetic PDF only; no personal data or user-provided certificates.
      const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 400] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      ]
      const stream = 'BT /F1 16 Tf 30 200 Td (SF01 synthetic storage test) Tj ET'
      objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
      let pdf = '%PDF-1.4\n'
      const offsets = [0]
      objects.forEach((obj, i) => {
        offsets.push(Buffer.byteLength(pdf))
        pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`
      })
      const xref = Buffer.byteLength(pdf)
      pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
        .slice(1)
        .map((n) => `${n.toString().padStart(10, '0')} 00000 n \n`)
        .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
      const intent = await create.execute(
        {
          scope: 'LEADER_CERTIFICATE',
          resourceType: 'IMAGE',
          fileName: 'synthetic.pdf',
          contentType: 'application/pdf',
          sizeBytes: Buffer.byteLength(pdf),
        },
        owner,
      )
      try {
        const form = new FormData()
        for (const [key, value] of Object.entries(intent.upload.formFields)) form.append(key, String(value))
        form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'synthetic.pdf')
        const upload = await fetch(intent.upload.uploadUrl, {
          method: 'POST',
          body: form,
          signal: AbortSignal.timeout(20000),
        })
        expect(upload.status).toBe(200)
        const uploaded = (await upload.json())
        const ready = await complete.execute(
          intent.mediaId,
          { publicId: uploaded.public_id, version: uploaded.version, signature: uploaded.signature },
          owner,
        )
        expect(ready.status).toBe('READY')
        expect(ready.format).toBe('pdf')
        const download = await deliver.execute({ mediaId: ready.id, variant: 'DOCUMENT_ORIGINAL' }, owner)
        expect(download.expiresAt).toBeTruthy()
        const response = await fetch(download.url, { signal: AbortSignal.timeout(20000) })
        expect(response.status).toBe(200)
        expect(
          Buffer.from(await response.arrayBuffer())
            .subarray(0, 5)
            .toString(),
        ).toBe('%PDF-')
        const expired = cloudinary.utils.private_download_url(uploaded.public_id, 'pdf', {
          resource_type: 'image',
          type: 'authenticated',
          expires_at: Math.floor(Date.now() / 1000) - 60,
        })
        expect((await fetch(expired, { signal: AbortSignal.timeout(20000) })).status).toBeGreaterThanOrEqual(400)
        const unsigned = cloudinary.url(uploaded.public_id, {
          resource_type: 'image',
          type: 'authenticated',
          format: 'pdf',
          secure: true,
          sign_url: false,
        })
        expect((await fetch(unsigned, { signal: AbortSignal.timeout(20000) })).status).toBeGreaterThanOrEqual(400)
      } finally {
        await provider.deleteAsset({
          providerPublicId: intent.upload.formFields.public_id,
          resourceType: 'IMAGE',
          deliveryType: 'authenticated',
          invalidate: true,
        })
        await db.mediaAsset.update({ where: { id: intent.mediaId }, data: { status: 'DELETED' } })
      }
    },
    90000,
  )

  it('documents all six operations with schemas, bearer security and paging', () => {
    const spec = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('SF01').addBearerAuth().build())
    const paths = Object.entries(spec.paths).filter(([p]) => p.includes('leader-'))
    expect(paths).toHaveLength(6)
    for (const [, item] of paths)
      for (const op of Object.values(item)) {
        expect(op.security).toContainEqual({ bearer: [] })
        expect(op.responses).toBeTruthy()
      }
    expect(spec.paths['/api/v1/leader-applications'].post!.requestBody).toBeTruthy()
  })

  it('submits certificates atomically, protects ownership, returns only own history and admin filtered list', async () => {
    const f = await file()
    const result = await submit(owner, [{ typeCode: 'OTHER', otherTypeName: 'Safety training', fileKey: f.id }])
    expect(result.status).toBe(201)
    expect(result.body).toMatchObject({ status: 'SUBMITTED', certificateCount: 1 })
    const cert = await db.leaderCertificate.findFirstOrThrow({ where: { applicationId: result.body.id } })
    expect(cert).toMatchObject({
      userId: owner.id,
      status: 'PENDING',
      certificateType: 'OTHER:Safety training',
      fileUrl: `media:${f.id}`,
    })
    const mine = await request(app.getHttpServer())
      .get('/api/v1/leader-applications/me')
      .set('Authorization', auth(owner))
      .expect(200)
    expect(mine.body.total).toBe(1)
    expect(mine.body.items[0].certificates[0].otherTypeName).toBe('Safety training')
    const others = await request(app.getHttpServer())
      .get('/api/v1/leader-applications/me')
      .set('Authorization', auth(other))
      .expect(200)
    expect(others.body.items).toEqual([])
    await request(app.getHttpServer())
      .get(`/api/v1/admin/leader-applications/${result.body.id}`)
      .set('Authorization', auth(other))
      .expect(403)
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/admin/leader-applications/${result.body.id}`)
      .set('Authorization', auth(admin))
      .expect(200)
    expect(detail.body.certificates[0].downloadExpiresAt).toBeTruthy()
    expect(JSON.stringify(detail.body)).not.toContain('fileUrl')
    storage.createDeliveryUrl.mockClear()
    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/leader-applications')
      .query({ search: owner.email, status: 'SUBMITTED' })
      .set('Authorization', auth(admin))
      .expect(200)
    expect(list.body.total).toBe(1)
    expect(storage.createDeliveryUrl).not.toHaveBeenCalled()
    const blocked = await request(app.getHttpServer())
      .get(`/api/v1/media/${f.id}/delivery?variant=DOCUMENT_ORIGINAL`)
      .set('Authorization', auth(other))
    expect(blocked.status).toBe(404)
    await request(app.getHttpServer())
      .get(`/api/v1/media/${f.id}/delivery?variant=DOCUMENT_ORIGINAL`)
      .set('Authorization', auth(owner))
      .expect(200)
    await expect(db.mediaAsset.update({ where: { id: f.id }, data: { status: 'DELETE_PENDING' } })).rejects.toThrow()
  })

  it('rejects missing certificates, invalid type, forged metadata, pending and foreign files without orphan rows', async () => {
    expect((await submit(owner, [])).body.error.code).toBe('CERTIFICATE_REQUIRED')
    const ready = await file(),
      pending = await file(owner, 'PENDING_UPLOAD'),
      foreign = await file(other)
    for (const c of [
      { typeCode: 'BAD', fileKey: ready.id },
      { typeCode: 'OTHER', fileKey: ready.id },
      { typeCode: 'FIRST_AID', fileKey: pending.id },
      { typeCode: 'FIRST_AID', fileKey: foreign.id },
    ])
      expect((await submit(owner, [c])).status).toBe(422)
    expect((await submit(owner, [{ typeCode: 'FIRST_AID', fileKey: ready.id, verifiedBy: admin.id }])).status).toBe(400)
    expect(await db.leaderApplication.count({ where: { userId: owner.id } })).toBe(0)
    expect(await db.leaderCertificate.count({ where: { userId: owner.id } })).toBe(0)
  })

  it('concurrent submissions produce exactly one open application and a shared 409 error envelope', async () => {
    const f = await file(),
      body = [{ typeCode: 'FIRST_AID', fileKey: f.id }]
    const results = await Promise.all([submit(owner, body), submit(owner, body)])
    expect(results.map((r) => r.status).sort()).toEqual([201, 409])
    const failure = results.find((r) => r.status === 409)!.body
    expect(failure.error).toMatchObject({ code: 'APPLICATION_ALREADY_PENDING', retryable: false })
    expect(failure.meta).toMatchObject({
      requestId: expect.any(String),
      serverTime: expect.any(String),
      contractVersion: expect.any(String),
    })
    await expect(
      db.leaderApplication.create({ data: { userId: owner.id, status: 'UNDER_REVIEW' } }),
    ).rejects.toMatchObject({ code: 'P2002' })
  })

  it('approves mixed certificate decisions, promotes atomically and preserves same-token access to history', async () => {
    const a = await file(),
      b = await file()
    const r = await submit(
      owner,
      [a, b].map((f) => ({ typeCode: 'FIRST_AID', fileKey: f.id })),
    )
    const body = await approveInput(r.body.id)
    const input = {
      decision: 'APPROVED',
      certificateReviews: [
        body.certificateReviews[0],
        { ...body.certificateReviews[1], status: 'REJECTED', rejectionReason: 'Unreadable' },
      ],
    }
    expect((await review(r.body.id, input)).body.userRole).toBe('LEADER')
    expect((await db.user.findUniqueOrThrow({ where: { id: owner.id } })).role).toBe('LEADER')
    expect(await db.leaderProfile.findUnique({ where: { userId: owner.id } })).toMatchObject({
      verifyStatus: 'APPROVED',
      verifiedBy: admin.id,
    })
    const audit = await db.auditLog.findMany({ where: { entityId: { in: [r.body.id, owner.id] } } })
    expect(audit.map((a) => a.action).sort()).toEqual(['LEADER_APPLICATION_APPROVED', 'USER_ROLE_CHANGED'])
    expect(audit.every((a) => a.requestId === 'sf01-test')).toBe(true)
    expect(JSON.stringify(audit.map((a) => ({ oldValues: a.oldValues, newValues: a.newValues })))).not.toContain(
      'fileUrl',
    )
    await request(app.getHttpServer())
      .get('/api/v1/leader-applications/me')
      .set('Authorization', auth(owner))
      .expect(200)
    expect((await submit(owner)).body.error.code).toBe('LEADER_CANNOT_APPLY')
    expect((await review(r.body.id, input)).status).toBe(409)
  })

  it('rolls back incomplete, duplicate, foreign, expired and all-rejected approval decisions', async () => {
    const r = await submit(owner, [{ typeCode: 'FIRST_AID', fileKey: (await file()).id, expiresAt: '2000-01-01' }])
    const input = await approveInput(r.body.id)
    for (const certificateReviews of [
      [],
      [...input.certificateReviews, ...input.certificateReviews],
      [{ certificateId: randomUUID(), status: 'VERIFIED' }],
      input.certificateReviews.map((c) => ({ ...c, status: 'REJECTED', rejectionReason: 'Invalid' })),
      input.certificateReviews,
    ]) {
      expect((await review(r.body.id, { decision: 'APPROVED', certificateReviews })).status).toBe(422)
    }
    expect(await db.leaderApplication.findUnique({ where: { id: r.body.id } })).toMatchObject({ status: 'SUBMITTED' })
    expect(await db.leaderCertificate.findFirst({ where: { applicationId: r.body.id } })).toMatchObject({
      status: 'PENDING',
    })
    expect(await db.leaderProfile.findUnique({ where: { userId: owner.id } })).toBeNull()
  })

  it('requires rejection reason, preserves rejected history and permits a fresh application', async () => {
    const r = await submit()
    expect((await review(r.body.id, { decision: 'REJECTED' })).body.error.code).toBe('REJECTION_REASON_REQUIRED')
    expect(
      (await review(r.body.id, { decision: 'REJECTED', rejectionReason: 'Please supply a readable document' })).status,
    ).toBe(200)
    expect((await db.user.findUniqueOrThrow({ where: { id: owner.id } })).role).toBe('USER')
    const cert = await db.leaderCertificate.findFirstOrThrow({ where: { applicationId: r.body.id } })
    expect(cert.status).toBe('PENDING')
    expect((await submit(owner, [{ typeCode: 'FIRST_AID', fileKey: cert.mediaAssetId }])).status).toBe(422)
    expect((await submit()).status).toBe(201)
    expect(await db.leaderApplication.count({ where: { userId: owner.id } })).toBe(2)
  })

  it('requires every pending certificate review and accepts a certificate expiring on the review day', async () => {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
    const r = await submit(owner, [
      { typeCode: 'FIRST_AID', fileKey: (await file()).id, expiresAt: today },
      { typeCode: 'RESCUE', fileKey: (await file()).id },
    ])
    const input = await approveInput(r.body.id)
    expect(
      (await review(r.body.id, { ...input, certificateReviews: input.certificateReviews.slice(0, 1) })).status,
    ).toBe(422)
    expect((await review(r.body.id, input)).status).toBe(200)
    expect((await review(randomUUID(), input)).body.error.code).toBe('APPLICATION_NOT_FOUND')
  })

  it('preserves certificate evidence if a delete was queued while submission held the media row lock', async () => {
    const f = await file()
    let release!: () => void, locked!: () => void
    const go = new Promise<void>((r) => {
        release = r
      }),
      acquired = new Promise<void>((r) => {
        locked = r
      })
    const submission = db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM media_assets WHERE id = ${f.id}::uuid FOR UPDATE`
      locked()
      await go
      const a = await tx.leaderApplication.create({ data: { userId: owner.id, status: 'SUBMITTED' } })
      await tx.leaderCertificate.create({
        data: {
          userId: owner.id,
          applicationId: a.id,
          certificateType: 'FIRST_AID',
          fileUrl: `media:${f.id}`,
          mediaAssetId: f.id,
        },
      })
    })
    await acquired
    // Attach the handler immediately, so an expected DB error cannot be unhandled.
    const deletion = db.mediaAsset.update({ where: { id: f.id }, data: { status: 'DELETE_PENDING' } }).then(
      () => 'deleted',
      () => 'retained',
    )
    release()
    await submission
    expect(await deletion).toBe('retained')
    expect((await db.mediaAsset.findUniqueOrThrow({ where: { id: f.id } })).status).toBe('READY')
  })

  it('two admin reviews have one winner, one conflict and only one role-change audit', async () => {
    const r = await submit(),
      input = await approveInput(r.body.id)
    const results = await Promise.all([review(r.body.id, input), review(r.body.id, input, admin2)])
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
    expect(await db.auditLog.count({ where: { entityId: owner.id, action: 'USER_ROLE_CHANGED' } })).toBe(1)
  })

  it('a database failure after promotion rolls back certificate, application, role, profile and audit', async () => {
    const r = await submit(),
      input = await approveInput(r.body.id)
    // Real varchar(120) DB failure on the last audit write, inside the transaction.
    await expect(service.review(admin, r.body.id, input, 'x'.repeat(121))).rejects.toThrow()
    expect(await db.user.findUnique({ where: { id: owner.id } })).toMatchObject({ role: 'USER' })
    expect(await db.leaderApplication.findUnique({ where: { id: r.body.id } })).toMatchObject({ status: 'SUBMITTED' })
    expect(await db.leaderProfile.findUnique({ where: { userId: owner.id } })).toBeNull()
    expect(await db.leaderCertificate.findFirst({ where: { applicationId: r.body.id } })).toMatchObject({
      status: 'PENDING',
      verifiedAt: null,
    })
    expect(await db.auditLog.count({ where: { entityId: { in: [owner.id, r.body.id] } } })).toBe(0)
  })

  it('rejects unauthenticated, inactive, non-admin and non-USER requests', async () => {
    await request(app.getHttpServer()).get('/api/v1/leader-applications/me').expect(401)
    const r = await submit()
    expect((await review(r.body.id, await approveInput(r.body.id), owner)).status).toBe(403)
    await db.user.update({ where: { id: owner.id }, data: { status: 'SUSPENDED' } })
    expect((await submit()).status).toBe(403)
    expect((await review(r.body.id, await approveInput(r.body.id))).status).toBe(403)
    expect((await submit(admin)).status).toBe(403)
  })

  it('promoted leader keeps old private trip ownership, cannot create a new private trip, and can create public draft', async () => {
    const destination = await db.destination.create({ data: { name: 'SF01 regression' } })
    const trip = await db.trip.create({
      data: {
        title: 'Before promotion',
        tripType: 'PRIVATE',
        creatorId: owner.id,
        destinationId: destination.id,
        status: 'OPEN',
        maxPax: 4,
        startAt: new Date('2035-01-01'),
        endAt: new Date('2035-01-02'),
      },
    })
    await db.tripMember.create({ data: { tripId: trip.id, userId: owner.id, role: 'HOST' } })
    const r = await submit()
    await review(r.body.id, await approveInput(r.body.id)).expect(200)
    const promoted = await db.user.findUniqueOrThrow({ where: { id: owner.id } })
    const priv = new PrivateTripUseCase(new PrismaPrivateTripAdapter(db as unknown as PrismaService))
    expect(await priv.read(promoted, trip.id)).toMatchObject({ id: trip.id })
    const invite = await priv.invite(promoted, trip.id, trip.version)
    expect(invite).toBeTruthy()
    expect(() => priv.create(promoted, {} as any)).toThrow('LEADER_CANNOT_CREATE_PRIVATE_TRIP')
    await expect(priv.read({ ...other, role: 'LEADER' }, trip.id)).rejects.toThrow()
    const pub = new PublicTripUseCase(new PrismaTripAdapter(db as unknown as PrismaService))
    const pickup = await db.pickupPoint.create({
      data: {
        destinationId: destination.id,
        code: randomUUID(),
        name: 'SF01 pickup',
        address: 'Test only',
        latitude: 10,
        longitude: 106,
        createdBy: owner.id,
      },
    })
    const draft = await pub.create(promoted, {
      title: 'After promotion',
      destinationId: destination.id,
      startAt: '2035-02-01T00:00:00.000Z',
      endAt: '2035-02-02T00:00:00.000Z',
      pickupPointId: pickup.id,
      capacity: 4,
      price: '100000',
    })
    expect(draft).toMatchObject({ leaderId: owner.id, status: 'DRAFT' })
  })
})
