/**
 * Demo hạn dùng và hao mòn thiết bị. Chạy trên DB trong `.env` (DIRECT_URL, không có thì DATABASE_URL).
 *
 * Tự tạo sản phẩm demo riêng (không sửa sản phẩm có sẵn) rồi tạo thiết bị cho từng kịch bản:
 * - `DEMO-HSD-FILTER` (lõi lọc nước, không ngưỡng hao mòn), lô `LO-DEMO-HSD`:
 *   5 món có hạn dùng hôm nay / +3 / +10 / +25 / +120 ngày. Món hết hạn hôm nay bị job đầu giờ chuyển Ngừng sử dụng.
 * - Nhóm hạng `DEMO-HM-TENT-LN` / `DEMO-HM-TENT-GU` (lều, ngưỡng 5 lượt dùng chung nhóm), lô `LO-DEMO-HAO-MON`:
 *   3/5 lượt, 4/5 lượt (lượt cuối) và 5/5 lượt đang bảo trì vì đạt ngưỡng.
 *
 * Cần chạy `npx prisma db seed` trước (danh mục + kho chính). Chạy lại được: sản phẩm demo được đặt lại giá,
 * ngưỡng và trạng thái ACTIVE; món demo đang nằm kho (AVAILABLE / MAINTENANCE / RETIRED) được đặt lại kịch bản;
 * món đang gắn với đơn thuê thì bỏ qua để không làm hỏng đơn.
 *
 * Lưu ý: `npx prisma db seed` trên localhost chuyển mọi sản phẩm ngoài danh sách seed sang INACTIVE,
 * gồm cả sản phẩm demo này — chạy lại script này để mở lại.
 *
 *   npm run seed:equipment-lifecycle-demo
 */
import 'dotenv/config'
import {
  DepositPolicyType,
  EquipmentCondition,
  EquipmentUnitStatus,
  Prisma,
  PrismaClient,
  RecordStatus,
  RentalGrade,
  RentalProductStatus,
} from '@prisma/client'
import {
  WEAR_LIMIT_MAINTENANCE_REASON,
  vnCalendarDate,
} from '../src/modules/rental/inventory/application/services/equipment-lifecycle.rules'
import { PRIMARY_RENTAL_LOCATION_CODE } from './seeds/equipment-unit.seed'
import { rentalSeedImage } from './seeds/rental-product.seed'

const url = process.env.DIRECT_URL || process.env.DATABASE_URL
const prisma = new PrismaClient({ datasources: { db: { url } } })

const SHELF_LIFE_BATCH = 'LO-DEMO-HSD'
const WEAR_BATCH = 'LO-DEMO-HAO-MON'
const WEAR_LIMIT = 5
/** Nhóm hạng cố định để chạy lại không tạo nhóm mới. */
const DEMO_TENT_GRADE_GROUP = '5d2f7c1a-3b4e-4f60-8a71-0c9e2b6d4a99'

type DemoProduct = {
  sku: string
  categorySlug: string
  imageSku: string
  name: string
  description: string
  dailyPrice: number
  replacementValue: number
  depositValue: number
  usageGroup: string
  specifications: Prisma.InputJsonObject
  recommendationTags: string[]
  requiredAccessories: string[]
  requiresDeepReturnInspection: boolean
  maxRentalCycles: number | null
  gradeGroupId?: string
  grade?: RentalGrade
}

const TENT_BASE = {
  categorySlug: 'leu-trai',
  imageSku: 'TENT-G3-LN',
  replacementValue: 3_000_000,
  usageGroup: 'SHELTER',
  specifications: { capacity: 3, weightKg: 3.2, waterproofMm: 3000, layers: 2 },
  recommendationTags: ['MULTI_DAY', 'RAIN_READY'],
  requiredAccessories: ['Khung lều', 'Tấm phủ mưa', 'Cọc lều', 'Dây neo', 'Túi đựng'],
  requiresDeepReturnInspection: true,
  // Ngưỡng hao mòn dùng chung cả nhóm hạng (cùng quy tắc backend).
  maxRentalCycles: WEAR_LIMIT,
  gradeGroupId: DEMO_TENT_GRADE_GROUP,
}

const DEMO_PRODUCTS: DemoProduct[] = [
  {
    sku: 'DEMO-HSD-FILTER',
    categorySlug: 'nau-an-xu-ly-nuoc',
    imageSku: 'WATER-001',
    name: 'Bộ lọc nước có hạn dùng lõi lọc (demo)',
    description: 'Sản phẩm demo hạn dùng: mỗi bộ lọc có hạn dùng lõi lọc riêng theo lô nhập.',
    dailyPrice: 80_000,
    replacementValue: 1_200_000,
    depositValue: 360_000,
    usageGroup: 'WATER',
    specifications: { filterLifeLiters: 1000, poreMicron: 0.1 },
    recommendationTags: ['MULTI_DAY'],
    requiredAccessories: ['Túi chứa nước', 'Ống hút'],
    requiresDeepReturnInspection: false,
    maxRentalCycles: null,
  },
  {
    ...TENT_BASE,
    sku: 'DEMO-HM-TENT-LN',
    grade: RentalGrade.LIKE_NEW,
    name: 'Lều 3 người demo hao mòn – Rất mới',
    description: 'Sản phẩm demo hao mòn: đạt 5 lượt thuê thì kho nhận về sẽ tự chuyển bảo trì.',
    dailyPrice: 140_000,
    depositValue: 900_000,
  },
  {
    ...TENT_BASE,
    sku: 'DEMO-HM-TENT-GU',
    grade: RentalGrade.GOOD_USED,
    name: 'Lều 3 người demo hao mòn – Đã sử dụng tốt',
    description: 'Sản phẩm demo hao mòn, hạng Sử dụng tốt (cùng ngưỡng 5 lượt với hạng Rất mới).',
    dailyPrice: 100_000,
    depositValue: 600_000,
  },
]

/** Món đã gắn đơn thuê thì không đụng tới. */
const ACTIVE_ASSIGNMENT_STATUSES = ['ASSIGNED', 'PACKED', 'HANDED_OVER', 'RETURNED'] as const
const RESETTABLE_STATUSES: EquipmentUnitStatus[] = [
  EquipmentUnitStatus.AVAILABLE,
  EquipmentUnitStatus.MAINTENANCE,
  EquipmentUnitStatus.RETIRED,
]

type Scenario = {
  assetCode: string
  sku: string
  batch: string
  status: EquipmentUnitStatus
  expiresAt: Date | null
  rentalCount: number
  conditionNotes: string
  wearMaintenance?: boolean
}

function addDays(day: Date, days: number) {
  return new Date(day.getTime() + days * 86_400_000)
}

function formatDay(day: Date | null) {
  return day ? day.toISOString().slice(0, 10).split('-').reverse().join('/') : 'không có hạn'
}

async function upsertDemoProducts(): Promise<Map<string, string>> {
  const slugs = [...new Set(DEMO_PRODUCTS.map((product) => product.categorySlug))]
  const categories = await prisma.rentalCategory.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true },
  })
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category.id]))
  const missing = slugs.filter((slug) => !categoryBySlug.has(slug))
  if (missing.length > 0) throw new Error(`Thiếu danh mục ${missing.join(', ')}. Chạy \`npx prisma db seed\` trước.`)

  const idBySku = new Map<string, string>()
  for (const product of DEMO_PRODUCTS) {
    const { sku, categorySlug, imageSku, gradeGroupId, grade, ...rest } = product
    const data = {
      ...rest,
      categoryId: categoryBySlug.get(categorySlug)!,
      currency: 'VND',
      depositPolicyType: DepositPolicyType.FIXED,
      images: [rentalSeedImage(imageSku)],
      gradeGroupId: gradeGroupId ?? null,
      grade: grade ?? null,
      status: RentalProductStatus.ACTIVE,
    }
    const saved = await prisma.rentalProduct.upsert({
      where: { sku },
      update: { ...data, version: { increment: 1 } },
      create: { sku, ...data },
      select: { id: true },
    })
    idBySku.set(sku, saved.id)
    console.log(`Sản phẩm ${sku}: ${product.name} · ngưỡng hao mòn ${product.maxRentalCycles ?? 'không giới hạn'}`)
  }
  return idBySku
}

async function main() {
  const location = await prisma.inventoryLocation.findUnique({
    where: { code: PRIMARY_RENTAL_LOCATION_CODE },
    select: { id: true, status: true },
  })
  if (!location || location.status !== RecordStatus.ACTIVE)
    throw new Error(`Thiếu kho chính ${PRIMARY_RENTAL_LOCATION_CODE}. Chạy \`npx prisma db seed\` trước.`)

  const productIdBySku = await upsertDemoProducts()

  const today = vnCalendarDate(new Date())
  const scenarios: Scenario[] = [
    { days: 0, note: 'Hết hạn hôm nay: job đầu giờ sẽ chuyển Ngừng sử dụng.' },
    { days: 3, note: 'Còn 3 ngày: chỉ cho thuê đơn trả trước ngày hết hạn.' },
    { days: 10, note: 'Còn 10 ngày: badge "Sắp hết hạn".' },
    { days: 25, note: 'Còn 25 ngày: vẫn nằm trong bộ lọc 30 ngày.' },
    { days: 120, note: 'Còn 120 ngày: đối chứng, không cảnh báo.' },
  ].map((item, index) => ({
    assetCode: `DEMO-HSD-0${index + 1}`,
    sku: 'DEMO-HSD-FILTER',
    batch: SHELF_LIFE_BATCH,
    status: EquipmentUnitStatus.AVAILABLE,
    expiresAt: addDays(today, item.days),
    rentalCount: 0,
    conditionNotes: `[DEMO] Lõi lọc mới. ${item.note}`,
  }))
  scenarios.push(
    {
      assetCode: 'DEMO-HM-01',
      sku: 'DEMO-HM-TENT-LN',
      batch: WEAR_BATCH,
      status: EquipmentUnitStatus.AVAILABLE,
      expiresAt: null,
      rentalCount: 3,
      conditionNotes: '[DEMO] 3/5 lượt thuê: chưa cảnh báo.',
    },
    {
      assetCode: 'DEMO-HM-02',
      sku: 'DEMO-HM-TENT-LN',
      batch: WEAR_BATCH,
      status: EquipmentUnitStatus.AVAILABLE,
      expiresAt: null,
      rentalCount: WEAR_LIMIT - 1,
      conditionNotes: '[DEMO] 4/5 lượt: lượt thuê tới là lượt cuối, kho nhận về sẽ tự chuyển bảo trì.',
    },
    {
      assetCode: 'DEMO-HM-03',
      sku: 'DEMO-HM-TENT-LN',
      batch: WEAR_BATCH,
      status: EquipmentUnitStatus.MAINTENANCE,
      expiresAt: null,
      rentalCount: WEAR_LIMIT,
      conditionNotes: '[DEMO] 5/5 lượt: đang bảo trì vì đạt ngưỡng, thử "Dùng tiếp" hoặc "Ngừng sử dụng".',
      wearMaintenance: true,
    },
    {
      assetCode: 'DEMO-HM-04',
      sku: 'DEMO-HM-TENT-GU',
      batch: WEAR_BATCH,
      status: EquipmentUnitStatus.AVAILABLE,
      expiresAt: null,
      rentalCount: 2,
      conditionNotes: '[DEMO] Hạng Sử dụng tốt, 2/5 lượt: cùng ngưỡng với hạng Rất mới.',
    },
  )

  const staff = await prisma.user.findFirst({
    where: { role: 'STAFF_INVENTORY', status: 'ACTIVE' },
    select: { id: true },
  })

  for (const scenario of scenarios) {
    const existing = await prisma.equipmentUnit.findUnique({
      where: { assetCode: scenario.assetCode },
      select: {
        id: true,
        status: true,
        rentalUnitAssignmentsViaEquipmentUnitId: {
          where: { status: { in: [...ACTIVE_ASSIGNMENT_STATUSES] } },
          select: { id: true },
        },
      },
    })
    if (
      existing &&
      (!RESETTABLE_STATUSES.includes(existing.status) || existing.rentalUnitAssignmentsViaEquipmentUnitId.length > 0)
    ) {
      console.log(`Bỏ qua ${scenario.assetCode}: đang gắn với đơn thuê (${existing.status}).`)
      continue
    }

    const data = {
      productId: productIdBySku.get(scenario.sku)!,
      homeInventoryLocationId: location.id,
      currentInventoryLocationId: location.id,
      status: scenario.status,
      condition: EquipmentCondition.GOOD,
      intakeBatchCode: scenario.batch,
      expiresAt: scenario.expiresAt,
      conditionNotes: scenario.conditionNotes,
      rentalCount: scenario.rentalCount,
      retiredAt: null,
      expectedReadyAt: null,
    }
    const unit = existing
      ? await prisma.equipmentUnit.update({
          where: { id: existing.id },
          data: { ...data, version: { increment: 1 } },
          select: { id: true },
        })
      : await prisma.equipmentUnit.create({
          data: {
            ...data,
            assetCode: scenario.assetCode,
            qrCode: `TREKGO:UNIT:${scenario.assetCode}`,
            acquiredAt: addDays(today, -180),
          },
          select: { id: true },
        })

    // Một phiếu bảo trì đang mở cho món đạt ngưỡng; các phiếu mở khác (từ lần chạy trước) được đóng.
    const openRecords = await prisma.maintenanceRecord.findMany({
      where: { unitId: unit.id, status: 'IN_PROGRESS' },
      select: { id: true, reason: true },
    })
    const keep = scenario.wearMaintenance
      ? openRecords.find((record) => record.reason === WEAR_LIMIT_MAINTENANCE_REASON)
      : undefined
    const stale = openRecords.filter((record) => record.id !== keep?.id)
    if (stale.length > 0) {
      await prisma.maintenanceRecord.updateMany({
        where: { id: { in: stale.map((record) => record.id) } },
        data: { status: 'COMPLETED', completedAt: new Date(), notes: '[DEMO] Đóng khi chạy lại seed.' },
      })
    }
    if (scenario.wearMaintenance && !keep) {
      await prisma.maintenanceRecord.create({
        data: {
          unitId: unit.id,
          inventoryLocationId: location.id,
          staffId: staff?.id ?? null,
          reason: WEAR_LIMIT_MAINTENANCE_REASON,
          notes: `SYSTEM: ${scenario.rentalCount}/${WEAR_LIMIT} rental cycles`,
          status: 'IN_PROGRESS',
          startAt: new Date(),
        },
      })
    }

    console.log(
      `${existing ? 'Đặt lại' : 'Tạo'} ${scenario.assetCode} (${scenario.sku}): ${scenario.status}, ` +
        `hạn ${formatDay(scenario.expiresAt)}, ${scenario.rentalCount} lượt thuê`,
    )
  }

  console.log(`Xem ở /staff/inventory: lọc mã lô ${SHELF_LIFE_BATCH} hoặc ${WEAR_BATCH}.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
