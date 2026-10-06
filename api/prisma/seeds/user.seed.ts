import { PrismaClient, UserRole, UserStatus } from '@prisma/client';

export async function seedUsers(prisma: PrismaClient) {
  console.log('Seeding Users...');

  const users = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      authUserId: '11111111-1111-1111-1111-111111111111',
      email: 'admin@trekgo.com',
      fullName: 'System Admin',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      authUserId: '22222222-2222-2222-2222-222222222222',
      email: 'staff@trekgo.com',
      fullName: 'Inventory Staff',
      role: UserRole.STAFF_INVENTORY,
      status: UserStatus.ACTIVE,
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      authUserId: '33333333-3333-3333-3333-333333333333',
      email: 'user@trekgo.com',
      fullName: 'Regular User',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    },
  ];

  for (const user of users) {
    const { id, ...updateData } = user;
    await prisma.user.upsert({
      where: { id: user.id },
      update: updateData,
      create: user,
    });
  }

  console.log('Seeded Users successfully.');
}
