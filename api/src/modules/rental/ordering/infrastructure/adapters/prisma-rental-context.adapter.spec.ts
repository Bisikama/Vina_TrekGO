import { PrismaRentalContextAdapter } from './prisma-rental-context.adapter';
import { BookingParticipationContextService } from '../../../../bookings/booking-participation-context.service';
import { UserRole } from 'src/shared/constants';
import { ROLES_KEY } from 'src/shared/decorators/roles.decorator';
import { RentalTripController } from '../../presentation/controllers/rental-booking.controller';
import { RentalOperationController } from '../../presentation/controllers/rental-operation.controller';
import { RentalOrderController } from '../../presentation/controllers/rental-order.controller';
import { RentalExtensionController } from '../../extension/rental-extension.controller';

describe('PrismaRentalContextAdapter (Polymorphic Context Resolution)', () => {
  let adapter: PrismaRentalContextAdapter;
  let prismaMock: any;
  let bookingContextService: BookingParticipationContextService;

  const now = new Date('2026-10-01T10:00:00Z');

  const mockPolicy = {
    id: 'policy-uuid-001',
    policyCode: 'RENTAL_POLICY_V1',
    versionNo: 1,
    currency: 'VND',
    dayCountMode: 'CEIL_24H',
    quoteTtlMinutes: 15,
    paymentHoldMinutes: 15,
    freeCancellationHours: 24,
    cutoffHoursBeforeTrip: 24,
    prepBufferMinutes: 360,
    returnBufferMinutes: 1440,
    cleaningBufferMinutes: 1440,
    overdueReviewMinutes: null,
    maxRentalAfterTripHours: 48,
    extensionRequestCutoffMinutes: 60,
    extensionHoldMinutes: 15,
    maxExtensionCount: 2,
    maxTotalRentalDays: 14,
    deepInspectionBufferMinutes: 2880,
    cancellationRules: {},
    effectiveFrom: new Date('2026-01-01T00:00:00Z'),
    effectiveTo: null,
  };

  const mockPickupPoint = {
    id: 'point-pickup-uuid',
    name: 'Pickup Station Central',
    address: '123 Main St, District 1',
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  const mockReturnPoint = {
    id: 'point-return-uuid',
    name: 'Return Station Central',
    address: '456 Return Ave, District 1',
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  const mockTransport = {
    id: 'transport-uuid-001',
    sequence: 1,
    status: 'ACTIVE',
    pickupPointId: mockPickupPoint.id,
    returnPointId: mockReturnPoint.id,
    pickupPoint: mockPickupPoint,
    returnPoint: mockReturnPoint,
    meetingAt: new Date('2026-10-10T06:00:00Z'),
    returnAt: new Date('2026-10-12T18:00:00Z'),
    version: 1,
  };

  beforeEach(() => {
    prismaMock = {
      rentalPolicy: {
        findFirst: jest.fn().mockResolvedValue(mockPolicy),
      },
      rentalOrder: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      trip: {
        findUnique: jest.fn(),
      },
      tripMember: {
        findUnique: jest.fn(),
      },
      booking: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockImplementation((args: any) => {
          return Promise.resolve({
            id: args?.where?.id,
            pickupPoint: mockPickupPoint,
            returnPoint: mockReturnPoint,
            user: { fullName: 'Booking User', phone: '0901234567' },
          });
        }),
      },
      bookingParticipant: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockImplementation((args: any) => {
          return Promise.resolve({
            id: args?.where?.id,
            fullName: 'Phạm Khách Tham Gia',
            phone: '0908888888',
            user: { fullName: 'Phạm Khách Tham Gia', phone: '0908888888' },
          });
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-default', fullName: 'Default User', phone: '0900000000', status: 'ACTIVE', role: 'USER' }),
      },
    };

    bookingContextService = new BookingParticipationContextService();
    adapter = new PrismaRentalContextAdapter(prismaMock, bookingContextService);
  });

  // ---------------------------------------------------------------------------
  // TEST CASE 1: PRIVATE TRIP MEMBER
  // ---------------------------------------------------------------------------
  it('Test Case 1 (Private Member): User tham gia Private Trip qua trip_members -> eligible = true, bookingId = null', async () => {
    const tripId = 'trip-private-uuid';
    const userId = 'user-private-member';

    prismaMock.trip.findUnique.mockResolvedValue({
      id: tripId,
      title: 'Chuyến Trekking Tà Năng (Private)',
      status: 'OPEN',
      tripType: 'PRIVATE',
      startAt: new Date('2026-10-10T06:00:00Z'),
      endAt: new Date('2026-10-12T18:00:00Z'),
      version: 1,
      pickupPointId: mockPickupPoint.id,
      pickupPoint: mockPickupPoint,
      leaderId: null,
      leader: null,
      tripTransportsViaTripId: [mockTransport],
      tripTrailPlansViaTripId: [{ snapshotDifficulty: 'MEDIUM' }],
      weatherSnapshotsViaTripId: [
        { riskSummary: 'Trời quang mây tạnh', weatherCondition: 'SUNNY', rainProbabilityPercent: 5 },
      ],
    });

    prismaMock.tripMember.findUnique.mockResolvedValue({
      id: 'member-uuid-001',
      tripId,
      userId,
      role: 'MEMBER',
      status: 'ACTIVE',
      version: 3,
      pickupPointId: mockPickupPoint.id,
      pickupPoint: mockPickupPoint,
      user: { fullName: 'Nguyễn Văn Member', phone: '0901111111' },
    });

    const context = await adapter.getByTripId(tripId, userId, now);

    expect(context).not.toBeNull();
    expect(context?.rentalEligible).toBe(true);
    expect(context?.bookingId).toBeNull();
    expect(context?.membershipRef).toBe('member-uuid-001');
    expect(context?.membershipKind).toBe('PRIVATE_TRIP_MEMBER');
    expect(context?.membershipSourceVersion).toBe(3);
    expect(context?.membershipRole).toBe('MEMBER');
    expect(context?.membershipStatus).toBe('ACTIVE');
    expect(context?.trip.tripType).toBe('PRIVATE');
    expect(context?.recipientOptions).toHaveLength(1);
    expect(prismaMock.rentalOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tripId,
          userId,
          status: { in: ['PENDING_PAYMENT'] },
          paymentExpiresAt: { gt: now },
        }),
      }),
    );
    expect(context?.recipientOptions[0].displayName).toBe('Nguyễn Văn Member');
  });

  // ---------------------------------------------------------------------------
  // TEST CASE 2: PUBLIC TRIP LEADER
  // ---------------------------------------------------------------------------
  it('Test Case 2 (Public Leader): User là Leader của Public Trip -> eligible = true, membershipRole = LEADER', async () => {
    const tripId = 'trip-public-uuid';
    const leaderUserId = 'leader-user-uuid';

    prismaMock.trip.findUnique.mockResolvedValue({
      id: tripId,
      title: 'Tour Chinh Phục Bidoup (Public)',
      status: 'OPEN',
      tripType: 'PUBLIC',
      startAt: new Date('2026-10-10T06:00:00Z'),
      endAt: new Date('2026-10-12T18:00:00Z'),
      version: 2,
      pickupPointId: mockPickupPoint.id,
      pickupPoint: mockPickupPoint,
      leaderId: leaderUserId,
      leader: { id: leaderUserId, fullName: 'Trần Leader', phone: '0909999999' },
      tripTransportsViaTripId: [mockTransport],
      tripTrailPlansViaTripId: [{ snapshotDifficulty: 'HARD' }],
      weatherSnapshotsViaTripId: [
        { riskSummary: 'Có mây nhẹ', weatherCondition: 'PARTLY_CLOUDY', rainProbabilityPercent: 20 },
      ],
    });

    const context = await adapter.getByTripId(tripId, leaderUserId, now);

    expect(context).not.toBeNull();
    expect(context?.rentalEligible).toBe(true);
    expect(context?.bookingId).toBeNull();
    expect(context?.membershipRef).toBe(leaderUserId);
    expect(context?.membershipKind).toBe('PUBLIC_TRIP_LEADER');
    expect(context?.membershipSourceVersion).toBe(2);
    expect(context?.membershipRole).toBe('LEADER');
    expect(context?.membershipStatus).toBe('ACTIVE');
    expect(context?.recipientOptions).toHaveLength(1);
    expect(context?.recipientOptions[0].memberId).toBe(leaderUserId);
    expect(context?.recipientOptions[0].userId).toBe(leaderUserId);
    expect(context?.recipientOptions[0].displayName).toBe('Trần Leader');
  });

  // ---------------------------------------------------------------------------
  // TEST CASE 3: PUBLIC BOOKING PARTICIPANT (CONFIRMED)
  // ---------------------------------------------------------------------------
  it('Test Case 3 (Public Participant): User có BookingParticipant trong đơn CONFIRMED -> eligible = true', async () => {
    const tripId = 'trip-public-uuid';
    const participantUserId = 'participant-user-uuid';

    prismaMock.trip.findUnique.mockResolvedValue({
      id: tripId,
      title: 'Tour Chinh Phục Fansipan (Public)',
      status: 'OPEN',
      tripType: 'PUBLIC',
      startAt: new Date('2026-10-10T06:00:00Z'),
      endAt: new Date('2026-10-12T18:00:00Z'),
      version: 1,
      pickupPointId: mockPickupPoint.id,
      pickupPoint: mockPickupPoint,
      leaderId: 'other-leader-uuid',
      leader: { id: 'other-leader-uuid', fullName: 'Lê Leader', phone: '0905555555' },
      tripTransportsViaTripId: [mockTransport],
      tripTrailPlansViaTripId: [{ snapshotDifficulty: 'HARD' }],
      weatherSnapshotsViaTripId: [],
    });

    prismaMock.booking.findMany.mockResolvedValue([
      {
        id: 'booking-confirmed-uuid',
        tripId,
        userId: 'other-booker-uuid',
        status: 'CONFIRMED',
        version: 4,
        pickupPoint: mockPickupPoint,
        returnPoint: mockReturnPoint,
        bookingParticipantsViaBookingId: [
          {
            id: 'participant-uuid-002',
            bookingId: 'booking-confirmed-uuid',
            userId: participantUserId,
            fullName: 'Phạm Khách Tham Gia',
            phone: '0908888888',
            status: 'ACTIVE',
          },
        ],
      },
    ]);

    const context = await adapter.getByTripId(tripId, participantUserId, now);

    expect(context).not.toBeNull();
    expect(context?.rentalEligible).toBe(true);
    expect(context?.bookingId).toBe('booking-confirmed-uuid');
    expect(context?.membershipRef).toBe('participant-uuid-002');
    expect(context?.membershipKind).toBe('PUBLIC_PARTICIPANT');
    expect(context?.membershipSourceVersion).toBe(4);
    expect(context?.membershipStatus).toBe('ACTIVE');
    expect(context?.membershipRole).toBe('PARTICIPANT');
    expect(context?.recipientOptions).toHaveLength(1);
    expect(context?.recipientOptions[0].displayName).toBe('Phạm Khách Tham Gia');
  });

  // ---------------------------------------------------------------------------
  // TEST CASE 4: BUYER-ONLY WITHOUT PARTICIPANT ROW (PO Default: ineligible)
  // ---------------------------------------------------------------------------
  it('Test Case 4 (Buyer-only without participant): Mặc định đề xuất TẮT quyền thuê cho buyer không đi trek', async () => {
    const tripId = 'trip-public-uuid';
    const bookerUserId = 'booker-not-participant-uuid';

    prismaMock.trip.findUnique.mockResolvedValue({
      id: tripId,
      title: 'Tour Chinh Phục Fansipan (Public)',
      status: 'OPEN',
      tripType: 'PUBLIC',
      startAt: new Date('2026-10-10T06:00:00Z'),
      endAt: new Date('2026-10-12T18:00:00Z'),
      version: 1,
      pickupPointId: mockPickupPoint.id,
      pickupPoint: mockPickupPoint,
      leaderId: 'other-leader-uuid',
      leader: { id: 'other-leader-uuid', fullName: 'Lê Leader', phone: '0905555555' },
      tripTransportsViaTripId: [mockTransport],
      tripTrailPlansViaTripId: [{ snapshotDifficulty: 'HARD' }],
      weatherSnapshotsViaTripId: [],
    });

    // Booker has a booking row, but participant list belongs to other users
    prismaMock.booking.findMany.mockResolvedValue([
      {
        id: 'booking-confirmed-uuid',
        tripId,
        userId: bookerUserId,
        status: 'CONFIRMED',
        version: 1,
        pickupPoint: mockPickupPoint,
        returnPoint: mockReturnPoint,
        bookingParticipantsViaBookingId: [],
      },
    ]);

    const context = await adapter.getByTripId(tripId, bookerUserId, now);

    // Per PO default decision: buyer-only without participant slot cannot rent
    expect(context).not.toBeNull();
    expect(context?.rentalEligible).toBe(false);
    expect(context?.ineligibleReason).toBe('TRIP_MEMBERSHIP_NOT_ELIGIBLE');
    expect(context?.membershipKind).toBe('PUBLIC_BOOKING_BUYER');
  });

  // ---------------------------------------------------------------------------
  // TEST CASE 5: DETERMINISTIC SELECTION ACROSS MULTIPLE SOURCES
  // ---------------------------------------------------------------------------
  it('Test Case 5 (Multiple Sources): Chọn deterministically nguồn có thứ tự ưu tiên và ref nhỏ nhất', async () => {
    const tripId = 'trip-public-uuid';
    const multiUserId = 'multi-user-uuid';

    prismaMock.trip.findUnique.mockResolvedValue({
      id: tripId,
      title: 'Tour Fansipan',
      status: 'OPEN',
      tripType: 'PUBLIC',
      startAt: new Date('2026-10-10T06:00:00Z'),
      endAt: new Date('2026-10-12T18:00:00Z'),
      version: 1,
      pickupPointId: mockPickupPoint.id,
      pickupPoint: mockPickupPoint,
      leaderId: 'leader-id',
      leader: null,
      tripTransportsViaTripId: [mockTransport],
      tripTrailPlansViaTripId: [],
      weatherSnapshotsViaTripId: [],
    });

    // User is buyer on booking-1, and participant on two bookings: participant-B and participant-A
    prismaMock.booking.findMany.mockResolvedValue([
      {
        id: 'booking-1',
        tripId,
        userId: multiUserId,
        status: 'CONFIRMED',
        version: 1,
        pickupPoint: mockPickupPoint,
        returnPoint: mockReturnPoint,
        bookingParticipantsViaBookingId: [
          {
            id: 'participant-bbb',
            bookingId: 'booking-1',
            userId: multiUserId,
            fullName: 'Participant B',
            phone: '0901',
            status: 'ACTIVE',
          },
        ],
      },
      {
        id: 'booking-2',
        tripId,
        userId: 'other-user',
        status: 'CONFIRMED',
        version: 2,
        pickupPoint: mockPickupPoint,
        returnPoint: mockReturnPoint,
        bookingParticipantsViaBookingId: [
          {
            id: 'participant-aaa',
            bookingId: 'booking-2',
            userId: multiUserId,
            fullName: 'Participant A',
            phone: '0902',
            status: 'ACTIVE',
          },
        ],
      },
    ]);

    const context = await adapter.getByTripId(tripId, multiUserId, now);

    // Selected deterministically: PUBLIC_PARTICIPANT with smaller membershipRef ('participant-aaa')
    expect(context).not.toBeNull();
    expect(context?.rentalEligible).toBe(true);
    expect(context?.membershipKind).toBe('PUBLIC_PARTICIPANT');
    expect(context?.membershipRef).toBe('participant-aaa');
  });

  // ---------------------------------------------------------------------------
  // TEST CASE 6: TERMINAL TRIP CHECK
  // ---------------------------------------------------------------------------
  it('Test Case 6 (Terminal Trip): Trip ở trạng thái CANCELLED hoặc COMPLETED -> eligible = false', async () => {
    const tripId = 'trip-cancelled-uuid';
    const userId = 'user-uuid';

    prismaMock.trip.findUnique.mockResolvedValue({
      id: tripId,
      title: 'Tour Bị Hủy',
      status: 'CANCELLED',
      tripType: 'PUBLIC',
      startAt: new Date('2026-10-10T06:00:00Z'),
      endAt: new Date('2026-10-12T18:00:00Z'),
      version: 5,
      pickupPointId: mockPickupPoint.id,
      pickupPoint: mockPickupPoint,
      leaderId: 'leader-id',
      leader: null,
      tripTransportsViaTripId: [mockTransport],
      tripTrailPlansViaTripId: [],
      weatherSnapshotsViaTripId: [],
    });

    prismaMock.booking.findMany.mockResolvedValue([
      {
        id: 'booking-1',
        tripId,
        userId,
        status: 'CONFIRMED',
        version: 1,
        pickupPoint: mockPickupPoint,
        returnPoint: mockReturnPoint,
        bookingParticipantsViaBookingId: [
          {
            id: 'part-1',
            bookingId: 'booking-1',
            userId,
            fullName: 'Khách',
            phone: '0901',
            status: 'ACTIVE',
          },
        ],
      },
    ]);

    const context = await adapter.getByTripId(tripId, userId, now);

    expect(context).not.toBeNull();
    expect(context?.rentalEligible).toBe(false);
    expect(context?.ineligibleReason).toBe('TRIP_TERMINAL');
  });

  // ---------------------------------------------------------------------------
  // TEST CASE 7: EXACT CUTOFF BOUNDARY
  // ---------------------------------------------------------------------------
  it('Test Case 7 (Cutoff Boundary): Đúng mốc cutoff (now == cutoff) được thuê; quá mốc (now > cutoff) từ chối', async () => {
    const tripId = 'trip-cutoff-uuid';
    const userId = 'user-cutoff-uuid';

    // handover at 2026-10-10T06:00:00Z, policy cutoff 24h -> cutoff is 2026-10-09T06:00:00Z
    const plannedHandoverAt = new Date('2026-10-10T06:00:00Z');
    const exactCutoff = new Date('2026-10-09T06:00:00Z');
    const pastCutoff = new Date('2026-10-09T06:00:00.001Z');

    prismaMock.trip.findUnique.mockResolvedValue({
      id: tripId,
      title: 'Tour Cutoff Check',
      status: 'OPEN',
      tripType: 'PUBLIC',
      startAt: plannedHandoverAt,
      endAt: new Date('2026-10-12T18:00:00Z'),
      version: 1,
      pickupPointId: mockPickupPoint.id,
      pickupPoint: mockPickupPoint,
      leaderId: 'leader-id',
      leader: null,
      tripTransportsViaTripId: [mockTransport],
      tripTrailPlansViaTripId: [],
      weatherSnapshotsViaTripId: [],
    });

    prismaMock.booking.findMany.mockResolvedValue([
      {
        id: 'booking-1',
        tripId,
        userId,
        status: 'CONFIRMED',
        version: 1,
        pickupPoint: mockPickupPoint,
        returnPoint: mockReturnPoint,
        bookingParticipantsViaBookingId: [
          {
            id: 'part-cutoff',
            bookingId: 'booking-1',
            userId,
            fullName: 'Khách Cutoff',
            phone: '0901',
            status: 'ACTIVE',
          },
        ],
      },
    ]);

    // 1. Đúng mốc cutoff: ELIGIBLE = true (Policy v1.5.2)
    const contextAtCutoff = await adapter.getByTripId(tripId, userId, exactCutoff);
    expect(contextAtCutoff).not.toBeNull();
    expect(contextAtCutoff?.rentalEligible).toBe(true);
    expect(contextAtCutoff?.ineligibleReason).toBeNull();

    // 2. Vượt quá mốc cutoff: ELIGIBLE = false, reason = 'RENTAL_CUTOFF_PASSED'
    const contextPastCutoff = await adapter.getByTripId(tripId, userId, pastCutoff);
    expect(contextPastCutoff).not.toBeNull();
    expect(contextPastCutoff?.rentalEligible).toBe(false);
    expect(contextPastCutoff?.ineligibleReason).toBe('RENTAL_CUTOFF_PASSED');
  });

  // ---------------------------------------------------------------------------
  // TEST CASE 8: NON-MEMBER (NOT IN TRIP)
  // ---------------------------------------------------------------------------
  it('Test Case 8 (Non-member): Người ngoài không có trong chuyến đi -> trả về null', async () => {
    const tripId = 'trip-public-uuid';
    const strangerUserId = 'stranger-uuid';

    prismaMock.trip.findUnique.mockResolvedValue({
      id: tripId,
      title: 'Tour Chinh Phục Bạch Mộc Lương Tử',
      status: 'OPEN',
      tripType: 'PUBLIC',
      startAt: new Date('2026-10-10T06:00:00Z'),
      endAt: new Date('2026-10-12T18:00:00Z'),
      version: 1,
      pickupPointId: mockPickupPoint.id,
      pickupPoint: mockPickupPoint,
      leaderId: 'other-leader-uuid',
      leader: null,
      tripTransportsViaTripId: [mockTransport],
      tripTrailPlansViaTripId: [],
      weatherSnapshotsViaTripId: [],
    });

    prismaMock.booking.findMany.mockResolvedValue([]);
    prismaMock.tripMember.findUnique.mockResolvedValue(null);

    const context = await adapter.getByTripId(tripId, strangerUserId, now);

    expect(context).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // TEST CASE 9: ROLE GUARDS REGISTRATION
  // ---------------------------------------------------------------------------
  describe('Kiểm tra cấu hình Role Guard trên các Presentation Controller', () => {
    it('RentalTripController các endpoint phải cho phép UserRole.LEADER bên cạnh UserRole.USER', () => {
      const eligibilityRoles = Reflect.getMetadata(
        ROLES_KEY,
        RentalTripController.prototype.getEligibility,
      );
      expect(eligibilityRoles).toContain(UserRole.LEADER);
      expect(eligibilityRoles).toContain(UserRole.USER);

      const recommendationsRoles = Reflect.getMetadata(
        ROLES_KEY,
        RentalTripController.prototype.getRecommendations,
      );
      expect(recommendationsRoles).toContain(UserRole.LEADER);
      expect(recommendationsRoles).toContain(UserRole.USER);
    });

    it('RentalOperationController các endpoint phải cho phép UserRole.LEADER', () => {
      const availabilityRoles = Reflect.getMetadata(
        ROLES_KEY,
        RentalOperationController.prototype.getAvailability,
      );
      expect(availabilityRoles).toContain(UserRole.LEADER);
      expect(availabilityRoles).toContain(UserRole.USER);

      const quoteRoles = Reflect.getMetadata(
        ROLES_KEY,
        RentalOperationController.prototype.createQuote,
      );
      const method = Object.getOwnPropertyDescriptor(
        RentalOperationController.prototype,
        'createQuote',
      )?.value ?? Object.getOwnPropertyDescriptor(
        RentalOperationController.prototype,
        'quote',
      )?.value;
      if (method) {
        const roles = Reflect.getMetadata(ROLES_KEY, method);
        expect(roles).toContain(UserRole.LEADER);
      }
    });

    it('RentalOrderController các endpoint của khách hàng phải cho phép UserRole.LEADER', () => {
      const createOrderRoles = Reflect.getMetadata(
        ROLES_KEY,
        RentalOrderController.prototype.createOrder,
      );
      expect(createOrderRoles).toContain(UserRole.LEADER);
      expect(createOrderRoles).toContain(UserRole.USER);

      const listOrdersRoles = Reflect.getMetadata(
        ROLES_KEY,
        RentalOrderController.prototype.listOrders,
      );
      expect(listOrdersRoles).toContain(UserRole.LEADER);
      expect(listOrdersRoles).toContain(UserRole.USER);

      const getOrderRoles = Reflect.getMetadata(
        ROLES_KEY,
        RentalOrderController.prototype.getOrder,
      );
      expect(getOrderRoles).toContain(UserRole.LEADER);

      const cancelOrderRoles = Reflect.getMetadata(
        ROLES_KEY,
        RentalOrderController.prototype.cancelOrder,
      );
      expect(cancelOrderRoles).toContain(UserRole.LEADER);
    });

    it('RentalExtensionController các endpoint gia hạn phải cho phép UserRole.LEADER', () => {
      const quoteRoles = Reflect.getMetadata(
        ROLES_KEY,
        RentalExtensionController.prototype.quote,
      );
      expect(quoteRoles).toContain(UserRole.LEADER);
      expect(quoteRoles).toContain(UserRole.USER);

      const confirmRoles = Reflect.getMetadata(
        ROLES_KEY,
        RentalExtensionController.prototype.confirm,
      );
      expect(confirmRoles).toContain(UserRole.LEADER);
      expect(confirmRoles).toContain(UserRole.USER);

      const listRoles = Reflect.getMetadata(
        ROLES_KEY,
        RentalExtensionController.prototype.list,
      );
      expect(listRoles).toContain(UserRole.LEADER);
      expect(listRoles).toContain(UserRole.USER);
    });
  });
});
