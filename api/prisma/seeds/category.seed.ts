import { PrismaClient, RecordStatus } from '@prisma/client';

export async function seedCategories(prisma: PrismaClient) {
  console.log('Seeding Rental Categories...');
  
  const categories = [
    {
      name: 'Lều Trại',
      slug: 'leu-trai',
      description: 'Các loại lều cắm trại từ 2 đến 10 người',
      status: RecordStatus.ACTIVE,
    },
    {
      name: 'Balo Trekking',
      slug: 'balo-trekking',
      description: 'Balo trợ lực, chống nước chuyên dụng',
      status: RecordStatus.ACTIVE,
    },
    {
      name: 'Giày Leo Núi',
      slug: 'giay-leo-nui',
      description: 'Giày chuyên dụng đi rừng, leo núi có độ bám cao',
      status: RecordStatus.ACTIVE,
    },
    {
      name: 'Phụ kiện sinh tồn',
      slug: 'phu-kien-sinh-ton',
      description: 'Đèn pin, dao đa năng, túi ngủ',
      status: RecordStatus.ACTIVE,
    }
  ];

  for (const cat of categories) {
    const existing = await prisma.rentalCategory.findUnique({
      where: { slug: cat.slug }
    });
    if (!existing) {
      await prisma.rentalCategory.create({
        data: cat
      });
      console.log(`Created category: ${cat.name}`);
    } else {
      console.log(`Skipped existing category: ${cat.name}`);
    }
  }
}
