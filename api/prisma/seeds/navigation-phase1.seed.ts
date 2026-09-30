import { DifficultyLevel, PrismaClient, RecordStatus, TripMemberRole, TripMemberStatus, TripStatus, UserRole, UserStatus } from '@prisma/client'

// Các ID cố định chuẩn xác theo 2 tài khoản Supabase Auth thật của bạn
export const SEED_IDS = {
  // Tài khoản LEADER (Trưởng đoàn)
  LEADER_AUTH_ID: '4f00a265-acaa-4f5a-a334-621cc4e9715d',
  LEADER_EMAIL: 'luatluat304@gmail.com',

  // Tài khoản MEMBER (Thành viên đoàn)
  MEMBER_AUTH_ID: '76c3c85d-527b-4788-b25b-dd45787ab19d',
  MEMBER_EMAIL: 'luatluat3042@gmail.com',

  DESTINATION_ID: '33333333-3333-3333-3333-333333333333',
  PICKUP_POINT_ID: '44444444-4444-4444-4444-444444444444',
  SYSTEM_TRAIL_1_ID: '5555aaaa-1111-1111-1111-111111111111',
  SYSTEM_TRAIL_2_ID: '5555aaaa-2222-2222-2222-222222222222',
  TRIP_ID: '55555555-5555-5555-5555-555555555555',
  TRAIL_PLAN_1_ID: '66666666-6666-6666-6666-666666666661', // Cung chính ban đầu
  TRAIL_PLAN_2_ID: '66666666-6666-6666-6666-666666666662', // Cung dự phòng để test đổi đường!
  CHECKPOINT_1_ID: '77777777-7777-7777-7777-777777777771',
  CHECKPOINT_2_ID: '77777777-7777-7777-7777-777777777772',
  GPS_POLICY_ID: '88888888-8888-8888-8888-888888888888',
  GPS_SESSION_ID: '99999999-9999-9999-9999-999999999999',
}

export async function seedNavigationPhase1(prisma: PrismaClient) {
  console.log('Seeding Phase 1 Navigation Context & Map 3D data with REAL Supabase accounts...')

  // 1. Cập nhật / Tạo Leader (luatluat304@gmail.com -> Role: LEADER)
  const leader = await prisma.user.upsert({
    where: { authUserId: SEED_IDS.LEADER_AUTH_ID },
    update: {
      role: UserRole.LEADER,
      status: UserStatus.ACTIVE,
      fullName: 'Leader Luật (luatluat304)',
    },
    create: {
      authUserId: SEED_IDS.LEADER_AUTH_ID,
      email: SEED_IDS.LEADER_EMAIL,
      fullName: 'Leader Luật (luatluat304)',
      role: UserRole.LEADER,
      status: UserStatus.ACTIVE,
    },
  })

  // Cập nhật / Tạo Member (luatluat3042@gmail.com -> Role: USER)
  const member = await prisma.user.upsert({
    where: { authUserId: SEED_IDS.MEMBER_AUTH_ID },
    update: {
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      fullName: 'Member Luật (luatluat3042)',
    },
    create: {
      authUserId: SEED_IDS.MEMBER_AUTH_ID,
      email: SEED_IDS.MEMBER_EMAIL,
      fullName: 'Member Luật (luatluat3042)',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    },
  })

  // 2. Điểm đến & Điểm đón khách
  await prisma.destination.upsert({
    where: { id: SEED_IDS.DESTINATION_ID },
    update: {},
    create: {
      id: SEED_IDS.DESTINATION_ID,
      name: 'Vườn Quốc Gia Hoàng Liên - Sa Pa',
      description: 'Dãy núi Hoàng Liên Sơn hùng vĩ với đỉnh Fansipan nóc nhà Đông Dương',
      region: 'NORTH',
      centerLat: 22.3512,
      centerLng: 103.7745,
      status: RecordStatus.ACTIVE,
    },
  })

  await prisma.pickupPoint.upsert({
    where: { id: SEED_IDS.PICKUP_POINT_ID },
    update: { createdBy: leader.id },
    create: {
      id: SEED_IDS.PICKUP_POINT_ID,
      destinationId: SEED_IDS.DESTINATION_ID,
      code: 'PICKUP_TRAM_TON_SAPA',
      name: 'Trạm Tôn Sa Pa (Độ cao 1900m)',
      address: 'Đèo Ô Quy Hồ, Phường Sa Pả, Thị xã Sa Pa, Lào Cai',
      latitude: 22.3512345,
      longitude: 103.7745678,
      status: RecordStatus.ACTIVE,
      createdBy: leader.id,
    },
  })

  // 3. Tạo 2 System Trails gốc
  const geojson1 = {
    type: 'LineString',
    coordinates: [
      [103.7745, 22.3512, 1900],
      [103.7758, 22.3534, 2200],
      [103.777, 22.3567, 2800],
      [103.7785, 22.359, 3143],
    ],
  }

  const geojson2 = {
    type: 'LineString',
    coordinates: [
      [103.7745, 22.3512, 1900],
      [103.7758, 22.3534, 2200],
      [103.7801, 22.3575, 2750],
      [103.7785, 22.359, 3143],
    ],
  }

  await prisma.systemTrail.upsert({
    where: { id: SEED_IDS.SYSTEM_TRAIL_1_ID },
    update: { createdBy: leader.id },
    create: {
      id: SEED_IDS.SYSTEM_TRAIL_1_ID,
      destinationId: SEED_IDS.DESTINATION_ID,
      code: 'TRAIL_FANSIPAN_TRAM_TON',
      name: 'Cung Trạm Tôn - Đỉnh Fansipan',
      difficulty: DifficultyLevel.HARD,
      distanceKm: 11.5,
      elevationGainM: 1200,
      estimatedDurationMinutes: 480,
      routeGeojson: geojson1,
      price: 0,
      status: RecordStatus.ACTIVE,
      createdBy: leader.id,
    },
  })

  await prisma.systemTrail.upsert({
    where: { id: SEED_IDS.SYSTEM_TRAIL_2_ID },
    update: { createdBy: leader.id },
    create: {
      id: SEED_IDS.SYSTEM_TRAIL_2_ID,
      destinationId: SEED_IDS.DESTINATION_ID,
      code: 'TRAIL_FANSIPAN_TRANH_SAT_LO',
      name: 'Cung đường tránh dốc sạt lở số 2',
      difficulty: DifficultyLevel.MEDIUM,
      distanceKm: 12.8,
      elevationGainM: 1100,
      estimatedDurationMinutes: 510,
      routeGeojson: geojson2,
      price: 0,
      status: RecordStatus.ACTIVE,
      createdBy: leader.id,
    },
  })

  // 4. Tạo Chuyến đi (Trip) trạng thái IN_PROGRESS do leader.id làm Leader
  const trip = await prisma.trip.upsert({
    where: { id: SEED_IDS.TRIP_ID },
    update: {
      status: TripStatus.IN_PROGRESS,
      leaderId: leader.id,
      creatorId: leader.id,
    },
    create: {
      id: SEED_IDS.TRIP_ID,
      tripType: 'PUBLIC',
      title: 'Chinh phục Đỉnh Fansipan 2N1D - Cung Trạm Tôn',
      description: 'Chuyến trekking leo núi Fansipan cùng Leader có kinh nghiệm dẫn đoàn',
      destinationId: SEED_IDS.DESTINATION_ID,
      pickupPointId: SEED_IDS.PICKUP_POINT_ID,
      creatorId: leader.id,
      leaderId: leader.id,
      startAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // Bắt đầu cách đây 4 giờ
      endAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      minPax: 4,
      maxPax: 15,
      pricePerPax: 2850000,
      status: TripStatus.IN_PROGRESS,
    },
  })

  // 5. Tạo 2 lộ trình (Plan 1 chính + Plan 2 dự phòng để test đổi đường)
  await prisma.tripTrailPlan.upsert({
    where: { id: SEED_IDS.TRAIL_PLAN_1_ID },
    update: {},
    create: {
      id: SEED_IDS.TRAIL_PLAN_1_ID,
      tripId: trip.id,
      systemTrailId: SEED_IDS.SYSTEM_TRAIL_1_ID,
      sequence: 1,
      snapshotName: 'Cung Trạm Tôn - Đỉnh Fansipan (Lộ trình chính)',
      snapshotDifficulty: DifficultyLevel.HARD,
      snapshotDistanceKm: 11.5,
      snapshotElevationGainM: 1200,
      snapshotGeojson: geojson1,
    },
  })

  await prisma.tripTrailPlan.upsert({
    where: { id: SEED_IDS.TRAIL_PLAN_2_ID },
    update: {},
    create: {
      id: SEED_IDS.TRAIL_PLAN_2_ID,
      tripId: trip.id,
      systemTrailId: SEED_IDS.SYSTEM_TRAIL_2_ID,
      sequence: 2,
      snapshotName: 'Cung đường tránh dốc sạt lở số 2 (Dự phòng)',
      snapshotDifficulty: DifficultyLevel.MEDIUM,
      snapshotDistanceKm: 12.8,
      snapshotElevationGainM: 1100,
      snapshotGeojson: geojson2,
    },
  })

  // 6. Gán Active Trail ban đầu là Plan 1
  await prisma.tripActiveTrailPlan.upsert({
    where: { tripId: trip.id },
    update: {
      trailPlanId: SEED_IDS.TRAIL_PLAN_1_ID,
      changedBy: leader.id,
    },
    create: {
      tripId: trip.id,
      trailPlanId: SEED_IDS.TRAIL_PLAN_1_ID,
      changedBy: leader.id,
      version: 1,
    },
  })

  // 7. Checkpoints bắt buộc
  await prisma.tripCheckpoint.upsert({
    where: { id: SEED_IDS.CHECKPOINT_1_ID },
    update: {},
    create: {
      id: SEED_IDS.CHECKPOINT_1_ID,
      tripId: trip.id,
      sequence: 1,
      name: 'Trạm dừng nghỉ 2200m',
      description: 'Điểm nghỉ ăn trưa và kiểm tra thể lực',
      latitude: 22.3534,
      longitude: 103.7758,
      radiusMeters: 50,
      isRequired: true,
      isEnabled: true,
      missionTitle: 'Chụp ảnh điểm danh trạm 2200m',
      missionDescription: 'Chụp ảnh cùng thẻ thành viên trước biển độ cao 2200m',
      missionType: 'PHOTO',
      rewardPoints: 50,
    },
  })

  await prisma.tripCheckpoint.upsert({
    where: { id: SEED_IDS.CHECKPOINT_2_ID },
    update: {},
    create: {
      id: SEED_IDS.CHECKPOINT_2_ID,
      tripId: trip.id,
      sequence: 2,
      name: 'Chóp đỉnh Fansipan 3143m',
      description: 'Nóc nhà Đông Dương',
      latitude: 22.359,
      longitude: 103.7785,
      radiusMeters: 50,
      isRequired: true,
      isEnabled: true,
      missionTitle: 'Chạm tay chóp inox Fansipan',
      missionDescription: 'Quét mã QR tại chân cột cờ đỉnh núi',
      missionType: 'QR_CODE',
      rewardPoints: 100,
    },
  })

  // 8. Gán Leader (HOST) và Member vào chuyến đi
  await prisma.tripMember.upsert({
    where: {
      tripId_userId: {
        tripId: trip.id,
        userId: leader.id,
      },
    },
    update: { 
      role: TripMemberRole.HOST,
      status: TripMemberStatus.ACTIVE,
    },
    create: {
      tripId: trip.id,
      userId: leader.id,
      role: TripMemberRole.HOST,
      status: TripMemberStatus.ACTIVE,
    },
  })

  await prisma.tripMember.upsert({
    where: {
      tripId_userId: {
        tripId: trip.id,
        userId: member.id,
      },
    },
    update: { 
      role: TripMemberRole.MEMBER,
      status: TripMemberStatus.ACTIVE,
    },
    create: {
      tripId: trip.id,
      userId: member.id,
      role: TripMemberRole.MEMBER,
      status: TripMemberStatus.ACTIVE,
    },
  })

  // 9. Cấu hình GPS Policy
  await prisma.gpsPolicy.upsert({
    where: { id: SEED_IDS.GPS_POLICY_ID },
    update: { createdBy: leader.id },
    create: {
      id: SEED_IDS.GPS_POLICY_ID,
      policyCode: 'TREKGO_DEFAULT_POLICY',
      versionNo: 1,
      syncIntervalSeconds: 30,
      deviationThresholdM: 50.0,
      deviationConsecutiveSamples: 3,
      defaultCheckpointRadiusM: 50,
      rawLocationRetentionDays: 30,
      effectiveFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      isActive: true,
      createdBy: leader.id,
    },
  })

  // 10. Phiên GPS Session của Member (luatluat3042@gmail.com)
  await prisma.gpsSession.upsert({
    where: { id: SEED_IDS.GPS_SESSION_ID },
    update: {
      userId: member.id,
      status: 'ACTIVE',
    },
    create: {
      id: SEED_IDS.GPS_SESSION_ID,
      userId: member.id,
      tripId: trip.id,
      gpsPolicyId: SEED_IDS.GPS_POLICY_ID,
      status: 'ACTIVE',
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      totalDistanceMeters: 4250.5,
      sampleCount: 85,
    },
  })

  // 11. Tạo mẫu 1 vị trí gần nhất (Last Location)
  const existingLoc = await prisma.gpsLocation.findFirst({
    where: { sessionId: SEED_IDS.GPS_SESSION_ID },
  })
  if (!existingLoc) {
    await prisma.gpsLocation.create({
      data: {
        sessionId: SEED_IDS.GPS_SESSION_ID,
        clientSampleId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        latitude: 22.353412,
        longitude: 103.775821,
        accuracyM: 4.5,
        speedMps: 1.2,
        headingDeg: 45.0,
        altitudeM: 2205.3,
        recordedAt: new Date(),
      },
    })
  }

  // 12. Check-in mẫu trạm số 1 đã hoàn thành cho Member (luatluat3042@gmail.com)
  await prisma.checkpointEvent.upsert({
    where: {
      tripId_tripCheckpointId_userId: {
        tripId: trip.id,
        tripCheckpointId: SEED_IDS.CHECKPOINT_1_ID,
        userId: member.id,
      },
    },
    update: {},
    create: {
      idempotencyKey: `ARRIVE_${trip.id}_${SEED_IDS.CHECKPOINT_1_ID}_${member.id}`,
      tripId: trip.id,
      tripCheckpointId: SEED_IDS.CHECKPOINT_1_ID,
      userId: member.id,
      sessionId: SEED_IDS.GPS_SESSION_ID,
      roleAtEvent: UserRole.USER,
      arrivalLatitude: 22.353405,
      arrivalLongitude: 103.77581,
      distanceToCheckpointM: 4.8,
      arrivalAt: new Date(Date.now() - 45 * 60 * 1000),
      missionStatus: 'COMPLETED',
    },
  })

  console.log('✅ Seed dữ liệu Phase 1 thành công với 2 tài khoản Supabase thật!')
  console.log(`- Leader (Trưởng đoàn): ${SEED_IDS.LEADER_EMAIL} (authUserId: ${SEED_IDS.LEADER_AUTH_ID})`)
  console.log(`- Member (Thành viên): ${SEED_IDS.MEMBER_EMAIL} (authUserId: ${SEED_IDS.MEMBER_AUTH_ID})`)
  console.log(`- Trip ID: ${SEED_IDS.TRIP_ID}`)
  console.log(`- Plan 1 (Chính): ${SEED_IDS.TRAIL_PLAN_1_ID}`)
  console.log(`- Plan 2 (Dự phòng để test switch-trail): ${SEED_IDS.TRAIL_PLAN_2_ID}`)
}
