import { randomUUID } from 'node:crypto'
import { Test } from '@nestjs/testing'
import { APP_GUARD } from '@nestjs/core'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { TripsModule } from '../src/modules/trips/trips.module'
import { SharedModule } from '../src/shared/shared.module'
import { PrismaService } from '../src/shared/services/prisma.service'
import { SupabaseService } from '../src/shared/services/supabase.service'
import { AuthBootstrapUseCase } from '../src/modules/identity/application/use-cases/auth-bootstrap.use-case'
import type { IUserRepository } from '../src/modules/identity/application/ports/user.port'

const url = process.env.CF01_TEST_DATABASE_URL
if (url) {
  const parsed = new URL(url)
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || !parsed.pathname.startsWith('/cf01_test'))
    throw new Error('Isolated localhost cf01_test database required')
}
const suite = url ? describe : describe.skip
suite('CF01 HTTP boundary with real guards and database', () => {
  const db = new PrismaClient({ datasourceUrl: url || 'postgresql://unused@127.0.0.1:1/cf01_test' })
  let app: INestApplication
  let leaderToken: string
  let userToken: string
  let suspendedToken: string
  const tokens = new Map<string, { id: string; email: string }>()
  beforeAll(async () => {
    for (const kind of ['leader', 'user', 'suspended']) {
      const authUserId = randomUUID(),
        email = `${authUserId}@cf01.test`
      await db.user.create({
        data: {
          authUserId,
          email,
          fullName: kind,
          role: kind === 'user' ? 'USER' : 'LEADER',
          status: kind === 'suspended' ? 'SUSPENDED' : 'ACTIVE',
        },
      })
      const token = randomUUID()
      tokens.set(token, { id: authUserId, email })
      if (kind === 'leader') leaderToken = token
      if (kind === 'user') userToken = token
      if (kind === 'suspended') suspendedToken = token
    }
    const module = await Test.createTestingModule({ imports: [SharedModule, TripsModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .overrideProvider(SupabaseService)
      .useValue({ verifyToken: (token: string) => Promise.resolve(tokens.get(token) || null) })
      .compile()
    app = module.createNestApplication()
    await app.init()
  })
  afterAll(async () => {
    await app?.close()
    await db.$disconnect()
  })
  it('requires authentication and LEADER, blocks inactive accounts', async () => {
    await request(app.getHttpServer()).get('/api/v1/leader/public-trips').expect(401)
    await request(app.getHttpServer())
      .get('/api/v1/leader/public-trips')
      .auth(userToken, { type: 'bearer' })
      .expect(403)
    await request(app.getHttpServer())
      .get('/api/v1/leader/public-trips')
      .auth(suspendedToken, { type: 'bearer' })
      .expect(403)
    await request(app.getHttpServer())
      .get('/api/v1/leader/public-trips')
      .auth(leaderToken, { type: 'bearer' })
      .expect(200)
  })
  it('validates UUID, body and pagination with stable business error codes', async () => {
    const bad = await request(app.getHttpServer())
      .post('/api/v1/leader/public-trips')
      .auth(leaderToken, { type: 'bearer' })
      .send({ status: 'OPEN' })
      .expect(400)
    expect(bad.body.code).toBe('VALIDATION_ERROR')
    await request(app.getHttpServer())
      .get('/api/v1/leader/public-trips/not-uuid')
      .auth(leaderToken, { type: 'bearer' })
      .expect(400)
    await request(app.getHttpServer()).get('/api/v1/public-trips?pageSize=99999').expect(400)
  })
  it('serves public projection without exposing ownership/route snapshots', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/public-trips').expect(200)
    for (const trip of response.body) {
      expect(trip).not.toHaveProperty('creatorId')
      expect(trip).not.toHaveProperty('trails')
      expect(['OPEN', 'FULL']).toContain(trip.status)
    }
  })
  it('generates OpenAPI for all CF01 controllers and typed request bodies', () => {
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('CF01 test').build())
    expect(doc.paths['/api/v1/leader/public-trips']?.post?.requestBody).toBeDefined()
    expect(doc.paths['/api/v1/leader/public-trips/{id}/publish']).toBeDefined()
    expect(Object.keys(doc.paths).length).toBeGreaterThanOrEqual(14)
  })
})

describe('Bootstrap cannot assign privileged roles', () => {
  it('always creates USER and looks up by authenticated identity only', async () => {
    const create = jest.fn().mockResolvedValue({ id: randomUUID(), role: 'USER' })
    const repository = { findByAuthId: jest.fn().mockResolvedValue(null), create } as unknown as IUserRepository
    await new AuthBootstrapUseCase(repository).execute({
      authUserId: randomUUID(),
      email: 'fixture@cf01.test',
      role: 'ADMIN',
    })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ role: 'USER' }))
  })
})
