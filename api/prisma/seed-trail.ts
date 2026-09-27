import { PrismaClient, DifficultyLevel } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Bắt đầu nạp mock data cho Núi Bà Đen...')

  // 1. Lấy 1 User có sẵn trong DB làm người tạo (hoặc tạo User System nếu DB chưa có ai)
  let adminUser = await prisma.user.findFirst()
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        authUserId: '00000000-0000-0000-0000-000000000001',
        email: 'system.admin@trekgo.vn',
        fullName: 'TrekGo Admin',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    })
    console.log('✅ Đã tạo user admin mặc định:', adminUser.id)
  } else {
    console.log('✅ Sử dụng user có sẵn:', adminUser.email)
  }

  // 2. Tạo Destination: Núi Bà Đen
  const destination = await prisma.destination.upsert({
    where: { id: 'd1000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: 'd1000000-0000-0000-0000-000000000001',
      name: 'Núi Bà Đen - Tây Ninh',
      description: 'Nóc nhà Đông Nam Bộ với độ cao 986m, cung đường dốc đá và thảm thực vật đa dạng.',
      region: 'SOUTH',
      centerLat: 11.3789,
      centerLng: 106.1712,
      status: 'ACTIVE',
    },
  })
  console.log('✅ Đã tạo Destination:', destination.name)

  // 3. Toạ độ 3D chuẩn [Kinh độ (Lng), Vĩ độ (Lat), Cao độ (Alt mét)]
  // Tuyến đường leo thực tế men theo đường Cột Điện (từ ~45m lên đỉnh 986m)
  const cotDienCoordinates = [
    [106.1785, 11.3652, 45.0],   // Cột 1 - Điểm xuất phát chân núi
    [106.1778, 11.3668, 85.0],   // Cột 10
    [106.1765, 11.3685, 160.0],  // Cột 25 - Bắt đầu dốc đá
    [106.1752, 11.3705, 275.0],  // Cột 40
    [106.1738, 11.3725, 410.0],  // Cột 50
    [106.1731, 11.3742, 535.0],  // Cột 55 - Trạm tiếp nước / Nghỉ chân giữa núi
    [106.1720, 11.3765, 680.0],  // Cột 75 - Dốc trơn trượt
    [106.1712, 11.3790, 820.0],  // Cột 95 - Gió mạnh
    [106.1705, 11.3815, 915.0],  // Cột 110 - Gần chạm đỉnh
    [106.1698, 11.3838, 986.0],  // Cột 117 - Cột mốc đỉnh Núi Bà Đen 986m
  ]

  // 4. Tạo SystemTrail: Cung đường Cột Điện
  const trail = await prisma.systemTrail.upsert({
    where: { code: 'TRAIL_BADEN_COTDIEN' },
    update: {},
    create: {
      id: 'c1000000-0000-0000-0000-000000000001',
      destinationId: destination.id,
      createdBy: adminUser.id,
      code: 'TRAIL_BADEN_COTDIEN',
      name: 'Cung đường Cột Điện - Đỉnh Núi Bà Đen',
      description: 'Cung trekking phổ biến và rõ đường nhất tại Núi Bà Đen, men theo đường dây điện từ Cột 1 đến Cột 117 trên đỉnh núi.',
      difficulty: DifficultyLevel.MEDIUM,
      distanceKm: 4.5,
      elevationGainM: 941,
      estimatedDurationMinutes: 240, // 4 tiếng
      price: 0,
      status: 'ACTIVE',
      routeGeojson: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              name: 'Đường mòn Cột Điện',
              stroke: '#FF5722',
              strokeWidth: 4,
            },
            geometry: {
              type: 'LineString',
              coordinates: cotDienCoordinates,
            },
          },
        ],
      },
    },
  })
  console.log('✅ Đã tạo SystemTrail:', trail.name)

  // 5. (Khuyến nghị) Tạo 3 Checkpoint chính dọc theo cung này
  const cpStart = await prisma.checkpoint.upsert({
    where: { code: 'CP_BADEN_START' },
    update: {},
    create: {
      destinationId: destination.id,
      code: 'CP_BADEN_START',
      name: 'Cột số 1 - Chân núi (Điểm xuất phát)',
      description: 'Điểm gửi xe và bắt đầu cung đường Cột Điện',
      latitude: 11.3652,
      longitude: 106.1785,
      defaultRadiusMeters: 40,
      status: 'ACTIVE',
    },
  })

  const cpMid = await prisma.checkpoint.upsert({
    where: { code: 'CP_BADEN_MID' },
    update: {},
    create: {
      destinationId: destination.id,
      code: 'CP_BADEN_MID',
      name: 'Cột số 55 - Trạm nghỉ tiếp nước',
      description: 'Vị trí lưng chừng núi cao 535m, có điểm nghỉ ngơi',
      latitude: 11.3742,
      longitude: 106.1731,
      defaultRadiusMeters: 30,
      status: 'ACTIVE',
    },
  })

  const cpSummit = await prisma.checkpoint.upsert({
    where: { code: 'CP_BADEN_SUMMIT' },
    update: {},
    create: {
      destinationId: destination.id,
      code: 'CP_BADEN_SUMMIT',
      name: 'Chóp đỉnh Núi Bà Đen 986m',
      description: 'Cột mốc nóc nhà Nam Bộ',
      latitude: 11.3838,
      longitude: 106.1698,
      defaultRadiusMeters: 50,
      status: 'ACTIVE',
    },
  })

  // Xóa liên kết cũ (nếu có) trước khi tạo lại để đảm bảo không lỗi duplicate
  await prisma.trailCheckpoint.deleteMany({
    where: { systemTrailId: trail.id },
  })

  // Gắn Checkpoint vào SystemTrail theo thứ tự sequence
  await prisma.trailCheckpoint.createMany({
    data: [
      { systemTrailId: trail.id, checkpointId: cpStart.id, sequence: 1, isRequired: true },
      { systemTrailId: trail.id, checkpointId: cpMid.id, sequence: 2, isRequired: false },
      { systemTrailId: trail.id, checkpointId: cpSummit.id, sequence: 3, isRequired: true },
    ],
  })
  console.log('✅ Đã gắn 3 Checkpoint vào cung đường!')
}

main()
  .catch((e) => {
    console.error('❌ Lỗi seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
