import { PrismaRentalContextAdapter } from './prisma-rental-context.adapter';
import { UserRole } from 'src/shared/constants';
import { ROLES_KEY } from 'src/shared/decorators/roles.decorator';
import { RentalTripController } from '../../presentation/controllers/rental-booking.controller';
import { RentalOperationController } from '../../presentation/controllers/rental-operation.controller';
import { RentalOrderController } from '../../presentation/controllers/rental-order.controller';
import { RentalExtensionController } from '../../extension/rental-extension.controller';

describe('PrismaRentalContextAdapter (Polymorphic Context Resolution)', () => {
  let adapter: PrismaRentalContextAdapter;
  let prismaMock: any;

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
        findFirst: jest.fn(),
      },
      bookingParticipant: {
        findFirst: jest.fn(),
      },
    };

    adapter = new PrismaRentalContextAdapter(prismaMock);
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
      version: 1,
      pickupPointId: mockPickupPoint.id,
      pickupPoint: mockPickupPoint,
      user: { fullName: 'Nguyễn Văn Member', phone: '0901111111' },
    });

    const context = await adapter.getByTripId(tripId, userId, now);

    expect(context).not.toBeNull();
    expect(context?.rentalEligible).toBe(true);
    expect(context?.bookingId).toBeNull();
    expect(context?.membershipRef).toBe('member-uuid-001');
    expect(context?.membershipRole).toBe('MEMBER');
    expect(context?.membershipStatus).toBe('ACTIVE');
    expect(context?.trip.tripType).toBe('PRIVATE');
    expect(context?.recipientOptions).toHaveLength(1);
    expect(context?.recipientOptions[0].displayName).toBe('Nguyễn Văn Member');
  });

  // ---------------------------------------------------------------------------
  // TEST CASE 2: PUBLIC TRIP LEADER
  // ---------------------------------------------------------------------------
  it('Test Case 2 (Public Leader): User là Leader của Public Trip -> eligible = true, membershipRole = LEADER, recipientOptions chỉ có Leader', async () => {
    const tripId = 'trip-public-uuid';
    const leaderUserId = 'leader-user-uuid';

    prismaMock.trip.findUnique.mockResolvedValue({
      id: tripId,
      title: 'Tour Chinh Phục Bidoup (Public)',
      status: 'OPEN',
      tripType: 'PUBLIC',
      startAt: new Date('2026-10-10T06:00:00Z'),
      endAt: new Date('2026-10-12T18:00:00Z'),
      version: 1,
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
    expect(context?.membershipRole).toBe('LEADER');
    expect(context?.membershipStatus).toBe('ACTIVE');
    expect(context?.recipientOptions).toHaveLength(1);
    expect(context?.recipientOptions[0].memberId).toBe(leaderUserId);
    expect(context?.recipientOptions[0].userId).toBe(leaderUserId);
    expect(context?.recipientOptions[0].displayName).toBe('Trần Leader');
  });

  // ---------------------------------------------------------------------------
  // TEST CASE 3: PUBLIC BOOKING OWNER (CONFIRMED)
  // ---------------------------------------------------------------------------
  it('Test Case 3 (Public Booking Owner): User đặt vé Public Trip với trạng thái CONFIRMED -> eligible = true, bookingId có giá trị', async () => {
    const tripId = 'trip-public-uuid';
    const bookerUserId = 'booker-user-uuid';

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

    prismaMock.booking.findFirst.mockResolvedValue({
      id: 'booking-confirmed-uuid',
      tripId,
      userId: bookerUserId,
      status: 'CONFIRMED',
      version: 2,
      pickupPoint: mockPickupPoint,
      returnPoint: mockReturnPoint,
      user: { fullName: 'Phạm Khách Đặt Vé', phone: '0908888888' },
      bookingParticipantsViaBookingId: [
        {
          id: 'participant-friend-uuid',
          userId: 'friend-user-uuid',
          fullName: 'Vũ Bạn Đi Cùng',
          phone: '0907777777',
          status: 'ACTIVE',
        },
      ],
    });

    const context = await adapter.getByTripId(tripId, bookerUserId, now);

    expect(context).not.toBeNull();
    expect(context?.rentalEligible).toBe(true);
    expect(context?.bookingId).toBe('booking-confirmed-uuid');
    expect(context?.membershipRef).toBe('booking-confirmed-uuid');
    expect(context?.membershipStatus).toBe('ACTIVE');
    expect(context?.recipientOptions).toHaveLength(2);
    expect(context?.recipientOptions[0].displayName).toBe('Phạm Khách Đặt Vé');
    expect(context?.recipientOptions[1].displayName).toBe('Vũ Bạn Đi Cùng');
  });

  // ---------------------------------------------------------------------------
  // TEST CASE 4: PUBLIC BOOKING PARTICIPANT (CONFIRMED)
  // ---------------------------------------------------------------------------
  it('Test Case 4 (Public Participant): User là khách đi cùng trong đơn CONFIRMED -> eligible = true', async () => {
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

    // User is NOT the booking owner
    prismaMock.booking.findFirst.mockResolvedValue(null);

    // User IS a participant in a confirmed booking
    prismaMock.bookingParticipant.findFirst.mockResolvedValue({
      id: 'participant-uuid-002',
      bookingId: 'booking-parent-uuid',
      userId: participantUserId,
      fullName: 'Hoàng Người Đi Cùng',
      phone: '0903333333',
      status: 'ACTIVE',
      user: { fullName: 'Hoàng Người Đi Cùng', phone: '0903333333' },
      booking: {
        id: 'booking-parent-uuid',
        tripId,
        status: 'CONFIRMED',
        version: 1,
        pickupPoint: mockPickupPoint,
        returnPoint: mockReturnPoint,
      },
    });

    const context = await adapter.getByTripId(tripId, participantUserId, now);

    expect(context).not.toBeNull();
    expect(context?.rentalEligible).toBe(true);
    expect(context?.bookingId).toBe('booking-parent-uuid');
    expect(context?.membershipRef).toBe('participant-uuid-002');
    expect(context?.membershipRole).toBe('PARTICIPANT');
    expect(context?.recipientOptions).toHaveLength(1);
    expect(context?.recipientOptions[0].displayName).toBe('Hoàng Người Đi Cùng');
  });

  // ---------------------------------------------------------------------------
  // TEST CASE 5: PUBLIC BOOKING UNPAID OR CANCELLED
  // ---------------------------------------------------------------------------
  it('Test Case 5 (Public Booking Unpaid/Cancelled): Booking ở trạng thái PENDING_PAYMENT -> eligible = false', async () => {
    const tripId = 'trip-public-uuid';
    const bookerUserId = 'booker-unpaid-uuid';

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
      leaderId: 'leader-uuid',
      leader: null,
      tripTransportsViaTripId: [mockTransport],
      tripTrailPlansViaTripId: [],
      weatherSnapshotsViaTripId: [],
    });

    // First query for CONFIRMED returns null
    // Second query returns the PENDING_PAYMENT booking
    prismaMock.booking.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'booking-unpaid-uuid',
        tripId,
        userId: bookerUserId,
        status: 'PENDING_PAYMENT',
        version: 1,
        pickupPoint: mockPickupPoint,
        returnPoint: mockReturnPoint,
        user: { fullName: 'Khách Chưa Thanh Toán', phone: '0904444444' },
        bookingParticipantsViaBookingId: [],
      });

    const context = await adapter.getByTripId(tripId, bookerUserId, now);

    expect(context).not.toBeNull();
    expect(context?.rentalEligible).toBe(false);
    expect(context?.ineligibleReason).toBe('TRIP_MEMBERSHIP_NOT_ELIGIBLE');
    expect(context?.membershipStatus).toBe('PENDING_PAYMENT');
  });

  // ---------------------------------------------------------------------------
  // TEST CASE 6: NON-MEMBER (NOT IN TRIP)
  // ---------------------------------------------------------------------------
  it('Test Case 6 (Non-member): Người ngoài không có trong chuyến đi -> trả về null', async () => {
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

    prismaMock.booking.findFirst.mockResolvedValue(null);
    prismaMock.bookingParticipant.findFirst.mockResolvedValue(null);
    prismaMock.tripMember.findUnique.mockResolvedValue(null);

    const context = await adapter.getByTripId(tripId, strangerUserId, now);

    expect(context).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // TEST CASE 7: ROLE GUARDS REGISTRATION
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
