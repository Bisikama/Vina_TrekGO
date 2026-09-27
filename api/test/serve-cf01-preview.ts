// Isolated browser QA ONLY: replaces the external Supabase boundary with fixture auth.
// Not imported by AppModule, not enabled by production configuration, binds loopback only.
import { randomUUID } from 'node:crypto'
import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { PrismaClient } from '@prisma/client'
import { SharedModule } from '../src/shared/shared.module'
import { PrismaService } from '../src/shared/services/prisma.service'
import { SupabaseService } from '../src/shared/services/supabase.service'
import { TripsModule } from '../src/modules/trips/trips.module'
import { Auth } from '../src/shared/decorators/auth.decorator'
import { AuthType } from '../src/shared/constants/auth.constant'

const url = process.env.CF01_TEST_DATABASE_URL
if (!url || new URL(url).hostname !== '127.0.0.1' || !new URL(url).pathname.startsWith('/cf01_test')) throw new Error('Isolated localhost CF01 database required')
const db = new PrismaClient({ datasourceUrl: url })
let fixtureUser: { id: string; authUserId: string; email: string; fullName: string; role: string }
const token = randomUUID()
@Controller('auth')
class FixtureLoginController {
  @Post('login') @Auth([AuthType.None])
  login(@Body() body: { email?: string; password?: string }) {
    if (body.email !== 'leader@cf01.test' || body.password !== 'cf01-local-test') throw new UnauthorizedException()
    return { user: fixtureUser, accessToken: token }
  }
}
async function main() {
  const suffix = randomUUID()
  fixtureUser = await db.user.create({ data: { authUserId: randomUUID(), email: `${suffix}@cf01.test`, fullName: 'Leader kiểm thử', role: 'LEADER' } })
  const destination = await db.destination.create({ data: { name: 'CF01 — Núi thử nghiệm' } })
  await db.pickupPoint.create({ data: { name: 'Cổng khu trekking', code: suffix, address: 'Địa chỉ kiểm thử', destinationId: destination.id, latitude: 11, longitude: 108, createdBy: fixtureUser.id } })
  const points: string[] = []
  for (const name of ['Chân núi', 'Trạm nghỉ', 'Đỉnh núi']) points.push((await db.checkpoint.create({ data: { name, destinationId: destination.id, latitude: 11, longitude: 108 } })).id)
  const trail = await db.systemTrail.create({ data: { code: randomUUID(), name: 'Đường lên đỉnh', destinationId: destination.id, difficulty: 'EASY', distanceKm: 4.5, routeGeojson: { type: 'LineString', coordinates: [[108, 11], [108.01, 11.01]] }, createdBy: fixtureUser.id } })
  await db.trailCheckpoint.createMany({ data: points.map((checkpointId, i) => ({ systemTrailId: trail.id, checkpointId, sequence: i + 1 })) })
  const module = await Test.createTestingModule({ imports: [SharedModule, TripsModule], controllers: [FixtureLoginController] })
    .overrideProvider(PrismaService).useValue(db)
    .overrideProvider(SupabaseService).useValue({ verifyToken: (value: string) => Promise.resolve(value === token ? { id: fixtureUser.authUserId, email: fixtureUser.email } : null) }).compile()
  const app = module.createNestApplication({ logger: ['error'] })
  await app.listen(3102, '127.0.0.1')
  console.log('CF01 fixture API ready on 127.0.0.1:3102; external auth mocked. Login: leader@cf01.test / cf01-local-test')
  const close = async () => { await app.close(); await db.$disconnect(); process.exit(0) }
  process.on('SIGINT', () => void close()); process.on('SIGTERM', () => void close())
}
void main().catch(async () => { console.error('CF01 fixture startup failed'); await db.$disconnect(); process.exitCode = 1 })
