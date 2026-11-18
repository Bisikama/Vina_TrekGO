/**
 * Demo Gear Advisor: quy tắc đánh giá + tủ đồ mẫu (đủ 8 nhóm đồ, có ảnh thật) cho một tài khoản.
 *
 *   npm run seed:gear-demo -- --email=<email tài khoản> [--tripId=<UUID>] [--no-photos]
 *   npm run seed:gear-demo -- --userId=<UUID> [--tripId=<UUID>] [--no-photos]
 *
 * - Chạy trên DB trong `.env` (DIRECT_URL, không có thì DATABASE_URL).
 * - Ảnh: tải ảnh thật (Wikimedia Commons hoặc ảnh sản phẩm của catalog thuê) lên Cloudinary rồi tạo MediaAsset
 *   USER_GEAR của chính tài khoản, giống ảnh người dùng tự tải. Cần `MEDIA_ENABLED=true` và cấu hình Cloudinary.
 * - Chạy lại: không tạo món trùng, không ghi đè món đã chỉnh sửa; chỉ gắn ảnh cho món demo chưa có ảnh.
 */
import 'dotenv/config'
import { PrismaClient, GearCategory, GearCondition, GearItemSource } from '@prisma/client'
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary'
import { GEAR_RULE_METADATA_REGISTRY } from '../src/modules/gear/domain/rule-metadata.registry'
import { PrismaTripContextReadAdapter } from '../src/modules/gear/infrastructure/adapters/prisma-trip-context-read.adapter'
import type { PrismaService } from '../src/shared/services/prisma.service'
import { calculateOccupiedWindow } from '../src/modules/rental/ordering/application/services/rental-ordering.rules'
import { getVerifiedCapacitySnapshot } from '../src/modules/rental/ordering/infrastructure/adapters/rental-capacity-snapshot'

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL
const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
})

const COMMONS_THUMB = 'https://thumb.wikimedia.org/wikipedia/commons/thumb'
const COMMONS = 'https://upload.wikimedia.org/wikipedia/commons'
const commons = (path: string, width = 960) => {
  const file = path.split('/').pop()!
  return [`${COMMONS_THUMB}/${path}/${width}px-${file}`, `${COMMONS}/${path}`]
}

/** Ảnh minh hoạ thật, có link dự phòng: Wikimedia Commons (giấy phép mở) hoặc ảnh sản phẩm đang dùng ở catalog thuê. */
const IMG = {
  softshell: commons('a/ab/Softshelljacke.jpg'),
  windbreaker: ['https://mediahub.debenhams.com/m5055805342027_yellow_xl.jpeg'],
  downVest: commons('b/b8/Adidas_Helionic_Down_vest.jpg'),
  downJacket: [
    ...commons('f/fd/Polo_Ralph_Lauren_down_jacket_with_Aztec_style_print.jpg'),
    ...commons('b/b8/Adidas_Helionic_Down_vest.jpg'),
  ],
  trekkingBoots: [
    ...commons('6/64/Arcteryx_Acrux_Trail_women_trekking_boots.jpg'),
    ...commons('6/62/Danner_boots_VOA_image.jpg'),
  ],
  sneakers: ['https://toreadgear.com/cdn/shop/files/TFAABL91762-K676-_1_1120x.png?v=1743663673'],
  plainBoots: commons('6/62/Danner_boots_VOA_image.jpg'),
  oldBoots: [...commons('7/70/Lead_boots%2C_Vojvodina_trekking.jpg'), ...commons('6/62/Danner_boots_VOA_image.jpg')],
  bigPack: ['https://cdn.shopify.com/s/files/1/0563/8628/9833/products/79548_5743_pathway60_front34_1_1200x.jpg?v=1636642301'],
  smallPack: [
    ...commons('a/a3/A_backpack_with_trekking_poles_and_shoes.jpg'),
    'https://cdn.shopify.com/s/files/1/0563/8628/9833/products/79548_5743_pathway60_front34_1_1200x.jpg?v=1636642301',
  ],
  mummyBag: commons('2/2e/Mummy_bag.jpg'),
  thinBag: ['https://cdn.media.amplience.net/i/frasersdev/40412805_o.jpg?v=20260416103058'],
  poles: [...commons('6/66/Retracted_trekking_poles.jpg'), ...commons('1/12/Hiking_pole.jpg')],
  woodPole: commons('1/12/Hiking_pole.jpg'),
  cargoPants: [...commons('c/cd/Cargo_pants_001.jpg'), ...commons('d/d6/Khaki_Cargo_Pants_Side.jpg')],
  khakiPants: [...commons('d/d6/Khaki_Cargo_Pants_Side.jpg'), ...commons('c/cd/Cargo_pants_001.jpg')],
  tent: ['https://marmote.fr/cdn/shop/products/Tentesdesertfox_1.png?v=1659371645'],
  domeTent: [
    ...commons('e/e1/Dome_tent_in_the_BWCA_%28CDM11452CT%29.jpg'),
    'https://marmote.fr/cdn/shop/products/Tentesdesertfox_1.png?v=1659371645',
  ],
  rainSuit: ['https://img.91app.com/webapi/imagesV3/Original/SalePage/11141022/0/638943208917670000?v=1'],
  poncho: [...commons('5/5f/Poncho.jpg'), ...commons('c/c1/Julie_a_mis_son_poncho_%282848363220%29.jpg')],
}

/**
 * Món mẫu đủ 8 nhóm đồ; mỗi quy tắc R01–R28 có ít nhất một món minh hoạ. Kết quả thực tế phụ thuộc
 * dữ kiện chuyến và khí hậu. Giữ tên ổn định để chạy lại không tạo món trùng hoặc ghi đè món đã chỉnh sửa.
 */
export const CANONICAL_SAMPLE_GEAR_ITEMS = [
  // ================= 1. ÁO KHOÁC (JACKET) =================
  {
    key: 'jacket-tnf',
    name: 'Áo khoác gió & mưa The North Face DryVent (Đạt chuẩn)',
    category: GearCategory.JACKET,
    brand: 'The North Face',
    condition: GearCondition.GOOD,
    attributes: { waterproof_mm: 15000, temp_rating_c: 5, windproof: true, weight_g: 480 },
    photoUrls: IMG.softshell,
  },
  {
    key: 'jacket-uniqlo',
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
    photoUrls: IMG.windbreaker,
  },
  {
    key: 'jacket-old-puffer',
    name: 'Áo khoác phao cũ rách khóa (Tình trạng kém - Sẽ cảnh báo R24)',
    category: GearCategory.JACKET,
    brand: 'Decathlon',
    condition: GearCondition.POOR, // condition = POOR kích hoạt cảnh báo R24 đồ xuống cấp
    attributes: { waterproof_mm: 3500, temp_rating_c: 12, windproof: true, weight_g: 580 },
    photoUrls: IMG.downVest,
  },
  {
    key: 'jacket-heavy-down',
    name: 'Áo phao lông vũ dày 1.3kg (Nặng - Sẽ cảnh báo R05/R06 khi trời nóng, đường khó)',
    category: GearCategory.JACKET,
    brand: 'Ralph Lauren',
    condition: GearCondition.GOOD,
    attributes: { waterproof_mm: 2000, temp_rating_c: -5, windproof: true, weight_g: 1300 },
    photoUrls: IMG.downJacket,
  },

  // ================= 2. GIÀY TREKKING (FOOTWEAR) =================
  {
    key: 'footwear-salomon',
    name: 'Giày Trekking Cổ Cao Salomon Quest 4 Gore-Tex (Đạt chuẩn)',
    category: GearCategory.FOOTWEAR,
    brand: 'Salomon',
    condition: GearCondition.GOOD,
    attributes: { waterproof: true, ankle_support: true, grip_level: 5, weight_g: 650 },
    photoUrls: IMG.trekkingBoots,
  },
  {
    key: 'footwear-bitis',
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
    photoUrls: IMG.sneakers,
  },
  {
    key: 'footwear-unknown',
    name: 'Giày trekking chưa rõ thông số (Cần bổ sung thông tin)',
    category: GearCategory.FOOTWEAR,
    brand: 'Không rõ',
    condition: GearCondition.GOOD,
    attributes: { weight_g: 600 }, // Thiếu thông số -> R25
    photoUrls: IMG.plainBoots,
  },
  {
    key: 'footwear-worn-grip',
    name: 'Giày leo núi cũ mòn đế (Bám trung bình - Sẽ cảnh báo R11 khi đường khó)',
    category: GearCategory.FOOTWEAR,
    brand: 'Columbia',
    condition: GearCondition.WORN,
    attributes: { waterproof: true, ankle_support: true, grip_level: 3, weight_g: 720 },
    photoUrls: IMG.oldBoots,
  },

  // ================= 3. QUẦN (PANTS) =================
  {
    key: 'pants-softshell',
    name: 'Quần trekking chống nước lót nỉ Columbia (Đạt chuẩn)',
    category: GearCategory.PANTS,
    brand: 'Columbia',
    condition: GearCondition.GOOD,
    attributes: { waterproof_mm: 5000, temp_rating_c: 0, insulated: true },
    photoUrls: IMG.cargoPants,
  },
  {
    key: 'pants-kaki',
    name: 'Quần kaki dạo phố (Không chống nước, không lót - Sẽ cảnh báo R12/R13/R14)',
    category: GearCategory.PANTS,
    brand: 'Owen',
    condition: GearCondition.GOOD,
    attributes: { waterproof_mm: 0, temp_rating_c: 20, insulated: false },
    photoUrls: IMG.khakiPants,
  },

  // ================= 4. BALO (BACKPACK) =================
  {
    key: 'backpack-osprey',
    name: 'Balo Trợ Lực Osprey Atmos AG 50L (Đạt chuẩn)',
    category: GearCategory.BACKPACK,
    brand: 'Osprey',
    condition: GearCondition.GOOD,
    attributes: { capacity_l: 50, rain_cover: true, waterproof: false, weight_g: 1900 },
    photoUrls: IMG.bigPack,
  },
  {
    key: 'backpack-mini',
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
    photoUrls: IMG.smallPack,
  },
  {
    key: 'backpack-30l',
    name: 'Balo daypack 30L (Thiếu chỗ cho túi ngủ, lều - Sẽ cảnh báo R17 khi đi nhiều ngày)',
    category: GearCategory.BACKPACK,
    brand: 'Quechua',
    condition: GearCondition.GOOD,
    attributes: { capacity_l: 30, rain_cover: true, waterproof: false, weight_g: 900 },
    photoUrls: IMG.smallPack,
  },
  {
    key: 'backpack-90l',
    name: 'Balo đại 90L (Quá to cho chuyến ngắn - Sẽ cảnh báo R19)',
    category: GearCategory.BACKPACK,
    brand: 'Deuter',
    condition: GearCondition.GOOD,
    attributes: { capacity_l: 90, rain_cover: true, waterproof: false, weight_g: 2600 },
    photoUrls: IMG.bigPack,
  },

  // ================= 5. TÚI NGỦ (SLEEPING_BAG) =================
  {
    key: 'sleeping-m300',
    name: 'Túi Ngủ Leo Núi Giữ Ấm Naturehike M300 (Đạt chuẩn)',
    category: GearCategory.SLEEPING_BAG,
    brand: 'Naturehike',
    condition: GearCondition.GOOD,
    attributes: { temp_rating_c: 5, weight_g: 1200 },
    photoUrls: IMG.mummyBag,
  },
  {
    key: 'sleeping-summer',
    name: 'Túi Ngủ Mùa Hè Siêu Mỏng (Không đủ ấm đêm - Sẽ cảnh báo R20)',
    category: GearCategory.SLEEPING_BAG,
    brand: 'OEM',
    condition: GearCondition.GOOD,
    attributes: {
      temp_rating_c: 24, // > nhiệt độ đêm núi -> R20 cảnh báo mất ngủ vì lạnh
      weight_g: 500,
    },
    photoUrls: IMG.thinBag,
  },
  {
    key: 'sleeping-expedition',
    name: 'Túi ngủ lông vũ -15°C 2.5kg (Quá ấm, quá nặng - Sẽ cảnh báo R22/R23)',
    category: GearCategory.SLEEPING_BAG,
    brand: 'Mountain Hardwear',
    condition: GearCondition.GOOD,
    attributes: { temp_rating_c: -15, weight_g: 2500 },
    photoUrls: IMG.mummyBag,
  },

  // ================= 6. LỀU (TENT) =================
  {
    key: 'tent-cloudup',
    name: 'Lều 2 người Naturehike Cloud Up 2 hai lớp (Đạt chuẩn)',
    category: GearCategory.TENT,
    brand: 'Naturehike',
    condition: GearCondition.GOOD,
    attributes: { sleeping_places: 2, flysheet_waterproof_mm: 4000, floor_waterproof_mm: 4000, weight_g: 1800 },
    photoUrls: IMG.tent,
  },
  {
    key: 'tent-beach',
    name: 'Lều dã ngoại bãi biển một lớp (Chống nước kém)',
    category: GearCategory.TENT,
    brand: 'OEM',
    condition: GearCondition.WORN,
    attributes: { sleeping_places: 3, flysheet_waterproof_mm: 800, floor_waterproof_mm: 1000, weight_g: 2800 },
    photoUrls: IMG.domeTent,
  },

  // ================= 7. GẬY LEO NÚI (TREKKING_POLE) =================
  {
    key: 'pole-bd',
    name: 'Gậy Leo Núi Chống Sốc Black Diamond Trail Pro (Đạt chuẩn)',
    category: GearCategory.TREKKING_POLE,
    brand: 'Black Diamond',
    condition: GearCondition.GOOD,
    attributes: { adjustable: true, length_min_cm: 65, length_max_cm: 140, weight_g: 540 },
    photoUrls: IMG.poles,
  },
  {
    key: 'pole-wood',
    name: 'Gậy gỗ tự làm, không chỉnh độ dài',
    category: GearCategory.TREKKING_POLE,
    brand: 'Tự làm',
    condition: GearCondition.WORN,
    attributes: { adjustable: false, length_min_cm: 115, length_max_cm: 115, weight_g: 700 },
    photoUrls: IMG.woodPole,
  },

  // ================= 8. ĐỒ ĐI MƯA (RAIN_GEAR) =================
  {
    key: 'rain-suit',
    name: 'Bộ quần áo mưa chống nước 10.000mm (Đạt chuẩn)',
    category: GearCategory.RAIN_GEAR,
    brand: 'Rando',
    condition: GearCondition.GOOD,
    attributes: { waterproof_mm: 10000, coverage: 'FULL_BODY', weight_g: 450 },
    photoUrls: IMG.rainSuit,
  },
  {
    key: 'rain-poncho',
    name: 'Áo mưa cánh dơi nilon (Chỉ che thân trên, chống nước kém)',
    category: GearCategory.RAIN_GEAR,
    brand: 'OEM',
    condition: GearCondition.WORN,
    attributes: { waterproof_mm: 1500, coverage: 'UPPER_BODY', weight_g: 150 },
    photoUrls: IMG.poncho,
  },
]

/** Chỉ tạo dữ liệu demo còn thiếu, không sửa dữ liệu có sẵn. */
export async function seedGearDemo(client: PrismaClient, userId: string, tripId?: string) {
  const user = await client.user.findUnique({ where: { id: userId }, select: { id: true, status: true } })
  if (!user || user.status !== 'ACTIVE') throw new Error('Không tìm thấy tài khoản ACTIVE với userId đã chỉ định.')
  if (tripId) {
    const context = await new PrismaTripContextReadAdapter(client as PrismaService).getTripContext(tripId, userId)
    console.log(
      'Chuyến hợp lệ:',
      context.tripId,
      'số ngày:',
      context.days,
      'độ khó:',
      context.difficulty,
      'địa hình:',
      context.terrain.join(', '),
    )
  }
  const existingRules = await client.gearRequirementRule.findMany()
  const canonical = new Map(GEAR_RULE_METADATA_REGISTRY.map((rule) => [rule.id, rule]))
  const conflicts = existingRules.filter((rule) => {
    const expected = canonical.get(rule.id)
    if (!expected) return rule.isActive
    return (
      rule.isActive !== expected.isActive ||
      rule.category !== expected.category ||
      rule.defaultVerdict !== expected.defaultVerdict ||
      rule.templateVi !== expected.templateVi ||
      rule.ruleVersion !== expected.ruleVersion
    )
  })
  if (conflicts.length) {
    throw new Error(
      'Quy tắc Gear không khớp cấu hình chuẩn: ' +
        conflicts.map((rule) => rule.id).join(', ') +
        '. Kiểm tra cấu hình trước khi seed; script không ghi đè quy tắc.',
    )
  }
  const result = await client.$transaction(async (tx) => {
    const rules = await tx.gearRequirementRule.createMany({
      data: GEAR_RULE_METADATA_REGISTRY.map((rule) => ({
        id: rule.id,
        category: rule.category as any,
        defaultVerdict: rule.defaultVerdict as any,
        templateVi: rule.templateVi,
        isActive: rule.isActive,
        ruleVersion: rule.ruleVersion,
      })),
      skipDuplicates: true,
    })
    let created = 0
    for (const item of CANONICAL_SAMPLE_GEAR_ITEMS) {
      const name = item.name
      // Nhận diện cả tên của các lần seed cũ để không tạo bản sao trong tủ đồ.
      const existing = await tx.userGearItem.findFirst({
        where: { userId, name: { in: [name, `[DEMO] ${name}`] } },
        select: { id: true },
      })
      if (existing) continue
      await tx.userGearItem.create({
        data: {
          userId,
          name,
          category: item.category,
          brand: item.brand,
          condition: item.condition,
          attributes: item.attributes,
          source: GearItemSource.MANUAL,
        },
      })
      created++
    }
    return { rules: rules.count, items: created }
  })
  console.log('Hoàn tất: thêm', result.rules, 'quy tắc và', result.items, 'món demo cho tài khoản', userId)
  console.log('Chạy lại giữ nguyên món demo đã tồn tại; không cập nhật chuyến đi, thành viên hay sản phẩm thuê.')
  if (!tripId) console.log('Để kiểm tra quyền và dữ kiện chuyến demo, truyền thêm --tripId=<UUID>.')
  return result
}

/** Tải ảnh từ link ngoài lên Cloudinary: thử để Cloudinary tự kéo, không được thì tải về rồi gửi lên. */
async function uploadFirstAvailable(publicId: string, urls: string[]): Promise<UploadApiResponse | null> {
  const options = { public_id: publicId, resource_type: 'image' as const, type: 'upload' as const, overwrite: true }
  for (const url of urls) {
    try {
      return await cloudinary.uploader.upload(url, options)
    } catch {
      /* Thử tự tải về. */
    }
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'TrekGoDemoSeed/1.0 (gear demo images)' } })
      const contentType = response.headers.get('content-type') ?? ''
      if (!response.ok || !contentType.startsWith('image/')) continue
      const data = Buffer.from(await response.arrayBuffer()).toString('base64')
      return await cloudinary.uploader.upload(`data:${contentType};base64,${data}`, options)
    } catch {
      /* Thử link dự phòng tiếp theo. */
    }
  }
  return null
}

/**
 * Gắn ảnh thật cho món demo chưa có ảnh: một MediaAsset USER_GEAR (READY, chủ sở hữu = tài khoản) làm ảnh bìa.
 * Món đã có ảnh (kể cả ảnh người dùng tự tải) được giữ nguyên.
 */
export async function attachDemoPhotos(client: PrismaClient, userId: string) {
  const { MEDIA_ENABLED, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env
  if (MEDIA_ENABLED !== 'true' || !CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    console.warn('Bỏ qua ảnh: cần MEDIA_ENABLED=true và cấu hình Cloudinary trong .env (app cũng cần để hiển thị ảnh).')
    return { attached: 0, failed: 0 }
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  })

  let attached = 0
  let failed = 0
  for (const sample of CANONICAL_SAMPLE_GEAR_ITEMS) {
    const item = await client.userGearItem.findFirst({
      where: { userId, name: { in: [sample.name, `[DEMO] ${sample.name}`] } },
      select: { id: true, photoRef: true, photos: { select: { position: true } } },
    })
    if (!item || item.photoRef) continue

    const publicId = `trekgo/user-gear/demo-${userId}-${sample.key}`
    let asset = await client.mediaAsset.findUnique({
      where: { providerPublicId: publicId },
      select: { id: true, status: true, ownerUserId: true },
    })
    if (!asset || asset.status !== 'READY' || asset.ownerUserId !== userId) {
      const uploaded = await uploadFirstAvailable(publicId, sample.photoUrls)
      if (!uploaded) {
        failed++
        console.warn(`Không tải được ảnh cho "${sample.name}" (đã thử ${sample.photoUrls.length} link).`)
        continue
      }
      const now = new Date()
      const data = {
        ownerUserId: userId,
        provider: 'CLOUDINARY' as const,
        scope: 'USER_GEAR' as const,
        resourceType: 'IMAGE' as const,
        status: 'READY' as const,
        providerAssetId: uploaded.asset_id,
        deliveryType: uploaded.type,
        originalFileName: `${sample.key}.${uploaded.format}`,
        mimeType: `image/${uploaded.format === 'jpg' ? 'jpeg' : uploaded.format}`,
        format: uploaded.format,
        sizeBytes: BigInt(uploaded.bytes),
        width: uploaded.width,
        height: uploaded.height,
        secureUrl: uploaded.secure_url,
        uploadedAt: now,
        readyAt: now,
      }
      asset = asset
        ? await client.mediaAsset.update({
            where: { id: asset.id },
            data,
            select: { id: true, status: true, ownerUserId: true },
          })
        : await client.mediaAsset.create({
            data: { ...data, providerPublicId: publicId },
            select: { id: true, status: true, ownerUserId: true },
          })
    }

    const position = item.photos.some((photo) => photo.position === 0)
      ? Math.max(...item.photos.map((photo) => photo.position)) + 1
      : 0
    await client.$transaction([
      client.userGearItemPhoto.create({ data: { itemId: item.id, storageRef: asset.id, position } }),
      client.userGearItem.update({ where: { id: item.id }, data: { photoRef: asset.id, version: { increment: 1 } } }),
    ])
    attached++
  }
  console.log(`Ảnh: gắn ${attached} ảnh mới${failed ? `, ${failed} món không tải được ảnh` : ''}.`)
  return { attached, failed }
}

/** Kiểm tra catalog thật; không thay đổi sản phẩm, hồ sơ, chính sách hoặc tồn kho. */
export async function inspectRentalReadiness(client: PrismaClient, userId: string, tripId: string) {
  const trip = await new PrismaTripContextReadAdapter(client as PrismaService).getTripContext(tripId, userId)
  const now = new Date()
  const policy = await client.rentalPolicy.findFirst({
    where: { isActive: true, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] },
    orderBy: [{ effectiveFrom: 'desc' }, { versionNo: 'desc' }],
  })
  if (!policy) throw new Error('Không có chính sách thuê đang hiệu lực; cần cấu hình chính sách thật trước khi demo.')
  const context = {
    pickup: { scheduledAt: trip.startAt },
    dropoff: { scheduledAt: trip.endAt },
    activePolicy: {
      returnBufferMinutes: Number(policy.returnBufferMinutes),
      cleaningBufferMinutes: Number(policy.cleaningBufferMinutes),
      deepInspectionBufferMinutes: policy.deepInspectionBufferMinutes == null ? undefined : Number(policy.deepInspectionBufferMinutes),
    },
  } as any
  // Áp dụng cùng kiểm tra buffer với luồng gợi ý thuê.
  calculateOccupiedWindow(context, trip.endAt)
  if (policy.deepInspectionBufferMinutes != null && (!Number.isSafeInteger(Number(policy.deepInspectionBufferMinutes)) || Number(policy.deepInspectionBufferMinutes) < 2880)) {
    throw new Error('Chính sách thuê có deepInspectionBufferMinutes không hợp lệ (tối thiểu 2880).')
  }
  const slugs = ['ao-mua-chong-thoi-tiet', 'giay-leo-nui', 'balo-trekking', 'tui-ngu-dem-cach-nhiet', 'leu-trai', 'gay-trekking']
  const categoriesForSlug: Record<string, GearCategory[]> = {
    'ao-mua-chong-thoi-tiet': [GearCategory.JACKET, GearCategory.RAIN_GEAR],
    'giay-leo-nui': [GearCategory.FOOTWEAR],
    'balo-trekking': [GearCategory.BACKPACK],
    'tui-ngu-dem-cach-nhiet': [GearCategory.SLEEPING_BAG],
    'leu-trai': [GearCategory.TENT],
    'gay-trekking': [GearCategory.TREKKING_POLE],
  }
  const categories = await client.rentalCategory.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } })
  const missingCategories = slugs.filter((slug) => !categories.some((category) => category.slug === slug))
  if (missingCategories.length) console.warn(`Thiếu danh mục thuê: ${missingCategories.join(', ')}`)
  let available = 0
  let missingProfiles = 0
  for (const category of categories) {
    // Cùng thứ tự và giới hạn ứng viên mặc định với Gear Advisor.
    const products = await client.rentalProduct.findMany({
      where: { categoryId: category.id, status: 'ACTIVE' },
      include: { technicalProfile: true },
      orderBy: [{ dailyPrice: 'asc' }, { id: 'asc' }], take: 20,
    })
    for (const product of products) {
      if (!product.technicalProfile) {
        missingProfiles++
        console.warn(`SKU ${product.sku} thiếu hồ sơ kỹ thuật.`)
      } else if (!categoriesForSlug[category.slug].includes(product.technicalProfile.category)) {
        console.warn(`SKU ${product.sku} có nhóm hồ sơ không khớp danh mục thuê; bỏ qua.`)
        continue
      }
      const attributes = product.technicalProfile?.attributes as Record<string, unknown> | null
      try {
        const window = calculateOccupiedWindow(context, trip.endAt, attributes?.requires_deep_inspection === true || (product as any).requiresDeepInspectionAfterReturn === true)
        const snapshot = await getVerifiedCapacitySnapshot(client, { productId: product.id, ...window, now })
        if (snapshot.availableCount > 0) available++
      } catch {
        console.warn(`Không thể xác minh tồn kho của SKU ${product.sku}; bỏ qua khi đếm.`)
      }
    }
  }
  console.log(`Catalog: ${available} ứng viên có tồn kho xác minh; ${missingProfiles} ứng viên thiếu hồ sơ kỹ thuật.`)
  if (!available) console.warn('Chưa tìm thấy ứng viên có tồn kho xác minh cho khoảng thời gian chuyến đi.')
  if (missingProfiles) console.warn('Chạy `npm run seed:product-profiles` để nạp hồ sơ kỹ thuật cho sản phẩm seed.')
  console.log('Tồn kho và khả năng đáp ứng còn phụ thuộc yêu cầu cụ thể, thời tiết, các lượt giữ hàng và thời điểm tạo gợi ý.')
  return { available, missingProfiles }
}

if (require.main === module) {
  const argument = (name: string) =>
    process.argv.find((arg) => arg.startsWith('--' + name + '='))?.slice(name.length + 3)
  const email = argument('email')
  const tripId = argument('tripId')
  const withPhotos = !process.argv.includes('--no-photos')
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const usage = 'Cách dùng: npm run seed:gear-demo -- (--email=<email> | --userId=<UUID>) [--tripId=<UUID>] [--no-photos]'
  ;(async () => {
    let userId = argument('userId')
    if (!userId && email) {
      const user = await prisma.user.findFirst({ where: { email: email.trim().toLowerCase() }, select: { id: true } })
      if (!user) throw new Error(`Không tìm thấy tài khoản với email ${email}.`)
      userId = user.id
    }
    if (!userId || !uuid.test(userId) || (tripId && !uuid.test(tripId))) throw new Error(usage)
    if (tripId) await inspectRentalReadiness(prisma, userId, tripId)
    await seedGearDemo(prisma, userId, tripId)
    if (withPhotos) await attachDemoPhotos(prisma, userId)
  })()
    .catch((error) => {
      console.error('Không thể seed Gear demo:', error.message)
      process.exitCode = 1
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
