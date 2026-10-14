import {
  PrismaClient,
  BookingStatus,
  TripMemberStatus,
  TripMemberRole,
  RecordStatus,
  TripType,
  TripStatus,
  ParticipantStatus,
  UserRole,
  UserStatus,
  User,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';

/**
 * Seed script tạo dữ liệu mẫu cho Booking (CONFIRMED), Trip tương lai, và TripMember (ACTIVE).
 * Phục vụ kiểm thử luồng thuê thiết bị Rental (Area B) RB-API-101 (rental-eligibility).
 */
export async function seedTestBookingMembership(
  prisma: PrismaClient,
  options?: { email?: string; userId?: string }
) {
  console.log('🚀 Bắt đầu thiết lập dữ liệu mẫu Booking & Trip Membership...');

  // 1. Xác định User test
  let targetUser: User | null = null;
  if (options?.email) {
    targetUser = await prisma.user.findUnique({ where: { email: options.email } });
  } else if (options?.userId) {
    targetUser = await prisma.user.findUnique({ where: { id: options.userId } });
  } else {
    // Tự động tìm user gần nhất có vai trò USER
    targetUser = await prisma.user.findFirst({
      where: { role: UserRole.USER, status: UserStatus.ACTIVE },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // Nếu trong database chưa có user nào, tạo ngay 1 user test mẫu
  if (!targetUser) {
    console.log('⚠️ Không tìm thấy user có sẵn, đang tạo tài khoản test mẫu: testuser@trektravel.vn...');
    targetUser = await prisma.user.create({
      data: {
        id: randomUUID(),
        authUserId: randomUUID(),
        email: 'testuser@trektravel.vn',
        fullName: 'Nguyễn Văn Test (Rental User)',
        phone: '0909123456',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      },
    });
    console.log(`✅ Đã tạo user test: ID = ${targetUser.id}, Email = ${targetUser.email}`);
  } else {
    console.log(`👤 Sử dụng user test: [${targetUser.fullName}] - Email: [${targetUser.email}] - ID: [${targetUser.id}]`);
  }

  const currentUser: User = targetUser;

  // 2. Tìm hoặc tạo Leader (Host) cho chuyến đi
  let leader = await prisma.user.findFirst({
    where: { role: UserRole.LEADER, status: UserStatus.ACTIVE },
  });
  if (!leader) {
    leader = await prisma.user.create({
      data: {
        id: randomUUID(),
        authUserId: randomUUID(),
        email: 'leader.demo@trektravel.vn',
        fullName: 'Trần Hữu Leader (Tour Guide)',
        phone: '0988776655',
        role: UserRole.LEADER,
        status: UserStatus.ACTIVE,
      },
    });
  }

  // 3. Tìm hoặc tạo Destination & Điểm tập kết (PickupPoint)
  let destination = await prisma.destination.findFirst({
    where: { status: RecordStatus.ACTIVE },
  });
  if (!destination) {
    destination = await prisma.destination.create({
      data: {
        id: randomUUID(),
        name: 'Núi Bà Đen - Tây Ninh',
        region: 'SOUTH',
        centerLat: 11.374,
        centerLng: 106.153,
        status: RecordStatus.ACTIVE,
      },
    });
  }

  let pickupPoint = await prisma.pickupPoint.findFirst({
    where: { destinationId: destination.id, status: RecordStatus.ACTIVE },
  });
  if (!pickupPoint) {
    pickupPoint = await prisma.pickupPoint.create({
      data: {
        id: randomUUID(),
        destinationId: destination.id,
        code: `PUP-RENTAL-${Date.now().toString().slice(-4)}`,
        name: 'Điểm tập kết Cổng KDL Núi Bà Đen',
        address: 'Đường Bời Lời, Xã Thạnh Tân, TP. Tây Ninh',
        latitude: 11.374,
        longitude: 106.153,
        status: RecordStatus.ACTIVE,
        createdBy: leader.id,
      },
    });
  }

  // 4. Tìm hoặc tạo BookingPolicy đang ACTIVE
  let bookingPolicy = await prisma.bookingPolicy.findFirst({
    where: { isActive: true },
    orderBy: { versionNo: 'desc' },
  });
  if (!bookingPolicy) {
    bookingPolicy = await prisma.bookingPolicy.create({
      data: {
        id: randomUUID(),
        policyCode: 'PUBLIC_BOOKING_DEFAULT',
        versionNo: 1,
        holdTtlMinutes: 15,
        cancellationRules: [],
        effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
        isActive: true,
      },
    });
  }

  // 5. Tự động khắc phục các booking cũ bị EXPIRED của user này (nếu có)
  const expiredBookings = await prisma.booking.findMany({
    where: { userId: currentUser.id, status: BookingStatus.EXPIRED },
    include: { trip: true },
  });

  if (expiredBookings.length > 0) {
    console.log(`\n🔄 Phát hiện ${expiredBookings.length} booking bị EXPIRED của user này. Đang tự động kích hoạt lại...`);
    for (const b of expiredBookings) {
      // Đẩy ngày khởi hành ra tương lai (+7 ngày) để thỏa mãn điều kiện cutoff 24h
      const futureStart = new Date(Date.now() + 7 * 24 * 3600 * 1000);
      const futureEnd = new Date(futureStart.getTime() + 2 * 24 * 3600 * 1000);

      await prisma.trip.update({
        where: { id: b.tripId },
        data: {
          startAt: futureStart,
          endAt: futureEnd,
          status: TripStatus.OPEN,
          pickupPointId: b.trip.pickupPointId ?? pickupPoint.id,
        },
      });

      // Cập nhật booking sang CONFIRMED
      await prisma.booking.update({
        where: { id: b.id },
        data: {
          status: BookingStatus.CONFIRMED,
          confirmedAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        },
      });

      // Đồng bộ vào trip_members với status = ACTIVE
      await prisma.tripMember.upsert({
        where: {
          tripId_userId: {
            tripId: b.tripId,
            userId: currentUser.id,
          },
        },
        update: {
          status: TripMemberStatus.ACTIVE,
          pickupPointId: pickupPoint.id,
        },
        create: {
          id: randomUUID(),
          tripId: b.tripId,
          userId: currentUser.id,
          role: TripMemberRole.MEMBER,
          status: TripMemberStatus.ACTIVE,
          pickupPointId: pickupPoint.id,
        },
      });
      console.log(`   + Đã kích hoạt lại booking cũ: [${b.id}] cho Trip: [${b.tripId}] -> CONFIRMED & ACTIVE`);
    }
  }

  // 6. Tạo thêm 1 Chuyến đi (Trip) chuẩn tương lai (+5 ngày tới) và Booking mới tinh
  const newTripStartAt = new Date(Date.now() + 5 * 24 * 3600 * 1000); // Khởi hành sau 5 ngày (120h > 24h cutoff)
  const newTripEndAt = new Date(newTripStartAt.getTime() + 2 * 24 * 3600 * 1000); // 2 ngày đi trek

  const demoTrip = await prisma.trip.create({
    data: {
      id: randomUUID(),
      title: `[DEMO RENTAL] Trekking Núi Bà Đen Khởi Hành ${newTripStartAt.toLocaleDateString('vi-VN')}`,
      description: 'Chuyến đi trekking mẫu phục vụ kiểm thử đặt thuê thiết bị TrekGo.',
      tripType: TripType.PUBLIC,
      status: TripStatus.OPEN,
      destinationId: destination.id,
      pickupPointId: pickupPoint.id,
      creatorId: leader.id,
      leaderId: leader.id,
      startAt: newTripStartAt,
      endAt: newTripEndAt,
      minPax: 2,
      maxPax: 12,
      pricePerPax: new Prisma.Decimal(450000),
      publishedAt: new Date(),
    },
  });

  const demoBooking = await prisma.booking.create({
    data: {
      id: randomUUID(),
      tripId: demoTrip.id,
      userId: currentUser.id,
      pickupPointId: pickupPoint.id,
      returnPointId: pickupPoint.id,
      bookingPolicyId: bookingPolicy.id,
      status: BookingStatus.CONFIRMED,
      participantCount: 1,
      pricePerPaxSnapshot: new Prisma.Decimal(450000),
      subtotalAmount: new Prisma.Decimal(450000),
      totalAmount: new Prisma.Decimal(450000),
      currency: 'VND',
      policySnapshot: {
        policyCode: bookingPolicy.policyCode,
        versionNo: bookingPolicy.versionNo,
      },
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      confirmedAt: new Date(),
    },
  });

  await prisma.bookingParticipant.create({
    data: {
      id: randomUUID(),
      bookingId: demoBooking.id,
      userId: currentUser.id,
      fullName: currentUser.fullName,
      phone: currentUser.phone ?? '0909123456',
      status: ParticipantStatus.ACTIVE,
      checkinCode: randomUUID(),
    },
  });

  await prisma.tripMember.upsert({
    where: {
      tripId_userId: {
        tripId: demoTrip.id,
        userId: currentUser.id,
      },
    },
    update: {
      status: TripMemberStatus.ACTIVE,
      pickupPointId: pickupPoint.id,
    },
    create: {
      id: randomUUID(),
      tripId: demoTrip.id,
      userId: currentUser.id,
      role: TripMemberRole.MEMBER,
      status: TripMemberStatus.ACTIVE,
      pickupPointId: pickupPoint.id,
    },
  });

  console.log('\n======================================================');
  console.log('🎉 TẠO DỮ LIỆU MẪU THÀNH CÔNG!');
  console.log('======================================================');
  console.log(`👤 User Test     : ${currentUser.fullName} (${currentUser.email})`);
  console.log(`🆔 User ID       : ${currentUser.id}`);
  console.log(`🏕️ Trip Mới Mẫu : ${demoTrip.title}`);
  console.log(`🔑 Trip ID Mẫu   : ${demoTrip.id}`);
  console.log(`📅 Thời gian đi  : ${newTripStartAt.toISOString()} -> ${newTripEndAt.toISOString()}`);
  console.log(`🎫 Booking ID    : ${demoBooking.id} (Trạng thái: CONFIRMED)`);
  console.log(`👥 Trip Member   : ACTIVE (Đủ điều kiện thuê thiết bị)`);
  console.log('------------------------------------------------------');
  console.log(`👉 BÂY GIỜ BẠN CÓ THỂ GỌI API KIỂM TRA:`);
  console.log(`   GET /api/v1/trips/${demoTrip.id}/rental-eligibility`);
  console.log('======================================================\n');

  return { user: currentUser, trip: demoTrip, booking: demoBooking };
}

// Cho phép chạy file trực tiếp bằng CLI: npx ts-node prisma/seeds/test-booking-membership.seed.ts
if (require.main === module) {
  const prisma = new PrismaClient();
  const args = process.argv.slice(2);
  const emailArg = args.find((a) => a.startsWith('--email='))?.slice(8);
  const userIdArg = args.find((a) => a.startsWith('--user-id='))?.slice(10);

  seedTestBookingMembership(prisma, { email: emailArg, userId: userIdArg })
    .catch((err) => {
      console.error('❌ Lỗi khi chạy seed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
