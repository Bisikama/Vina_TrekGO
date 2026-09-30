import { PrismaClient } from '@prisma/client';

export async function seedRentalProducts(prisma: PrismaClient) {
  console.log('Seeding Rental Products...');
  
  const categories = await prisma.rentalCategory.findMany({ take: 1 });
  if (categories.length === 0) {
    console.warn('No category found. Skipping products seeding.');
    return;
  }
  
  const products = [
    {
      id: 'aaaaaa11-1111-1111-1111-111111111111',
      categoryId: categories[0].id,
      sku: 'TENT-001',
      name: 'Tent 4 Person Basic',
      description: 'A basic 4 person tent',
      dailyPrice: 100000,
      replacementValue: 1000000,
      depositValue: 1000000,
      status: 'ACTIVE' as const,
      images: ['test-image-id'],
    }
  ];

  for (const product of products) {
    await prisma.rentalProduct.upsert({
      where: { sku: product.sku },
      update: product,
      create: product,
    });
  }

  console.log('Seeded Rental Products successfully.');
}
