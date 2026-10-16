import { PrismaClient, RecordStatus } from '@prisma/client'

export const RENTAL_CATEGORY_SEEDS = [
  {
    name: 'Lều và mái che',
    slug: 'leu-trai',
    description: 'Lều trekking, tăng và mái che chống mưa cho chuyến đi nhiều ngày.',
  },
  {
    name: 'Balo trekking',
    slug: 'balo-trekking',
    description: 'Balo chuyên dụng theo dung tích, có đai trợ lực và áo trùm mưa.',
  },
  {
    name: 'Túi ngủ và đệm cách nhiệt',
    slug: 'tui-ngu-dem-cach-nhiet',
    description: 'Túi ngủ, đệm hơi và đệm cách nhiệt dùng khi cắm trại qua đêm.',
  },
  {
    name: 'Giày leo núi',
    slug: 'giay-leo-nui',
    description: 'Giày trekking có độ bám cao, được tách theo từng kích cỡ để kiểm soát tồn kho.',
  },
  {
    name: 'Gậy trekking',
    slug: 'gay-trekking',
    description: 'Gậy hỗ trợ di chuyển trên địa hình dốc, trơn hoặc nhiều đá.',
  },
  {
    name: 'Áo mưa và chống thời tiết',
    slug: 'ao-mua-chong-thoi-tiet',
    description: 'Áo mưa, poncho và phụ kiện bảo vệ hành lý trước mưa gió.',
  },
  {
    name: 'Chiếu sáng và nguồn điện',
    slug: 'chieu-sang-nguon-dien',
    description: 'Đèn đội đầu, đèn trại và pin dự phòng phục vụ hành trình ngoài trời.',
  },
  {
    name: 'Nấu ăn và xử lý nước',
    slug: 'nau-an-xu-ly-nuoc',
    description: 'Bếp, bộ nồi và thiết bị lọc nước gọn nhẹ dùng trong trekking.',
  },
  {
    name: 'Phụ kiện sinh tồn và định hướng',
    slug: 'phu-kien-sinh-ton',
    description: 'La bàn, dụng cụ đa năng và thiết bị định vị phục vụ an toàn hành trình.',
  },
] as const

export async function seedCategories(prisma: PrismaClient) {
  console.log('Seeding Rental Categories...')

  for (const category of RENTAL_CATEGORY_SEEDS) {
    await prisma.rentalCategory.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
        status: RecordStatus.ACTIVE,
      },
      create: {
        ...category,
        status: RecordStatus.ACTIVE,
      },
    })
    console.log(`Upserted category: ${category.name}`)
  }
}
