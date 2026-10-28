import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL
const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
})

export async function seedDemoPrereqs(prismaClient: PrismaClient = prisma) {
  const hostId = '2d9290b2-f60e-4c83-a46e-5ff67b4bb6f5'
  const trailId = '7ac03598-48f3-45d3-b419-debefbf1573d'
  const leaderId = '0aacba36-28cd-4936-9f12-21a4891a2bc1'
  const mediaId = 'c0000000-0000-4000-a000-000000000001'

  // 1. Cấp quyền trail_access cho host đối với tuyến Núi Dinh (yêu cầu của kịch bản private trip)
  await prismaClient.trailAccess.upsert({
    where: { id: 'a0000000-0000-4000-a000-000000000001' },
    update: { status: 'ACTIVE' },
    create: {
      id: 'a0000000-0000-4000-a000-000000000001',
      userId: hostId,
      systemTrailId: trailId,
      sourceType: 'PROMOTION',
      priceSnapshot: 0,
      status: 'ACTIVE',
      activatedAt: new Date(),
    },
  })
  console.log('✅ Đã cấp trail_access ACTIVE cho host trên tuyến Núi Dinh')

  // 2. Tạo mediaAsset chứng chỉ demo cho leader (dùng cho certificateMediaId)
  await prismaClient.mediaAsset.upsert({
    where: { id: mediaId },
    update: { status: 'READY' },
    create: {
      id: mediaId,
      ownerUserId: leaderId,
      scope: 'LEADER_CERTIFICATE',
      provider: 'CLOUDINARY',
      resourceType: 'IMAGE',
      status: 'READY',
      providerAssetId: 'demo-leader-cert-asset',
      providerPublicId: 'demo-leader-cert',
      deliveryType: 'authenticated',
      format: 'png',
      retentionUntil: null,
    },
  })
  console.log('✅ Đã tạo mediaAsset chứng chỉ demo cho leader')
}

if (require.main === module) {
  seedDemoPrereqs()
    .catch((e) => {
      console.error('❌ Lỗi seed demo prereqs:', e)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
