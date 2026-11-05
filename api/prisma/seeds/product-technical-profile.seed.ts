import { PrismaClient, GearCategory } from '@prisma/client'

/**
 * Seed hồ sơ kỹ thuật (ProductTechnicalProfile) cho toàn bộ sản phẩm thuê trong Rental Catalog.
 * Đây là điều kiện tiên quyết để thuật toán Gear Advisor:
 * 1. Thẩm định an toàn trang bị theo dữ kiện thời tiết và địa hình chuyến đi.
 * 2. Đưa sản phẩm vào các phương án thuê (Tiết kiệm chi phí nhất & Nhẹ nhất).
 */
export async function seedProductTechnicalProfiles(prisma: PrismaClient) {
  console.log('📦 Bắt đầu đồng bộ hồ sơ thông số kỹ thuật (ProductTechnicalProfile) cho Catalog sản phẩm thuê...')

  const products = await prisma.rentalProduct.findMany({
    include: {
      category: true,
      technicalProfile: true,
    },
  })

  let createdCount = 0
  let updatedCount = 0

  for (const product of products) {
    const slug = product.category.slug
    const specs = (product.specifications as Record<string, any>) || {}
    const nameLower = product.name.toLowerCase()

    let gearCategory: GearCategory | null = null
    let attributes: Record<string, unknown> = {}

    if (slug === 'balo-trekking') {
      gearCategory = GearCategory.BACKPACK
      const cap = typeof specs.capacityLiters === 'number' ? specs.capacityLiters : 40
      const weightG = typeof specs.weightKg === 'number' ? Math.round(specs.weightKg * 1000) : 1200
      attributes = {
        capacity_l: cap,
        rain_cover: specs.rainCoverIncluded !== false,
        waterproof: true,
        weight_g: weightG,
      }
    } else if (slug === 'ao-mua-chong-thoi-tiet') {
      if (nameLower.includes('trùm mưa balo') || product.sku.startsWith('RAIN-003')) {
        gearCategory = GearCategory.RAIN_GEAR
        attributes = {
          waterproof_mm: typeof specs.waterproofMm === 'number' ? specs.waterproofMm : 5000,
          weight_g: 100,
        }
      } else {
        // Áo khoác chống mưa hoặc Poncho chống mưa
        gearCategory = GearCategory.JACKET
        const wp = typeof specs.waterproofMm === 'number' ? specs.waterproofMm : 10000
        attributes = {
          waterproof_mm: wp,
          temp_rating_c: nameLower.includes('poncho') ? 15 : 10,
          windproof: true,
          weight_g: nameLower.includes('poncho') ? 280 : 450,
        }
      }
    } else if (slug === 'giay-leo-nui') {
      gearCategory = GearCategory.FOOTWEAR
      attributes = {
        waterproof: specs.waterproof !== false,
        ankle_support: specs.ankleType === 'HIGH' || specs.ankleType === 'MID' || true,
        grip_level: 4,
        weight_g: 850,
      }
    } else if (slug === 'tui-ngu-dem-cach-nhiet') {
      gearCategory = GearCategory.SLEEPING_BAG
      const tempC = typeof specs.comfortTempC === 'number' ? specs.comfortTempC : 10
      const weightG = typeof specs.weightKg === 'number' ? Math.round(specs.weightKg * 1000) : 800
      attributes = {
        temp_rating_c: tempC,
        weight_g: weightG,
      }
    } else if (slug === 'leu-trai') {
      gearCategory = GearCategory.TENT
      attributes = {
        capacity: typeof specs.capacity === 'number' ? specs.capacity : 2,
        waterproof_mm: typeof specs.waterproofMm === 'number' ? specs.waterproofMm : 3000,
        weight_g: typeof specs.weightKg === 'number' ? Math.round(specs.weightKg * 1000) : 2400,
      }
    } else if (slug === 'gay-trekking') {
      gearCategory = GearCategory.TREKKING_POLE
      attributes = {
        weight_g: 450,
        material: 'ALUMINUM',
      }
    }

    if (!gearCategory) {
      continue
    }

    if (!product.technicalProfile) {
      await prisma.productTechnicalProfile.create({
        data: {
          productId: product.id,
          category: gearCategory,
          attributes: attributes as any,
          version: 1,
        },
      })
      createdCount++
    } else {
      await prisma.productTechnicalProfile.update({
        where: { id: product.technicalProfile.id },
        data: {
          category: gearCategory,
          attributes: attributes as any,
          version: { increment: 1 },
        },
      })
      updatedCount++
    }
  }

  console.log(`✅ Đã tạo mới ${createdCount} và cập nhật ${updatedCount} hồ sơ kỹ thuật sản phẩm thuê.`)
}

