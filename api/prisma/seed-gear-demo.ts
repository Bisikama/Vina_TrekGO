import 'dotenv/config'
import { PrismaClient, GearCategory, GearCondition, GearItemSource } from '@prisma/client'
import { GEAR_RULE_METADATA_REGISTRY } from '../src/modules/gear/domain/rule-metadata.registry'
import { PrismaTripContextReadAdapter } from '../src/modules/gear/infrastructure/adapters/prisma-trip-context-read.adapter'
import type { PrismaService } from '../src/shared/services/prisma.service'

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL
const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
})

/**
 * Món mẫu với thông số đa dạng; kết quả thực tế phụ thuộc dữ kiện chuyến và khí hậu.
 * Giữ tên ổn định để chạy lại không tạo món trùng hoặc ghi đè món đã chỉnh sửa.
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
  {
    name: 'Giày trekking chưa rõ thông số (Cần bổ sung thông tin)',
    category: GearCategory.FOOTWEAR,
    brand: 'Demo',
    condition: GearCondition.GOOD,
    attributes: { weight_g: 600 },
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

/** Chỉ tạo dữ liệu demo còn thiếu, không sửa dữ liệu có sẵn. */
export async function seedGearDemo(client: PrismaClient, userId: string, tripId?: string) {
  const user = await client.user.findUnique({ where: { id: userId }, select: { id: true, status: true } })
  if (!user || user.status !== 'ACTIVE') throw new Error('Không tìm thấy tài khoản ACTIVE với userId đã chỉ định.')
  if (tripId) {
    const context = await new PrismaTripContextReadAdapter(client as PrismaService).getTripContext(tripId, userId)
    console.log('Chuyến hợp lệ:', context.tripId, 'số ngày:', context.days, 'độ khó:', context.difficulty, 'địa hình:', context.terrain.join(', '))
  }
  const existingRules = await client.gearRequirementRule.findMany()
  const canonical = new Map(GEAR_RULE_METADATA_REGISTRY.map((rule) => [rule.id, rule]))
  const conflicts = existingRules.filter((rule) => {
    const expected = canonical.get(rule.id)
    if (!expected) return rule.isActive
    return rule.isActive !== expected.isActive || rule.category !== expected.category ||
      rule.defaultVerdict !== expected.defaultVerdict || rule.templateVi !== expected.templateVi ||
      rule.ruleVersion !== expected.ruleVersion
  })
  if (conflicts.length) {
    throw new Error('Quy tắc Gear không khớp cấu hình chuẩn: ' + conflicts.map((rule) => rule.id).join(', ') + '. Kiểm tra cấu hình trước khi seed; script không ghi đè quy tắc.')
  }
  const result = await client.$transaction(async (tx) => {
    const rules = await tx.gearRequirementRule.createMany({
      data: GEAR_RULE_METADATA_REGISTRY.map((rule) => ({
        id: rule.id, category: rule.category as any, defaultVerdict: rule.defaultVerdict as any,
        templateVi: rule.templateVi, isActive: rule.isActive, ruleVersion: rule.ruleVersion,
      })),
      skipDuplicates: true,
    })
    let created = 0
    for (const item of CANONICAL_SAMPLE_GEAR_ITEMS) {
      const name = '[DEMO] ' + item.name
      const existing = await tx.userGearItem.findFirst({ where: { userId, name }, select: { id: true } })
      if (existing) continue
      await tx.userGearItem.create({ data: {
        userId, name, category: item.category, brand: item.brand,
        condition: item.condition, attributes: item.attributes, source: GearItemSource.MANUAL,
      } })
      created++
    }
    return { rules: rules.count, items: created }
  })
  console.log('Hoàn tất: thêm', result.rules, 'quy tắc và', result.items, 'món demo cho tài khoản', userId)
  console.log('Chạy lại giữ nguyên món demo đã tồn tại; không cập nhật chuyến đi, thành viên hay sản phẩm thuê.')
  if (!tripId) console.log('Để kiểm tra quyền và dữ kiện chuyến demo, truyền thêm --tripId=<UUID>.')
  return result
}

if (require.main === module) {
  const argument = (name: string) => process.argv.find((arg) => arg.startsWith('--' + name + '='))?.slice(name.length + 3)
  const userId = argument('userId')
  const tripId = argument('tripId')
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!userId || !uuid.test(userId) || (tripId && !uuid.test(tripId))) {
    console.error('Cách dùng: npm run seed:gear-demo -- --userId=<UUID> [--tripId=<UUID>]')
    process.exitCode = 1
  } else {
    seedGearDemo(prisma, userId, tripId)
      .catch((error) => { console.error('Không thể seed Gear demo:', error.message); process.exitCode = 1 })
      .finally(async () => { await prisma.$disconnect() })
  }
}
