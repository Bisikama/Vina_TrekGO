import 'dotenv/config'
import { PrismaClient, DifficultyLevel, CheckpointType } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl,
    },
  },
})

interface SeedData {
  destination: {
    id: string
    name: string
    description: string | null
    region: string | null
    center_lat: number | null
    center_lng: number | null
    status: any
    created_at: string
    updated_at: string
  }
  checkpoints: Array<{
    id: string
    destination_id: string
    code: string | null
    name: string
    description: string | null
    latitude: number
    longitude: number
    default_radius_meters: number
    checkpoint_type: CheckpointType | null
    status: any
    created_at: string
    updated_at: string
  }>
  system_trails: Array<{
    id: string
    destination_id: string
    source_submission_id: string | null
    code: string
    name: string
    description: string | null
    difficulty: DifficultyLevel
    distance_km: number
    elevation_gain_m: number | null
    estimated_duration_minutes: number | null
    route_geojson: any
    price: number
    status: any
    created_by: string
    version: number
    created_at: string
    updated_at: string
    archived_at: string | null
  }>
  pickup_points: Array<{
    id: string
    destination_id: string | null
    code: string
    name: string
    address: string
    latitude: number
    longitude: number
    note: string | null
    status: any
    created_by: string
    created_at: string
    updated_at: string
  }>
  trail_checkpoints: Array<{
    id: string
    system_trail_id: string
    checkpoint_id: string
    sequence: number
    is_required: boolean
    created_at: string
  }>
}

export async function seedNuiDinhData(prismaClient: PrismaClient = prisma) {
  console.log('🌱 Bắt đầu nạp seed data Núi Dinh...')

  const dataPath = path.join(__dirname, 'seeds', 'data', 'destination-nui-dinh.seed.json')
  const rawData = fs.readFileSync(dataPath, 'utf8')
  const seedData: SeedData = JSON.parse(rawData)

  // 1. Đảm bảo có User Admin làm createdBy nếu chưa có
  let adminUser = await prismaClient.user.findFirst()
  if (!adminUser) {
    adminUser = await prismaClient.user.create({
      data: {
        authUserId: '00000000-0000-0000-0000-000000000001',
        email: 'system.admin@trekgo.vn',
        fullName: 'TrekGo Admin',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    })
    console.log('✅ Đã tạo user admin mặc định:', adminUser.id)
  }

  // Check creator user
  const creatorUser = await prismaClient.user.findUnique({
    where: { id: seedData.system_trails[0]?.created_by || '' },
  })
  const fallbackCreatedBy = creatorUser ? creatorUser.id : adminUser.id

  // 2. Destination
  const destData = seedData.destination
  const destination = await prismaClient.destination.upsert({
    where: { id: destData.id },
    update: {
      name: destData.name,
      description: destData.description,
      region: destData.region,
      centerLat: destData.center_lat,
      centerLng: destData.center_lng,
      status: destData.status,
    },
    create: {
      id: destData.id,
      name: destData.name,
      description: destData.description,
      region: destData.region,
      centerLat: destData.center_lat,
      centerLng: destData.center_lng,
      status: destData.status,
    },
  })
  console.log('✅ Đã nạp Destination:', destination.name, destination.id)

  // 3. Pickup Points
  for (const pp of seedData.pickup_points) {
    await prismaClient.pickupPoint.upsert({
      where: { code: pp.code },
      update: {
        destinationId: destination.id,
        name: pp.name,
        address: pp.address,
        latitude: pp.latitude,
        longitude: pp.longitude,
        note: pp.note,
        status: pp.status,
      },
      create: {
        id: pp.id,
        destinationId: destination.id,
        code: pp.code,
        name: pp.name,
        address: pp.address,
        latitude: pp.latitude,
        longitude: pp.longitude,
        note: pp.note,
        status: pp.status,
        createdBy: fallbackCreatedBy,
      },
    })
  }
  console.log(`✅ Đã nạp ${seedData.pickup_points.length} Pickup Point(s)`)

  // 4. Checkpoints
  for (const cp of seedData.checkpoints) {
    await prismaClient.checkpoint.upsert({
      where: { id: cp.id },
      update: {
        destinationId: destination.id,
        code: cp.code,
        name: cp.name,
        description: cp.description,
        latitude: cp.latitude,
        longitude: cp.longitude,
        defaultRadiusMeters: cp.default_radius_meters,
        checkpointType: cp.checkpoint_type,
        status: cp.status,
      },
      create: {
        id: cp.id,
        destinationId: destination.id,
        code: cp.code,
        name: cp.name,
        description: cp.description,
        latitude: cp.latitude,
        longitude: cp.longitude,
        defaultRadiusMeters: cp.default_radius_meters,
        checkpointType: cp.checkpoint_type,
        status: cp.status,
      },
    })
  }
  console.log(`✅ Đã nạp ${seedData.checkpoints.length} Checkpoint(s)`)

  // 5. System Trails
  for (const st of seedData.system_trails) {
    const trail = await prismaClient.systemTrail.upsert({
      where: { code: st.code },
      update: {
        name: st.name,
        description: st.description,
        difficulty: st.difficulty,
        distanceKm: st.distance_km,
        elevationGainM: st.elevation_gain_m,
        estimatedDurationMinutes: st.estimated_duration_minutes,
        routeGeojson: st.route_geojson,
        price: st.price,
        status: st.status,
      },
      create: {
        id: st.id,
        destinationId: destination.id,
        code: st.code,
        name: st.name,
        description: st.description,
        difficulty: st.difficulty,
        distanceKm: st.distance_km,
        elevationGainM: st.elevation_gain_m,
        estimatedDurationMinutes: st.estimated_duration_minutes,
        routeGeojson: st.route_geojson,
        price: st.price,
        status: st.status,
        createdBy: fallbackCreatedBy,
      },
    })
    console.log('✅ Đã nạp SystemTrail:', trail.name, trail.code)
  }

  // 6. Trail Checkpoints
  const trailIds = seedData.system_trails.map((st) => st.id)
  await prismaClient.trailCheckpoint.deleteMany({
    where: { systemTrailId: { in: trailIds } },
  })

  await prismaClient.trailCheckpoint.createMany({
    data: seedData.trail_checkpoints.map((tc) => ({
      id: tc.id,
      systemTrailId: tc.system_trail_id,
      checkpointId: tc.checkpoint_id,
      sequence: tc.sequence,
      isRequired: tc.is_required,
    })),
  })
  console.log(`✅ Đã gắn ${seedData.trail_checkpoints.length} Checkpoint(s) vào SystemTrail`)
}

if (require.main === module) {
  seedNuiDinhData()
    .catch((e) => {
      console.error('❌ Lỗi seed:', e)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
