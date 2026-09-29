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
  // Tuyến đường leo thực tế mượt mà uốn lượn men theo đường Cột Điện (từ ~42m lên đỉnh 986m)
  const cotDienCoordinates = [
    [106.1798, 11.3645, 42.0],  // Điểm gửi xe & Cổng bắt đầu
    [106.1792, 11.3653, 50.0],  // Cột 1 - Cột xuất phát
    [106.1788, 11.3661, 62.0],  // Cột 5 - Đường đất đỏ
    [106.1784, 11.3669, 85.0],  // Cột 10
    [106.1779, 11.3676, 110.0], // Cột 15
    [106.1774, 11.3683, 140.0], // Cột 20
    [106.1768, 11.3690, 175.0], // Cột 25 - Vườn chuối / Đá tảng
    [106.1762, 11.3698, 220.0], // Cột 30
    [106.1757, 11.3706, 260.0], // Cột 35 - Đoạn dốc đá đầu tiên
    [106.1751, 11.3713, 310.0], // Cột 40
    [106.1746, 11.3721, 365.0], // Cột 45
    [106.1740, 11.3730, 420.0], // Cột 50 - Vách đá dốc 45 độ
    [106.1736, 11.3737, 475.0], // Cột 53
    [106.1731, 11.3745, 535.0], // Cột 55 - Trạm tiếp nước / Điểm ngắm cảnh giữa núi
    [106.1727, 11.3753, 590.0], // Cột 60 - Rừng trúc
    [106.1724, 11.3761, 645.0], // Cột 65
    [106.1720, 11.3770, 710.0], // Cột 72 - Bãi đá dốc đứng
    [106.1717, 11.3778, 765.0], // Cột 80
    [106.1713, 11.3786, 815.0], // Cột 88
    [106.1710, 11.3795, 860.0], // Cột 95 - Đoạn lộng gió nhìn toàn cảnh TP Tây Ninh
    [106.1706, 11.3804, 905.0], // Cột 102
    [106.1703, 11.3813, 935.0], // Cột 108
    [106.1700, 11.3822, 960.0], // Cột 114 - Lên sàn bê tông
    [106.1698, 11.3830, 978.0], // Cột 116
    [106.1695, 11.3838, 986.0], // Cột 117 - Cột mốc đỉnh Núi Bà Đen 986m
  ]

  const geoJsonData = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          name: 'Cung đường Cột Điện - Núi Bà Đen',
          stroke: '#FF3D00',
          strokeWidth: 5,
        },
        geometry: {
          type: 'LineString',
          coordinates: cotDienCoordinates,
        },
      },
    ],
  }

  // 4. Tạo hoặc Cập nhật SystemTrail: Cung đường Cột Điện
  const trail = await prisma.systemTrail.upsert({
    where: { code: 'TRAIL_BADEN_COTDIEN' },
    update: {
      routeGeojson: geoJsonData,
      distanceKm: 4.5,
      elevationGainM: 944,
    },
    create: {
      id: 'c1000000-0000-0000-0000-000000000001',
      destinationId: destination.id,
      createdBy: adminUser.id,
      code: 'TRAIL_BADEN_COTDIEN',
      name: 'Cung đường Cột Điện - Đỉnh Núi Bà Đen',
      description: 'Cung trekking phổ biến và rõ đường nhất tại Núi Bà Đen, men theo đường dây điện từ Cột 1 đến Cột 117 trên đỉnh núi.',
      difficulty: DifficultyLevel.MEDIUM,
      distanceKm: 4.5,
      elevationGainM: 944,
      estimatedDurationMinutes: 240, // 4 tiếng
      price: 0,
      status: 'ACTIVE',
      routeGeojson: geoJsonData,
    },
  })
  console.log('✅ Đã cập nhật SystemTrail:', trail.name)

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
