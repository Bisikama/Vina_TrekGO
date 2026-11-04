import 'dotenv/config'
import { PrismaClient, DifficultyLevel, GearCategory, GearCondition, GearItemSource } from '@prisma/client'
import { seedProductTechnicalProfiles } from './seeds/product-technical-profile.seed'

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL
const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
})

/**
 * GeoJSON chuẩn chứa đầy đủ các thuộc tính địa hình kỹ thuật bắt buộc cho Gear Advisor.
 */
export const CANONICAL_GEAR_GEOJSON = {
  type: 'FeatureCollection',
  properties: {
    name: 'Cung đường Trekking Núi Bà Đen - Cột Điện',
    terrain: ['forest', 'mountain', 'rocky', 'muddy'],
  },
  terrain: ['forest', 'mountain', 'rocky', 'muddy'],
  features: [
    {
      type: 'Feature',
      properties: {
        terrain: ['forest', 'mountain', 'rocky', 'muddy'],
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [106.1798, 11.3645, 42.0],
          [106.1768, 11.369, 175.0],
          [106.174, 11.373, 420.0],
          [106.172, 11.377, 710.0],
          [106.1712, 11.3789, 986.0],
        ],
      },
    },
  ],
}

/**
 * Danh mục đồ mẫu phong phú:
 * Bao gồm cả MÓN ĐẠT CHUẨN (SUITABLE) và MÓN KHÔNG PHÙ HỢP (NEEDS_ATTENTION / Cảnh báo)
 * để kiểm thử toàn diện giao diện và bộ quy tắc an toàn (Rule Engine).
 */
export const CANONICAL_SAMPLE_GEAR_ITEMS = [
  // ================= 1. ÁO KHOÁC (JACKET) =================
  {
    name: 'Áo khoác gió & mưa The North Face DryVent (Đạt chuẩn)',
    category: GearCategory.JACKET,
    brand: 'The North Face',
    condition: GearCondition.GOOD,
    attributes: {
      waterproof_mm: 15000,
      temp_rating_c: 5,
      windproof: true,
      weight_g: 480,
    },
  },
  {
    name: 'Áo gió mỏng dạo phố Uniqlo (Chống nước kém - Sẽ cảnh báo R01/R02)',
    category: GearCategory.JACKET,
    brand: 'Uniqlo',
    condition: GearCondition.GOOD,
    attributes: {
      waterproof_mm: 1200, // < 3000mm, không đủ cho thời tiết mưa
      temp_rating_c: 24,
      windproof: false,
      weight_g: 210,
    },
  },
  {
    name: 'Áo khoác phao cũ rách khóa (Tình trạng kém - Sẽ cảnh báo R24)',
    category: GearCategory.JACKET,
    brand: 'Decathlon',
    condition: GearCondition.POOR, // condition = POOR kích hoạt cảnh báo R24 đồ xuống cấp
    attributes: {
      waterproof_mm: 3500,
      temp_rating_c: 12,
      windproof: true,
      weight_g: 580,
    },
  },

  // ================= 2. GIÀY TREKKING (FOOTWEAR) =================
  {
    name: 'Giày Trekking Cổ Cao Salomon Quest 4 Gore-Tex (Đạt chuẩn)',
    category: GearCategory.FOOTWEAR,
    brand: 'Salomon',
    condition: GearCondition.GOOD,
    attributes: {
      waterproof: true,
      ankle_support: true,
      grip_level: 5,
      weight_g: 650,
    },
  },
  {
    name: "Giày Thể Thao Vải Lưới Biti's (Đế trơn, không cổ - Sẽ cảnh báo R07/R08/R09)",
    category: GearCategory.FOOTWEAR,
    brand: "Biti's",
    condition: GearCondition.GOOD,
    attributes: {
      waterproof: false, // Không chống nước -> R07 cảnh báo chân ướt phồng rộp khi mưa
      ankle_support: false, // Không có cổ bảo vệ -> R08 cảnh báo nguy cơ trẹo cổ chân
      grip_level: 1, // Đế trơn không bám -> R09 cảnh báo trơn trượt trên đá dốc
      weight_g: 350,
    },
  },

  // ================= 3. BALO (BACKPACK) =================
  {
    name: 'Balo Trợ Lực Osprey Atmos AG 50L (Đạt chuẩn)',
    category: GearCategory.BACKPACK,
    brand: 'Osprey',
    condition: GearCondition.GOOD,
    attributes: {
      capacity_l: 50,
      rain_cover: true,
      waterproof: false,
      weight_g: 1900,
    },
  },
  {
    name: 'Balo Đi Học Mini 12L (Dung tích nhỏ, không bọc mưa - Sẽ cảnh báo R16/R18)',
    category: GearCategory.BACKPACK,
    brand: 'Jansport',
    condition: GearCondition.GOOD,
    attributes: {
      capacity_l: 12, // < 35L -> R16 cảnh báo balo quá nhỏ cho chuyến trek nhiều ngày
      rain_cover: false, // R18 cảnh báo đồ bên trong sẽ ướt khi trời mưa
      waterproof: false,
      weight_g: 380,
    },
  },

  // ================= 4. TÚI NGỦ (SLEEPING_BAG) =================
  {
    name: 'Túi Ngủ Leo Núi Giữ Ấm Naturehike M300 (Đạt chuẩn)',
    category: GearCategory.SLEEPING_BAG,
    brand: 'Naturehike',
    condition: GearCondition.GOOD,
    attributes: {
      temp_rating_c: 5,
      weight_g: 1200,
    },
  },
  {
    name: 'Túi Ngủ Mùa Hè Siêu Mỏng (Không đủ ấm đêm - Sẽ cảnh báo R20)',
    category: GearCategory.SLEEPING_BAG,
    brand: 'OEM',
    condition: GearCondition.GOOD,
    attributes: {
      temp_rating_c: 24, // > nhiệt độ đêm núi -> R20 cảnh báo mất ngủ vì lạnh
      weight_g: 500,
    },
  },

  // ================= 5. GẬY LEO NÚI (TREKKING_POLE) =================
  {
    name: 'Gậy Leo Núi Chống Sốc Black Diamond Trail Pro (Đạt chuẩn)',
    category: GearCategory.TREKKING_POLE,
    brand: 'Black Diamond',
    condition: GearCondition.GOOD,
    attributes: {
      adjustable: true,
      length_min_cm: 65,
      length_max_cm: 140,
      weight_g: 540,
    },
  },
]

/**
 * Chuẩn hóa MỘT chuyến đi cụ thể được chỉ định:
 * 1. Đảm bảo trạng thái OPEN và thời gian đi ở tương lai (endAt > Date.now()).
 * 2. Đảm bảo có kế hoạch cung đường (TripTrailPlan) với đầy đủ dữ kiện terrain và difficulty.
 * 3. Đảm bảo danh sách người dùng được cấp quyền ACTIVE TripMember.
 */
export async function normalizeTripForGearAdvisor(
  tripId: string,
  activeUsers: Array<{ id: string }>,
  client: PrismaClient = prisma,
) {
  const trip = await client.trip.findUnique({
    where: { id: tripId },
    include: {
      tripTrailPlansViaTripId: true,
      tripActiveTrailPlanViaTripId: {
        include: { tripTrailPlan: true },
      },
    },
  })

  if (!trip) {
    console.log(`⚠️ Không tìm thấy chuyến đi có ID: ${tripId}`)
    return null
  }

  console.log(`\n👉 Đang chuẩn hóa riêng chuyến đi: "${trip.title}" (${trip.id})`)

  // 1. Kiểm tra ngày kết thúc và trạng thái
  const isPast = trip.endAt ? new Date(trip.endAt).getTime() < Date.now() : true
  const isIneligible = ['CANCELLED', 'COMPLETED', 'INTERRUPTED'].includes(trip.status)
  if (isPast || isIneligible) {
    const newStart = new Date(Date.now() + 7 * 86400000)
    const newEnd = new Date(Date.now() + 10 * 86400000)
    await client.trip.update({
      where: { id: trip.id },
      data: {
        status: 'OPEN',
        startAt: newStart,
        endAt: newEnd,
      },
    })
    console.log(
      `  ✅ Đã cập nhật trạng thái 'OPEN' và dời ngày đi sang tương lai (${newStart.toISOString().slice(0, 10)})`,
    )
  }

  // 2. Chuẩn hóa Kế hoạch cung đường & dữ kiện địa hình
  let plan = trip.tripActiveTrailPlanViaTripId?.tripTrailPlan ?? trip.tripTrailPlansViaTripId?.[0]
  if (plan) {
    await client.tripTrailPlan.update({
      where: { id: plan.id },
      data: {
        snapshotDifficulty: plan.snapshotDifficulty || DifficultyLevel.MEDIUM,
        snapshotGeojson: CANONICAL_GEAR_GEOJSON,
      },
    })
    console.log(`  ✅ Đã cập nhật snapshotGeojson chứa terrain cho Kế hoạch: ${plan.id}`)

    if (plan.systemTrailId) {
      await client.systemTrail.update({
        where: { id: plan.systemTrailId },
        data: {
          difficulty: DifficultyLevel.MEDIUM,
          routeGeojson: CANONICAL_GEAR_GEOJSON,
        },
      })
      console.log(`  ✅ Đã cập nhật routeGeojson cho SystemTrail: ${plan.systemTrailId}`)
    }
  } else {
    // Tạo mới TripTrailPlan nếu chuyến chưa có plan nào
    const newPlan = await client.tripTrailPlan.create({
      data: {
        tripId: trip.id,
        sequence: 1,
        snapshotName: `${trip.title} - Cung đường Chuẩn Gear`,
        snapshotDifficulty: DifficultyLevel.MEDIUM,
        snapshotGeojson: CANONICAL_GEAR_GEOJSON,
        snapshotDistanceKm: 12.5,
        snapshotElevationGainM: 950,
      },
    })
    await client.tripActiveTrailPlan.upsert({
      where: { tripId: trip.id },
      update: { trailPlanId: newPlan.id },
      create: {
        tripId: trip.id,
        trailPlanId: newPlan.id,
        changedBy: trip.creatorId,
      },
    })
    console.log(`  ✅ Đã tạo mới TripTrailPlan & kích hoạt ActiveTrailPlan: ${newPlan.id}`)
  }

  // 3. Đảm bảo tất cả người dùng active đều là ACTIVE TripMember của chuyến này
  for (const u of activeUsers) {
    await client.tripMember.upsert({
      where: {
        tripId_userId: {
          tripId: trip.id,
          userId: u.id,
        },
      },
      update: { status: 'ACTIVE' },
      create: {
        tripId: trip.id,
        userId: u.id,
        role: trip.creatorId === u.id ? 'HOST' : 'MEMBER',
        status: 'ACTIVE',
      },
    })
  }
  console.log(`  ✅ Đã đồng bộ quyền ACTIVE TripMember cho ${activeUsers.length} tài khoản`)

  return trip
}

/**
 * Nạp đồ mẫu vào tủ đồ cá nhân (UserGearItem) cho người dùng
 */
export async function seedWardrobeItems(users: Array<{ id: string }>, client: PrismaClient = prisma) {
  let syncedCount = 0
  for (const u of users) {
    for (const item of CANONICAL_SAMPLE_GEAR_ITEMS) {
      const existing = await client.userGearItem.findFirst({
        where: {
          userId: u.id,
          name: item.name,
        },
      })
      if (existing) {
        // Cập nhật lại thuộc tính chuẩn để dọn dẹp các trường cũ không hợp lệ (như frame_type)
        await client.userGearItem.update({
          where: { id: existing.id },
          data: {
            attributes: item.attributes,
            condition: item.condition,
          },
        })
        syncedCount++
      } else {
        await client.userGearItem.create({
          data: {
            userId: u.id,
            name: item.name,
            category: item.category,
            brand: item.brand,
            condition: item.condition,
            attributes: item.attributes,
            source: GearItemSource.MANUAL,
          },
        })
        syncedCount++
      }
    }
  }


  console.log(`✅ Đã đồng bộ & chuẩn hóa ${syncedCount} món trang bị mẫu (Đạt chuẩn + Không phù hợp) trong tủ đồ`)
}

/**
 * Hàm điều phối chính:
 * - QUY TẮC: TUYỆT ĐỐI KHÔNG tự động cập nhật chuyến đi nếu KHÔNG truyền tripId!
 * - Chỉ khi người dùng truyền `--tripId=<UUID>` hoặc `TRIP_ID=<UUID>` thì mới chuẩn hóa chuyến đi đó.
 * - Mặc định luôn cập nhật Tủ đồ cá nhân (bao gồm cả đồ đạt chuẩn và đồ không phù hợp để test cảnh báo).
 */
export async function seedGearDemo() {
  console.log('🚀 Bắt đầu quá trình nạp dữ liệu chuẩn cho tính năng Gear Advisor...')

  // 1. Đọc tham số dòng lệnh hoặc biến môi trường nếu có
  const cliTripArg = process.argv.find((arg) => arg.startsWith('--tripId='))
  const specifiedTripId = cliTripArg ? cliTripArg.split('=')[1] : process.env.TRIP_ID

  // 2. Lấy danh sách users active
  const activeUsers = await prisma.user.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, fullName: true, email: true },
    take: 20,
  })

  if (activeUsers.length === 0) {
    console.log('⚠️ Không tìm thấy người dùng active nào trong cơ sở dữ liệu!')
    return
  }
  console.log(`👥 Tìm thấy ${activeUsers.length} người dùng active trong hệ thống`)

  // 3. Xử lý Chuyến Đi (Trips): CHỈ cập nhật khi có specifiedTripId
  if (specifiedTripId) {
    console.log(`🎯 Nhận được tripId = "${specifiedTripId}". Tiến hành chuẩn hóa riêng chuyến đi này...`)
    await normalizeTripForGearAdvisor(specifiedTripId, activeUsers, prisma)
  } else {
    console.log('\nℹ️ [QUY TẮC AN TOÀN] Không có trip_id nào được truyền vào.')
    console.log('🔒 Script KHÔNG tự động cập nhật bất kỳ chuyến đi nào trong database.')
    console.log('👉 Nếu bạn muốn chuẩn hóa một chuyến đi cụ thể, hãy chạy:')
    console.log('   npm run seed:gear-demo -- --tripId=<ID_CHUYẾN_ĐI>')
    console.log('   (hoặc: TRIP_ID=<ID_CHUYẾN_ĐI> npm run seed:gear-demo)\n')
  }

  // 4. Đồng bộ tủ đồ cá nhân phong phú (gồm cả đồ Đạt chuẩn & đồ Không phù hợp)
  await seedWardrobeItems(activeUsers, prisma)

  // 5. Đồng bộ hồ sơ kỹ thuật (ProductTechnicalProfile) cho Catalog sản phẩm thuê
  await seedProductTechnicalProfiles(prisma)

  console.log('\n🎉 HOÀN TẤT ĐỒNG BỘ DỮ LIỆU GEAR DEMO THÀNH CÔNG!')
  console.log('👉 Tủ đồ cá nhân của bạn hiện đã có cả món phù hợp và món không phù hợp để bạn test hiển thị cảnh báo.')
}

if (require.main === module) {
  seedGearDemo()
    .catch((e) => {
      console.error('❌ Lỗi khi chạy:', e)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
