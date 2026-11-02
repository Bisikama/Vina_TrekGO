import { DepositPolicyType, PrismaClient, RentalGrade, RentalProductStatus } from '@prisma/client'
import { createHash } from 'node:crypto'

export interface RentalProductSeed {
  /** Có cả hai = sản phẩm thuộc một nhóm hạng; không có = sản phẩm thường. */
  gradeGroupId?: string
  grade?: RentalGrade
  id?: string
  categorySlug: string
  sku: string
  name: string
  description: string
  dailyPrice: number
  replacementValue: number
  depositValue: number
  usageGroup: string
  specifications: Record<string, string | number | boolean | string[]>
  recommendationTags: string[]
  requiredAccessories: string[]
  requiresDeepReturnInspection: boolean
}

export const GRADE_GROUP_TENT_3P = '5d2f7c1a-3b4e-4f60-8a71-0c9e2b6d4a01'
export const GRADE_GROUP_PACK_45L = '5d2f7c1a-3b4e-4f60-8a71-0c9e2b6d4a02'

// Ảnh minh hoạ theo loại đồ, không khẳng định đây là ảnh của mẫu hoặc thông số cụ thể.
// URL công khai giúp seed chạy trên các máy local mà không cần Cloudinary riêng.
const IMAGE_BY_SKU_PREFIX: Record<string, string> = {
  TENT: 'https://marmote.fr/cdn/shop/products/Tentesdesertfox_1.png?v=1659371645',
  TARP: 'https://www.trail.co.uk/cdn/shop/files/TR0131-GY_3x4_TARP_SHELTER_POLED_25_AI_01-v2.jpg?v=1752653762&width=1600',
  PACK: 'https://cdn.shopify.com/s/files/1/0563/8628/9833/products/79548_5743_pathway60_front34_1_1200x.jpg?v=1636642301',
  SLEEP: 'https://cdn.media.amplience.net/i/frasersdev/40412805_o.jpg?v=20260416103058',
  MAT: 'https://www.kingcamp.com/cdn/shop/products/SLEEPINGPADS_1_74c87e79-8860-4d89-b385-b459e7b9259c_1200x1200.jpg?v=1691477451',
  SHOE: 'https://toreadgear.com/cdn/shop/files/TFAABL91762-K676-_1_1120x.png?v=1743663673',
  POLE: 'https://www.driftersshop.co.za/cdn/shop/files/FirstAscentIncaTrekkingPoleTwinPack2_1600x.jpg?v=1710417533',
  'RAIN-001': 'https://img.91app.com/webapi/imagesV3/Original/SalePage/11141022/0/638943208917670000?v=1',
  'RAIN-002': 'https://mediahub.debenhams.com/m5055805342027_yellow_xl.jpeg',
  'RAIN-003': 'https://shopping.c.yimg.jp/lib/arukikata-travel/24810193.jpg',
  'LIGHT-001': 'https://marine-deals-io.freetls.fastly.net/media/catalog/product/2/2/220244_1_pc.jpg?dpr=2&filter=lanczos&fit=bounds&format=webp&height=500&width=500',
  'LIGHT-002': 'https://www.torchdirect.co.uk/cdn/shop/files/Nitecore-LR40-LED-Lantern-Power-Bank-2.jpg?v=1689203293&width=1214',
  POWER: 'https://geekles.net/images/uploads/2014/06/img60436664-640x640.jpg',
  STOVE: 'https://kbmoutdoors.ca/cdn/shop/products/P321461_Micron_1_1024x1024_0515bfff-b832-43b9-bbe6-15dfa588defb.jpg?v=1624388914',
  COOK: 'https://target.scene7.com/is/image/Target/GUEST_1a679a24-15f9-4771-adcb-18f4742551c0',
  WATER: 'https://bachgold-outdoor.com/cdn/shop/files/Hero_Images_-_Grey_-_500ml_-_op_3.jpg?v=1759385003&width=3000',
  NAV: 'https://venturehunting.com.au/cdn/shop/files/6417084121189_Suunto-A-30-Sh-Metric-Compass_1.jpg?v=1728958453',
  TOOL: 'https://i5.walmartimages.com/asr/6f2294fa-6ee3-4093-8991-54a7a4524bce.4315c50c0c266ce228a2bd4f9890e3a6.jpeg',
  GPS: 'https://bilder.frankonia.de/fsicache/server?effects=pad%28CC%2Cffff%29&height=1000&quality=40&source=products%2Fp2017735_d8.jpg&type=image&width=1000',
}

export function rentalSeedImage(sku: string): string {
  const baseSku = sku.endsWith('-GU') ? sku.slice(0, -3) : sku
  const url = IMAGE_BY_SKU_PREFIX[baseSku] ?? IMAGE_BY_SKU_PREFIX[sku] ?? IMAGE_BY_SKU_PREFIX[sku.split('-')[0]]
  if (!url) throw new Error(`Missing illustrative image for rental product ${sku}`)
  return url
}

const BASE_RENTAL_PRODUCT_SEEDS: readonly RentalProductSeed[] = [
  {
    id: 'aaaaaa11-1111-1111-1111-111111111111',
    categorySlug: 'leu-trai',
    sku: 'TENT-001',
    name: 'Lều trekking 4 người chống mưa',
    description: 'Lều hai lớp cho nhóm 3–4 người, phù hợp cắm trại trekking nhiều ngày.',
    dailyPrice: 120_000,
    replacementValue: 2_500_000,
    depositValue: 750_000,
    usageGroup: 'SHELTER',
    specifications: { capacity: 4, weightKg: 4.2, waterproofMm: 3000, layers: 2 },
    recommendationTags: ['MULTI_DAY', 'RAIN_READY'],
    requiredAccessories: ['Khung lều', 'Tấm phủ mưa', 'Cọc lều', 'Dây neo', 'Túi đựng'],
    requiresDeepReturnInspection: true,
  },
  {
    categorySlug: 'leu-trai',
    sku: 'TENT-002',
    name: 'Lều trekking 2 người siêu nhẹ',
    description: 'Lều hai lớp gọn nhẹ dành cho 1–2 người ưu tiên giảm tải hành lý.',
    dailyPrice: 150_000,
    replacementValue: 3_500_000,
    depositValue: 1_050_000,
    usageGroup: 'SHELTER',
    specifications: { capacity: 2, weightKg: 2.1, waterproofMm: 4000, layers: 2 },
    recommendationTags: ['MULTI_DAY', 'MODERATE_TRAIL', 'RAIN_READY', 'LIGHTWEIGHT'],
    requiredAccessories: ['Khung lều', 'Tấm phủ mưa', 'Cọc lều', 'Dây neo', 'Túi đựng'],
    requiresDeepReturnInspection: true,
  },
  {
    categorySlug: 'leu-trai',
    sku: 'TARP-001',
    name: 'Tăng dã ngoại chống mưa 3 x 3 m',
    description: 'Tấm tăng tạo khu sinh hoạt chung và che mưa nắng tại điểm cắm trại.',
    dailyPrice: 70_000,
    replacementValue: 1_200_000,
    depositValue: 360_000,
    usageGroup: 'SHELTER',
    specifications: { widthM: 3, lengthM: 3, waterproofMm: 3000, weightKg: 1.4 },
    recommendationTags: ['MULTI_DAY', 'RAIN_READY'],
    requiredAccessories: ['Tấm tăng', 'Cọc', 'Dây neo', 'Túi đựng'],
    requiresDeepReturnInspection: true,
  },
  {
    categorySlug: 'balo-trekking',
    sku: 'PACK-001',
    name: 'Balo trekking 40L',
    description: 'Balo trợ lực cỡ vừa cho chuyến trekking một đến hai ngày.',
    dailyPrice: 80_000,
    replacementValue: 1_800_000,
    depositValue: 540_000,
    usageGroup: 'CARRY',
    specifications: { capacityLiters: 40, weightKg: 1.35, rainCoverIncluded: true },
    recommendationTags: ['MODERATE_TRAIL', 'RAIN_READY'],
    requiredAccessories: ['Áo trùm mưa balo'],
    requiresDeepReturnInspection: false,
  },
  {
    categorySlug: 'balo-trekking',
    sku: 'PACK-002',
    name: 'Balo trekking 55L',
    description: 'Balo trợ lực dung tích lớn cho hành trình nhiều ngày và mang đồ cắm trại.',
    dailyPrice: 110_000,
    replacementValue: 2_600_000,
    depositValue: 780_000,
    usageGroup: 'CARRY',
    specifications: { capacityLiters: 55, weightKg: 1.75, rainCoverIncluded: true },
    recommendationTags: ['MULTI_DAY', 'MODERATE_TRAIL', 'RAIN_READY'],
    requiredAccessories: ['Áo trùm mưa balo'],
    requiresDeepReturnInspection: false,
  },
  {
    categorySlug: 'balo-trekking',
    sku: 'PACK-003',
    name: 'Balo leo núi 20L trong ngày',
    description: 'Balo gọn nhẹ cho chuyến đi trong ngày, có ngăn túi nước và dây cố định gậy.',
    dailyPrice: 50_000,
    replacementValue: 900_000,
    depositValue: 270_000,
    usageGroup: 'CARRY',
    specifications: { capacityLiters: 20, weightKg: 0.75, hydrationCompatible: true },
    recommendationTags: ['MODERATE_TRAIL', 'LIGHTWEIGHT'],
    requiredAccessories: [],
    requiresDeepReturnInspection: false,
  },
  {
    categorySlug: 'tui-ngu-dem-cach-nhiet',
    sku: 'SLEEP-001',
    name: 'Túi ngủ trekking 10°C',
    description: 'Túi ngủ ba mùa cho điều kiện nhiệt độ ôn hòa, có túi nén đi kèm.',
    dailyPrice: 70_000,
    replacementValue: 1_200_000,
    depositValue: 360_000,
    usageGroup: 'SLEEP',
    specifications: { comfortTemperatureC: 10, limitTemperatureC: 5, weightKg: 1.1 },
    recommendationTags: ['MULTI_DAY'],
    requiredAccessories: ['Túi nén'],
    requiresDeepReturnInspection: false,
  },
  {
    categorySlug: 'tui-ngu-dem-cach-nhiet',
    sku: 'SLEEP-002',
    name: 'Túi ngủ trekking 0°C',
    description: 'Túi ngủ giữ ấm cho khu vực núi cao hoặc thời tiết lạnh.',
    dailyPrice: 100_000,
    replacementValue: 2_000_000,
    depositValue: 600_000,
    usageGroup: 'SLEEP',
    specifications: { comfortTemperatureC: 0, limitTemperatureC: -5, weightKg: 1.45 },
    recommendationTags: ['MULTI_DAY', 'COLD_WEATHER'],
    requiredAccessories: ['Túi nén'],
    requiresDeepReturnInspection: false,
  },
  {
    categorySlug: 'tui-ngu-dem-cach-nhiet',
    sku: 'MAT-001',
    name: 'Đệm hơi cách nhiệt trekking',
    description: 'Đệm hơi gọn nhẹ giúp cách ẩm và cách nhiệt khi ngủ trong lều.',
    dailyPrice: 50_000,
    replacementValue: 900_000,
    depositValue: 270_000,
    usageGroup: 'SLEEP',
    specifications: { lengthCm: 185, widthCm: 55, thicknessCm: 5, rValue: 3.2 },
    recommendationTags: ['MULTI_DAY', 'COLD_WEATHER'],
    requiredAccessories: ['Túi đựng', 'Bộ vá'],
    requiresDeepReturnInspection: true,
  },
  ...[38, 39, 40, 41, 42].map((size): RentalProductSeed => ({
    categorySlug: 'giay-leo-nui',
    sku: `SHOE-${size}`,
    name: `Giày trekking chống trượt size ${size}`,
    description: `Giày trekking cổ thấp size ${size}, đế bám địa hình và mũi giày gia cường.`,
    dailyPrice: 90_000,
    replacementValue: 1_800_000,
    depositValue: 540_000,
    usageGroup: 'FOOTWEAR',
    specifications: { euSize: size, waterproof: true, ankleType: 'LOW', terrain: ['Đường đất', 'Đá', 'Bùn nhẹ'] },
    recommendationTags: ['MODERATE_TRAIL', 'RAIN_READY'],
    requiredAccessories: ['Dây giày'],
    requiresDeepReturnInspection: false,
  })),
  {
    categorySlug: 'gay-trekking',
    sku: 'POLE-001',
    name: 'Cặp gậy trekking nhôm gấp gọn',
    description: 'Cặp gậy hợp kim nhôm điều chỉnh chiều dài, hỗ trợ đường dốc và địa hình trơn.',
    dailyPrice: 50_000,
    replacementValue: 800_000,
    depositValue: 240_000,
    usageGroup: 'MOBILITY',
    specifications: { quantity: 2, material: 'Hợp kim nhôm', minLengthCm: 65, maxLengthCm: 135 },
    recommendationTags: ['MODERATE_TRAIL'],
    requiredAccessories: ['Chụp cao su', 'Rọ chắn bùn'],
    requiresDeepReturnInspection: false,
  },
  {
    categorySlug: 'gay-trekking',
    sku: 'POLE-002',
    name: 'Cặp gậy trekking carbon siêu nhẹ',
    description: 'Cặp gậy carbon nhẹ dành cho hành trình dài cần giảm tải.',
    dailyPrice: 90_000,
    replacementValue: 1_600_000,
    depositValue: 480_000,
    usageGroup: 'MOBILITY',
    specifications: { quantity: 2, material: 'Carbon', minLengthCm: 62, maxLengthCm: 132 },
    recommendationTags: ['MULTI_DAY', 'MODERATE_TRAIL', 'LIGHTWEIGHT'],
    requiredAccessories: ['Chụp cao su', 'Rọ chắn bùn'],
    requiresDeepReturnInspection: false,
  },
  {
    categorySlug: 'ao-mua-chong-thoi-tiet',
    sku: 'RAIN-001',
    name: 'Poncho trekking phủ balo',
    description: 'Áo mưa poncho dáng rộng che được người và balo khi di chuyển.',
    dailyPrice: 30_000,
    replacementValue: 400_000,
    depositValue: 120_000,
    usageGroup: 'WEATHER_PROTECTION',
    specifications: { fit: 'FREE_SIZE', waterproofMm: 5000, coversBackpack: true },
    recommendationTags: ['RAIN_READY'],
    requiredAccessories: ['Túi đựng'],
    requiresDeepReturnInspection: false,
  },
  {
    categorySlug: 'ao-mua-chong-thoi-tiet',
    sku: 'RAIN-002',
    name: 'Áo khoác chống mưa trekking free size',
    description: 'Áo khoác chống mưa nhẹ có khe thoáng, phù hợp mặc ngoài nhiều lớp áo.',
    dailyPrice: 70_000,
    replacementValue: 1_200_000,
    depositValue: 360_000,
    usageGroup: 'WEATHER_PROTECTION',
    specifications: { fit: 'ADJUSTABLE_FREE_SIZE', waterproofMm: 10000, breathable: true },
    recommendationTags: ['MULTI_DAY', 'RAIN_READY'],
    requiredAccessories: ['Túi đựng'],
    requiresDeepReturnInspection: false,
  },
  {
    categorySlug: 'ao-mua-chong-thoi-tiet',
    sku: 'RAIN-003',
    name: 'Áo trùm mưa balo 40–60L',
    description: 'Áo trùm chống nước có dây siết, dùng cho balo trekking dung tích 40–60L.',
    dailyPrice: 20_000,
    replacementValue: 250_000,
    depositValue: 75_000,
    usageGroup: 'WEATHER_PROTECTION',
    specifications: { compatibleCapacityLiters: '40–60', waterproofMm: 5000 },
    recommendationTags: ['RAIN_READY'],
    requiredAccessories: [],
    requiresDeepReturnInspection: false,
  },
  {
    categorySlug: 'chieu-sang-nguon-dien',
    sku: 'LIGHT-001',
    name: 'Đèn đội đầu trekking 400 lumen',
    description: 'Đèn đội đầu chống nước, nhiều chế độ sáng và sạc USB-C.',
    dailyPrice: 40_000,
    replacementValue: 700_000,
    depositValue: 210_000,
    usageGroup: 'LIGHTING',
    specifications: { maxLumens: 400, waterproofRating: 'IPX6', rechargeable: true },
    recommendationTags: ['MULTI_DAY'],
    requiredAccessories: ['Dây đeo', 'Cáp sạc USB-C'],
    requiresDeepReturnInspection: true,
  },
  {
    categorySlug: 'chieu-sang-nguon-dien',
    sku: 'LIGHT-002',
    name: 'Đèn trại LED treo lều',
    description: 'Đèn LED khuếch tán dùng trong lều hoặc khu sinh hoạt chung.',
    dailyPrice: 50_000,
    replacementValue: 900_000,
    depositValue: 270_000,
    usageGroup: 'LIGHTING',
    specifications: { maxLumens: 500, waterproofRating: 'IPX5', rechargeable: true },
    recommendationTags: ['MULTI_DAY'],
    requiredAccessories: ['Móc treo', 'Cáp sạc USB-C'],
    requiresDeepReturnInspection: true,
  },
  {
    categorySlug: 'chieu-sang-nguon-dien',
    sku: 'POWER-001',
    name: 'Pin dự phòng 20.000mAh chống nước',
    description: 'Pin dự phòng dung lượng cao có vỏ chống nước cho hành trình nhiều ngày.',
    dailyPrice: 60_000,
    replacementValue: 1_200_000,
    depositValue: 360_000,
    usageGroup: 'POWER',
    specifications: { capacityMah: 20000, usbC: true, waterproofRating: 'IPX5' },
    recommendationTags: ['MULTI_DAY', 'RAIN_READY'],
    requiredAccessories: ['Cáp sạc USB-C'],
    requiresDeepReturnInspection: true,
  },
  {
    categorySlug: 'nau-an-xu-ly-nuoc',
    sku: 'STOVE-001',
    name: 'Bếp gas trekking gấp gọn',
    description: 'Bếp dã ngoại gấp gọn dùng bình gas ren tiêu chuẩn; không bao gồm nhiên liệu.',
    dailyPrice: 60_000,
    replacementValue: 1_000_000,
    depositValue: 300_000,
    usageGroup: 'COOKING',
    specifications: { fuelType: 'Bình gas ren', powerW: 3000, piezoIgnition: true },
    recommendationTags: ['MULTI_DAY'],
    requiredAccessories: ['Hộp đựng', 'Tấm chắn gió'],
    requiresDeepReturnInspection: true,
  },
  {
    categorySlug: 'nau-an-xu-ly-nuoc',
    sku: 'COOK-001',
    name: 'Bộ nồi dã ngoại 2–3 người',
    description: 'Bộ nồi nhôm gọn nhẹ gồm nồi, chảo, bát và dụng cụ gắp.',
    dailyPrice: 50_000,
    replacementValue: 800_000,
    depositValue: 240_000,
    usageGroup: 'COOKING',
    specifications: { servingCapacity: 3, material: 'Nhôm anodized', pieces: 7 },
    recommendationTags: ['MULTI_DAY'],
    requiredAccessories: ['Nồi', 'Chảo', '3 bát', 'Dụng cụ gắp', 'Túi lưới'],
    requiresDeepReturnInspection: true,
  },
  {
    categorySlug: 'nau-an-xu-ly-nuoc',
    sku: 'WATER-001',
    name: 'Bộ lọc nước dã ngoại cá nhân',
    description: 'Thiết bị lọc nước cơ học nhỏ gọn cho nguồn nước ngọt trên hành trình.',
    dailyPrice: 80_000,
    replacementValue: 1_600_000,
    depositValue: 480_000,
    usageGroup: 'WATER_TREATMENT',
    specifications: { filterMicron: 0.1, capacityLiters: 1000, flowLitersPerMinute: 1.2 },
    recommendationTags: ['MULTI_DAY', 'MODERATE_TRAIL'],
    requiredAccessories: ['Túi chứa nước', 'Ống hút', 'Ống vệ sinh'],
    requiresDeepReturnInspection: true,
  },
  {
    categorySlug: 'phu-kien-sinh-ton',
    sku: 'NAV-001',
    name: 'La bàn định hướng có thước bản đồ',
    description: 'La bàn nền trong suốt có thước tỷ lệ để hỗ trợ đọc bản đồ địa hình.',
    dailyPrice: 30_000,
    replacementValue: 500_000,
    depositValue: 150_000,
    usageGroup: 'NAVIGATION',
    specifications: { declinationAdjustment: true, luminousMarking: true, mapScale: ['1:25000', '1:50000'] },
    recommendationTags: ['MODERATE_TRAIL'],
    requiredAccessories: ['Dây đeo'],
    requiresDeepReturnInspection: false,
  },
  {
    categorySlug: 'phu-kien-sinh-ton',
    sku: 'TOOL-001',
    name: 'Dụng cụ đa năng trekking',
    description: 'Dụng cụ gấp đa năng phục vụ sửa chữa nhỏ và xử lý tình huống tại trại.',
    dailyPrice: 45_000,
    replacementValue: 900_000,
    depositValue: 270_000,
    usageGroup: 'SURVIVAL',
    specifications: { toolCount: 12, material: 'Thép không gỉ', lockingBlade: true },
    recommendationTags: ['MULTI_DAY'],
    requiredAccessories: ['Bao đựng'],
    requiresDeepReturnInspection: true,
  },
  {
    categorySlug: 'phu-kien-sinh-ton',
    sku: 'GPS-001',
    name: 'Máy định vị GPS cầm tay',
    description: 'Thiết bị GPS chống nước hỗ trợ theo dõi tuyến và xác định vị trí ngoài vùng phủ sóng.',
    dailyPrice: 140_000,
    replacementValue: 4_500_000,
    depositValue: 1_350_000,
    usageGroup: 'NAVIGATION',
    specifications: { waterproofRating: 'IPX7', batteryHours: 20, offlineMap: true },
    recommendationTags: ['MULTI_DAY', 'MODERATE_TRAIL', 'RAIN_READY'],
    requiredAccessories: ['Dây đeo', 'Cáp sạc', 'Túi bảo vệ'],
    requiresDeepReturnInspection: true,
  },
  // Cặp sản phẩm hai hạng (phần mở rộng ngoài Policy 1.5.2). Cùng replacementValue;
  // hạng Rất mới có giá ngày và cọc cao hơn hẳn (cọc ~30% / ~20% giá trị thay thế).
  {
    gradeGroupId: GRADE_GROUP_TENT_3P,
    grade: RentalGrade.LIKE_NEW,
    categorySlug: 'leu-trai',
    sku: 'TENT-G3-LN',
    name: 'Lều trekking 3 người – Rất mới',
    description: 'Lều hai lớp cho nhóm 2–3 người. Hạng Rất mới: vải và khung gần như mới, chưa có vết sửa.',
    dailyPrice: 140_000,
    replacementValue: 3_000_000,
    depositValue: 900_000,
    usageGroup: 'SHELTER',
    specifications: { capacity: 3, weightKg: 3.2, waterproofMm: 3000, layers: 2 },
    recommendationTags: ['MULTI_DAY', 'RAIN_READY'],
    requiredAccessories: ['Khung lều', 'Tấm phủ mưa', 'Cọc lều', 'Dây neo', 'Túi đựng'],
    requiresDeepReturnInspection: true,
  },
  {
    gradeGroupId: GRADE_GROUP_TENT_3P,
    grade: RentalGrade.GOOD_USED,
    categorySlug: 'leu-trai',
    sku: 'TENT-G3-GU',
    name: 'Lều trekking 3 người – Đã sử dụng tốt',
    description:
      'Lều hai lớp cho nhóm 2–3 người. Hạng Đã sử dụng tốt: có dấu hiệu sử dụng nhưng chống mưa và khung đầy đủ. Rẻ hơn cả giá thuê mỗi ngày lẫn tiền cọc.',
    dailyPrice: 100_000,
    replacementValue: 3_000_000,
    depositValue: 600_000,
    usageGroup: 'SHELTER',
    specifications: { capacity: 3, weightKg: 3.2, waterproofMm: 3000, layers: 2 },
    recommendationTags: ['MULTI_DAY', 'RAIN_READY'],
    requiredAccessories: ['Khung lều', 'Tấm phủ mưa', 'Cọc lều', 'Dây neo', 'Túi đựng'],
    requiresDeepReturnInspection: true,
  },
  {
    gradeGroupId: GRADE_GROUP_PACK_45L,
    grade: RentalGrade.LIKE_NEW,
    categorySlug: 'balo-trekking',
    sku: 'PACK-G45-LN',
    name: 'Balo trekking 45L – Rất mới',
    description: 'Balo trợ lực 45L cho chuyến 2–3 ngày. Hạng Rất mới: khoá kéo, đai và vải gần như mới.',
    dailyPrice: 90_000,
    replacementValue: 2_000_000,
    depositValue: 600_000,
    usageGroup: 'CARRY',
    specifications: { capacityLiters: 45, weightKg: 1.5, rainCoverIncluded: true },
    recommendationTags: ['MULTI_DAY', 'MODERATE_TRAIL', 'RAIN_READY'],
    requiredAccessories: ['Áo trùm mưa balo'],
    requiresDeepReturnInspection: false,
  },
  {
    gradeGroupId: GRADE_GROUP_PACK_45L,
    grade: RentalGrade.GOOD_USED,
    categorySlug: 'balo-trekking',
    sku: 'PACK-G45-GU',
    name: 'Balo trekking 45L – Đã sử dụng tốt',
    description:
      'Balo trợ lực 45L cho chuyến 2–3 ngày. Hạng Đã sử dụng tốt: vải có dấu hiệu sử dụng, đai và khoá hoạt động tốt. Rẻ hơn cả giá thuê mỗi ngày lẫn tiền cọc.',
    dailyPrice: 65_000,
    replacementValue: 2_000_000,
    depositValue: 400_000,
    usageGroup: 'CARRY',
    specifications: { capacityLiters: 45, weightKg: 1.5, rainCoverIncluded: true },
    recommendationTags: ['MULTI_DAY', 'MODERATE_TRAIL', 'RAIN_READY'],
    requiredAccessories: ['Áo trùm mưa balo'],
    requiresDeepReturnInspection: false,
  },
]

/** Mỗi mẫu có một nhóm UUID ổn định giữa các lần chạy và các database local. */
function seedGradeGroupId(sku: string): string {
  const bytes = createHash('sha256').update(`vinatrekgo:rental-grade:${sku}`).digest().subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// Giữ nguyên SKU và ID cũ cho hạng LIKE_NEW để các quan hệ hiện có vẫn trỏ tới
// sản phẩm đó. Hạng GOOD_USED là một SKU riêng cùng nhóm, với giá và cọc thấp hơn.
export const RENTAL_PRODUCT_SEEDS: readonly RentalProductSeed[] = BASE_RENTAL_PRODUCT_SEEDS.flatMap((product) => {
  if (product.gradeGroupId || product.grade) return [product]
  const gradeGroupId = seedGradeGroupId(product.sku)
  const { id: _originalId, ...usedProduct } = product
  return [
    {
      ...product, gradeGroupId, grade: RentalGrade.LIKE_NEW,
      name: `${product.name} – Rất mới`,
      description: `${product.description} Hạng Rất mới.`,
    },
    {
      ...usedProduct, gradeGroupId, grade: RentalGrade.GOOD_USED,
      sku: `${product.sku}-GU`,
      name: `${product.name} – Đã sử dụng tốt`,
      description: `${product.description} Hạng Đã sử dụng tốt, có dấu hiệu sử dụng.`,
      dailyPrice: Math.floor(product.dailyPrice * 0.75 / 1000) * 1000,
      depositValue: Math.floor(product.depositValue * 2 / 3 / 1000) * 1000,
    },
  ]
})

/**
 * Kiểm các nhóm hạng trong seed theo đúng quy tắc của Catalog, để seed sai dừng trước khi ghi DB:
 * mỗi nhóm đúng một LIKE_NEW và một GOOD_USED, cùng danh mục, cùng replacementValue,
 * LIKE_NEW có giá ngày và cọc lớn hơn hẳn GOOD_USED. Seed luôn dùng cọc FIXED.
 */
export function assertGradeSeedPairs(seeds: readonly RentalProductSeed[] = RENTAL_PRODUCT_SEEDS): void {
  const groups = new Map<string, RentalProductSeed[]>()
  for (const seed of seeds) {
    if (!seed.gradeGroupId !== !seed.grade) throw new Error(`${seed.sku}: gradeGroupId và grade phải đi cùng nhau`)
    if (seed.gradeGroupId) groups.set(seed.gradeGroupId, [...(groups.get(seed.gradeGroupId) ?? []), seed])
  }
  for (const [groupId, members] of groups) {
    const likeNew = members.filter((m) => m.grade === RentalGrade.LIKE_NEW)
    const goodUsed = members.filter((m) => m.grade === RentalGrade.GOOD_USED)
    if (members.length !== 2 || likeNew.length !== 1 || goodUsed.length !== 1)
      throw new Error(`Nhóm hạng ${groupId} phải có đúng một LIKE_NEW và một GOOD_USED`)
    const [ln, gu] = [likeNew[0], goodUsed[0]]
    if (ln.categorySlug !== gu.categorySlug) throw new Error(`Nhóm hạng ${groupId}: hai hạng khác danh mục`)
    if (ln.replacementValue !== gu.replacementValue)
      throw new Error(`Nhóm hạng ${groupId}: replacementValue hai hạng phải bằng nhau`)
    if (!(ln.dailyPrice > gu.dailyPrice) || !(ln.depositValue > gu.depositValue))
      throw new Error(`Nhóm hạng ${groupId}: LIKE_NEW phải có giá ngày và cọc lớn hơn hẳn GOOD_USED`)
  }
}

export async function seedRentalProducts(prisma: PrismaClient) {
  console.log('Seeding Rental Products...')
  assertGradeSeedPairs()

  const requiredSlugs = [...new Set(RENTAL_PRODUCT_SEEDS.map((product) => product.categorySlug))]
  const categories = await prisma.rentalCategory.findMany({
    where: { slug: { in: requiredSlugs } },
    select: { id: true, slug: true },
  })
  const categoryIdBySlug = new Map(categories.map((category) => [category.slug, category.id]))
  const missingSlugs = requiredSlugs.filter((slug) => !categoryIdBySlug.has(slug))

  if (missingSlugs.length > 0) {
    throw new Error(`Missing rental categories for product seed: ${missingSlugs.join(', ')}`)
  }

  // Fail before any writes if a seed product has no image.
  for (const product of RENTAL_PRODUCT_SEEDS) rentalSeedImage(product.sku)
  const configuredUrl = process.env.DIRECT_URL || process.env.DATABASE_URL
  let localDatabase = false
  try {
    const host = new URL(configuredUrl ?? '').hostname.toLowerCase()
    localDatabase = ['localhost', '127.0.0.1', '[::1]'].includes(host)
  } catch { /* No automatic catalog replacement without a known local URL. */ }

  await prisma.$transaction(async (tx) => {
    if (localDatabase) {
      const inactive = await tx.rentalProduct.updateMany({
        where: { sku: { notIn: RENTAL_PRODUCT_SEEDS.map((product) => product.sku) }, status: { not: RentalProductStatus.INACTIVE } },
        data: { status: RentalProductStatus.INACTIVE, version: { increment: 1 } },
      })
      console.log(`Marked ${inactive.count} non-seed local rental products INACTIVE.`)
    } else {
      console.log('Non-local or unknown database: skipping replacement of existing products.')
    }
    for (const product of RENTAL_PRODUCT_SEEDS) {
      const { id, categorySlug, sku, gradeGroupId, grade, ...data } = product
      const categoryId = categoryIdBySlug.get(categorySlug)!
      const persistedData = {
        ...data,
        gradeGroupId: gradeGroupId ?? null,
        grade: grade ?? null,
        categoryId,
        currency: 'VND',
        depositPolicyType: DepositPolicyType.FIXED,
        images: [rentalSeedImage(sku)],
        status: RentalProductStatus.ACTIVE,
      }

      await tx.rentalProduct.upsert({
        where: { sku },
        update: { ...persistedData, version: { increment: 1 } },
        create: {
          ...(id ? { id } : {}),
          sku,
          ...persistedData,
        },
      })
      console.log(`Upserted rental product: ${sku} - ${data.name}`)
    }
  }, { timeout: 60000 })

  console.log(`Seeded ${RENTAL_PRODUCT_SEEDS.length} ACTIVE rental products successfully.`)
}
