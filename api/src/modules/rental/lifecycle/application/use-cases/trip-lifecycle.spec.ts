 
import {
  Prisma,
  RentalOrderStatus,
  RentalOrderExceptionStatus,
  RentalFinancialStatus,
  ReservationStatus,
  EquipmentUnitStatus,
  EquipmentCondition,
  RentalUnitAssignmentStatus,
  DeliveryTaskStatus,
  InventoryTaskStatus,
  PackageStatus,
} from '@prisma/client';
import { AppError } from 'src/shared/errors/app-error';
import { HandleTripRescheduledUseCase } from './handle-trip-rescheduled.use-case';
import { HandleTripCancelledUseCase } from './handle-trip-cancelled.use-case';
import { HandleBookingCancelledUseCase } from './handle-booking-cancelled.use-case';
import { PrismaTripLifecycleAdapter } from '../../infrastructure/adapters/prisma-trip-lifecycle.adapter';
import type {
  TripLifecyclePort,
  TripRescheduledCommand,
  TripCancelledCommand,
  BookingCancelledCommand,
  MembershipSourceChangedCommand,
  LifecycleExecutionResult,
} from '../ports/trip-lifecycle.port';

describe('Phase 07A: Trip Lifecycle Integration & Hardening Unit Tests', () => {
  describe('Use Cases Validation Gate', () => {
    let mockPort: jest.Mocked<TripLifecyclePort>;
    let rescheduleUseCase: HandleTripRescheduledUseCase;
    let cancelTripUseCase: HandleTripCancelledUseCase;
    let cancelBookingUseCase: HandleBookingCancelledUseCase;

    beforeEach(() => {
      mockPort = {
        processTripRescheduled: jest.fn(),
        processTripCancelled: jest.fn(),
        processBookingCancelled: jest.fn(),
        processMembershipSourceChanged: jest.fn(),
      };
      rescheduleUseCase = new HandleTripRescheduledUseCase(mockPort);
      cancelTripUseCase = new HandleTripCancelledUseCase(mockPort);
      cancelBookingUseCase = new HandleBookingCancelledUseCase(mockPort);
    });

    it('rejects TRIP_RESCHEDULED with missing eventId or tripId', async () => {
      const invalidCmd: TripRescheduledCommand = {
        eventId: '',
        eventType: 'TRIP_RESCHEDULED',
        entityId: 'trip-1',
        entityVersion: 2,
        correlationId: 'corr-1',
        occurredAt: new Date(),
        payload: {
          tripId: '',
          newStartAt: new Date('2026-11-01T08:00:00Z'),
          newEndAt: new Date('2026-11-03T18:00:00Z'),
          contextVersion: 2,
        },
      };

      await expect(rescheduleUseCase.execute(invalidCmd)).rejects.toThrow(AppError);
      expect(mockPort.processTripRescheduled).not.toHaveBeenCalled();
    });

    it('rejects TRIP_RESCHEDULED when newStartAt >= newEndAt', async () => {
      const invalidCmd: TripRescheduledCommand = {
        eventId: 'evt-1',
        eventType: 'TRIP_RESCHEDULED',
        entityId: 'trip-1',
        entityVersion: 2,
        correlationId: 'corr-1',
        occurredAt: new Date(),
        payload: {
          tripId: 'trip-1',
          newStartAt: new Date('2026-11-05T08:00:00Z'),
          newEndAt: new Date('2026-11-01T18:00:00Z'),
          contextVersion: 2,
        },
      };

      await expect(rescheduleUseCase.execute(invalidCmd)).rejects.toThrow(AppError);
      expect(mockPort.processTripRescheduled).not.toHaveBeenCalled();
    });

    it('rejects TRIP_RESCHEDULED when entityId does not match payload.tripId', async () => {
      const invalidCmd: TripRescheduledCommand = {
        eventId: 'evt-1',
        eventType: 'TRIP_RESCHEDULED',
        entityId: 'trip-1',
        entityVersion: 2,
        correlationId: 'corr-1',
        occurredAt: new Date(),
        payload: {
          tripId: 'trip-2',
          newStartAt: new Date('2026-11-01T08:00:00Z'),
          newEndAt: new Date('2026-11-03T18:00:00Z'),
          contextVersion: 2,
        },
      };

      await expect(rescheduleUseCase.execute(invalidCmd)).rejects.toThrow(AppError);
    });

    it('delegates valid TRIP_RESCHEDULED to port', async () => {
      const validCmd: TripRescheduledCommand = {
        eventId: 'evt-valid',
        eventType: 'TRIP_RESCHEDULED',
        entityId: 'trip-1',
        entityVersion: 2,
        correlationId: 'corr-valid',
        occurredAt: new Date(),
        payload: {
          tripId: 'trip-1',
          newStartAt: new Date('2026-11-01T08:00:00Z'),
          newEndAt: new Date('2026-11-03T18:00:00Z'),
          contextVersion: 2,
        },
      };

      mockPort.processTripRescheduled.mockResolvedValue({
        eventId: 'evt-valid',
        status: 'PROCESSED',
        affectedOrderCount: 1,
        affectedOrderIds: ['order-1'],
        conflicts: [],
        scheduleNoticesIssued: [],
      });

      const res = await rescheduleUseCase.execute(validCmd);
      expect(res.status).toBe('PROCESSED');
      expect(mockPort.processTripRescheduled).toHaveBeenCalledWith(validCmd);
    });

    it('rejects TRIP_CANCELLED when entityId does not match payload.tripId', async () => {
      const invalidCmd: TripCancelledCommand = {
        eventId: 'evt-cancel',
        eventType: 'TRIP_CANCELLED',
        entityId: 'trip-1',
        entityVersion: 3,
        correlationId: 'corr-2',
        occurredAt: new Date(),
        payload: {
          tripId: 'trip-different',
          reason: 'Severe weather',
          effectiveAt: new Date(),
          tripVersion: 3,
        },
      };

      await expect(cancelTripUseCase.execute(invalidCmd)).rejects.toThrow(AppError);
    });

    it('rejects BOOKING_CANCELLED when entityId does not match payload.bookingId', async () => {
      const invalidCmd: BookingCancelledCommand = {
        eventId: 'evt-bk-cancel',
        eventType: 'BOOKING_CANCELLED',
        entityId: 'booking-1',
        entityVersion: 1,
        correlationId: 'corr-3',
        occurredAt: new Date(),
        payload: {
          bookingId: 'booking-2',
          reason: 'User withdrawal',
          effectiveAt: new Date(),
          version: 1,
        },
      };

      await expect(cancelBookingUseCase.execute(invalidCmd)).rejects.toThrow(AppError);
    });
  });

  describe('PrismaTripLifecycleAdapter Business Invariants & Hardening', () => {
    let mockPrisma: any;
    let adapter: PrismaTripLifecycleAdapter;
    let mockTx: any;

    const PRIMARY_LOC_ID = '11111111-1111-4111-8111-111111111111';
    const originalEnvLoc = process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID;

    beforeEach(() => {
      process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID = PRIMARY_LOC_ID;
      mockPrisma = {
        $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => cb(mockTx)),
        rentalInboxEvent: {
          findUnique: jest.fn().mockResolvedValue(null),
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };
      adapter = new PrismaTripLifecycleAdapter(mockPrisma);

      mockTx = {
        inventoryLocation: {
          findFirst: jest.fn().mockResolvedValue({ id: PRIMARY_LOC_ID, status: 'ACTIVE' }),
          findUnique: jest.fn().mockResolvedValue({ id: PRIMARY_LOC_ID, status: 'ACTIVE' }),
        },
        $queryRaw: jest.fn().mockResolvedValue([]),
        rentalInboxEvent: {
          findUnique: jest.fn().mockResolvedValue(null),
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'inbox-1' }),
          update: jest.fn().mockResolvedValue({ id: 'inbox-1' }),
        },
        rentalOrder: {
          findMany: jest.fn(),
          findUnique: jest.fn().mockResolvedValue({
            id: 'order-active',
            tripId: 'trip-1',
            rentalEndAt: new Date('2026-10-25T18:00:00Z'),
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        rentalQuantityReservation: {
          findMany: jest.fn().mockResolvedValue([]),
          update: jest.fn().mockResolvedValue({}),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        rentalExtensionRequest: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
        bookingCancellation: { findFirst: jest.fn().mockResolvedValue(null) },
        invoice: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
        payment: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
        rentalUnitAssignment: {
          update: jest.fn().mockResolvedValue({}),
        },
        package: {
          update: jest.fn().mockResolvedValue({}),
        },
        equipmentUnit: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'unit-1',
              status: EquipmentUnitStatus.AVAILABLE,
              currentInventoryLocationId: PRIMARY_LOC_ID,
              homeInventoryLocationId: PRIMARY_LOC_ID,
              readinessCommitmentsViaUnitId: [],
              returnInspectionTasks: [],
            },
            {
              id: 'unit-2',
              status: EquipmentUnitStatus.AVAILABLE,
              currentInventoryLocationId: PRIMARY_LOC_ID,
              homeInventoryLocationId: PRIMARY_LOC_ID,
              readinessCommitmentsViaUnitId: [],
              returnInspectionTasks: [],
            },
          ]),
          update: jest.fn().mockResolvedValue({}),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        inventoryTask: {
          update: jest.fn().mockResolvedValue({}),
        },
        deliveryTask: {
          update: jest.fn().mockResolvedValue({}),
        },
        rentalDocument: {
          findFirst: jest.fn(),
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'doc-notice-1' }),
          count: jest.fn().mockResolvedValue(0),
        },
        rentalOutboxEvent: {
          upsert: jest.fn().mockResolvedValue({}),
        },
      };
    });

    afterAll(() => {
      if (originalEnvLoc !== undefined) {
        process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID = originalEnvLoc;
      } else {
        delete process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID;
      }
    });

    const mockPolicy = {
      prepBufferMinutes: 60,
      returnBufferMinutes: 1440,
      cleaningBufferMinutes: 1440,
      deepInspectionBufferMinutes: 2880,
    };

    function mockVerifiedRentalPayment(orderId: string) {
      const amount = new Prisma.Decimal(150);
      mockTx.payment.findMany.mockResolvedValue([{ id: 'paid-payment-1', amount }]);
      mockTx.payment.count = jest.fn().mockResolvedValue(1);
      mockTx.payment.findUniqueOrThrow = jest.fn().mockResolvedValue({
        id: 'paid-payment-1', amount, status: 'SUCCEEDED', currency: 'VND',
        invoice: { rentalOrderId: orderId, invoiceType: 'RENTAL' },
        application: { status: 'APPLIED' }, reconcileStatus: 'RESOLVED',
        paymentGateway: 'momo', providerEnvironment: 'MOCK',
        merchantAccountKey: 'merchant-1', merchantRequestRef: 'request-1',
        allocations: [
          { id: 'deposit-1', component: 'RENTAL_DEPOSIT', amount: new Prisma.Decimal(50) },
          { id: 'fee-1', component: 'RENTAL_FEE', amount: new Prisma.Decimal(100) },
        ],
      });
      mockTx.refund = {
        findUnique: jest.fn().mockResolvedValue(null),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
        create: jest.fn().mockImplementation(async ({ data }: any) => ({ ...data, status: 'PENDING' })),
      };
      mockTx.refundAllocation = { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }) };
    }

    it('Trip hủy trước bàn giao đặt hoàn toàn bộ và hủy khoản thanh toán chờ', async () => {
      const order = {
        id: 'paid-trip-order', tripId: 'trip-1', bookingId: null,
        status: RentalOrderStatus.PAID, financialStatus: 'PAID', version: 1,
        contextVersionSnapshot: 1,
        rentalFee: new Prisma.Decimal(100), totalDeposit: new Prisma.Decimal(50),
        rentalStartAt: new Date('2026-11-01T08:00:00Z'), rentalPolicy: { freeCancellationHours: 24 },
        rentalOrderLinesViaOrderId: [], inventoryTaskViaOrderId: null, deliveryTasksViaOrderId: [],
      };
      mockVerifiedRentalPayment(order.id);
      mockTx.rentalOrder.findMany.mockResolvedValue([order]);
      mockTx.invoice.findMany.mockResolvedValue([{ id: 'pending-invoice-1' }]);
      const effectiveAt = new Date('2026-10-30T08:00:00Z');
      await adapter.processTripCancelled({
        eventId: 'trip-financial-event', eventType: 'TRIP_CANCELLED', entityId: 'trip-1',
        entityVersion: 2, correlationId: 'trip-financial', occurredAt: effectiveAt,
        payload: { tripId: 'trip-1', reason: 'Operator cancelled', effectiveAt, tripVersion: 2 },
      });
      expect(mockTx.refund.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ amount: new Prisma.Decimal(150) }),
      }));
      expect(mockTx.rentalOrder.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ financialStatus: 'REFUND_PENDING' }),
      }));
      expect(mockTx.payment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ status: { in: ['PENDING', 'PROCESSING'] } }),
      }));
    });

    it('Booking USER hủy sau hạn: chỉ hoàn cọc cho Rental đã thanh toán', async () => {
      const order = {
        id: 'paid-booking-order', tripId: 'trip-1', bookingId: 'booking-1',
        status: RentalOrderStatus.PAID, financialStatus: 'PAID', version: 1,
        contextVersionSnapshot: 1,
        rentalFee: new Prisma.Decimal(100), totalDeposit: new Prisma.Decimal(50),
        rentalStartAt: new Date('2026-11-01T08:00:00Z'), rentalPolicy: { freeCancellationHours: 24 },
        rentalOrderLinesViaOrderId: [], inventoryTaskViaOrderId: null, deliveryTasksViaOrderId: [],
      };
      mockVerifiedRentalPayment(order.id);
      mockTx.bookingCancellation.findFirst.mockResolvedValue({
        source: 'USER', cancelledAt: new Date('2026-10-31T08:00:01Z'),
      });
      mockTx.rentalOrder.findMany.mockResolvedValue([order]);
      const effectiveAt = new Date('2026-10-31T08:00:01Z');
      await adapter.processBookingCancelled({
        eventId: 'booking-financial-event', eventType: 'BOOKING_CANCELLED', entityId: 'booking-1',
        entityVersion: 2, correlationId: 'booking-financial', occurredAt: effectiveAt,
        payload: { bookingId: 'booking-1', reason: 'User cancelled', effectiveAt, version: 2 },
      });
      expect(mockTx.refund.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ amount: new Prisma.Decimal(50) }),
      }));
      expect(mockTx.rentalOrder.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ financialStatus: 'REFUND_PENDING' }),
      }));
    });

    it('IDEMPOTENCY: returns existing result on duplicate eventId', async () => {
      const cachedResult = {
        eventId: 'evt-dup',
        status: 'PROCESSED',
        affectedOrderCount: 1,
        affectedOrderIds: ['order-1'],
        conflicts: [],
        scheduleNoticesIssued: [],
      };
      mockTx.rentalInboxEvent.findUnique.mockResolvedValue({
        id: 'inbox-cached',
        result: cachedResult,
      });

      const cmd: TripRescheduledCommand = {
        eventId: 'evt-dup',
        eventType: 'TRIP_RESCHEDULED',
        entityId: 'trip-1',
        entityVersion: 2,
        correlationId: 'corr-dup',
        occurredAt: new Date(),
        payload: {
          tripId: 'trip-1',
          newStartAt: new Date('2026-11-01T08:00:00Z'),
          newEndAt: new Date('2026-11-03T18:00:00Z'),
          contextVersion: 2,
        },
      };

      const result = await adapter.processTripRescheduled(cmd);
      expect(result.status).toBe('PROCESSED');
      expect(mockTx.rentalOrder.findMany).not.toHaveBeenCalled();
    });

    it('OUT-OF-ORDER (P1-05): skips reschedule if order.contextVersionSnapshot >= event.contextVersion', async () => {
      mockTx.rentalOrder.findMany.mockResolvedValue([
        {
          id: 'order-newer',
          status: RentalOrderStatus.PAID,
          version: 5,
          contextVersionSnapshot: 5, // Order is already on v5
          rentalPolicy: mockPolicy,
          rentalOrderLinesViaOrderId: [],
          deliveryTasksViaOrderId: [],
        },
      ]);

      const cmd: TripRescheduledCommand = {
        eventId: 'evt-old',
        eventType: 'TRIP_RESCHEDULED',
        entityId: 'trip-1',
        entityVersion: 3, // Event is v3 (stale)
        correlationId: 'corr-stale',
        occurredAt: new Date(),
        payload: {
          tripId: 'trip-1',
          newStartAt: new Date('2026-11-01T08:00:00Z'),
          newEndAt: new Date('2026-11-03T18:00:00Z'),
          contextVersion: 3,
        },
      };

      const result = await adapter.processTripRescheduled(cmd);
      expect(result.affectedOrderCount).toBe(0);
      expect(mockTx.rentalOrder.update).not.toHaveBeenCalled();
    });

    it('OUT-OF-ORDER (P1-05): skips cancellation if order.contextVersionSnapshot >= eventVersion', async () => {
      mockTx.rentalOrder.findMany.mockResolvedValue([
        {
          id: 'order-newer',
          status: RentalOrderStatus.PAID,
          version: 4,
          contextVersionSnapshot: 4,
          rentalPolicy: mockPolicy,
          rentalOrderLinesViaOrderId: [],
          deliveryTasksViaOrderId: [],
        },
      ]);

      const cmd: TripCancelledCommand = {
        eventId: 'evt-old-cancel',
        eventType: 'TRIP_CANCELLED',
        entityId: 'trip-1',
        entityVersion: 2,
        correlationId: 'corr-cancel',
        occurredAt: new Date(),
        payload: {
          tripId: 'trip-1',
          reason: 'Old event',
          effectiveAt: new Date(),
          tripVersion: 2, // Older than order contextVersionSnapshot 4
        },
      };

      const result = await adapter.processTripCancelled(cmd);
      expect(result.cancelledOrderIds).toEqual([]);
      expect(mockTx.rentalOrder.update).not.toHaveBeenCalled();
    });

    it('RESCHEDULE CAPACITY (P0-03 & P1-04): excludes own existing reservations and applies RB-POL-30 formula (12h prep, 24h buffer, no 8h+8h)', async () => {
      const newStartAt = new Date('2026-11-01T08:00:00Z');
      const newEndAt = new Date('2026-11-04T18:00:00Z');
      const originalRentalEndAt = new Date('2026-10-25T18:00:00Z');
      const order = {
        id: 'order-pre',
        tripId: 'trip-1',
        status: RentalOrderStatus.PAID,
        version: 1,
        rentalStartAt: newStartAt,
        rentalEndAt: originalRentalEndAt,
        rentalFee: '500000.00',
        contextVersionSnapshot: 1,
        occupiedStartAt: new Date('2026-10-20T07:00:00Z'),
        occupiedEndAt: new Date('2026-10-26T18:00:00Z'),
        plannedHandoverAt: new Date('2026-10-20T08:00:00Z'),
        plannedReturnAt: new Date('2026-10-25T18:00:00Z'),
        operationalReturnDueAt: new Date('2026-10-25T18:00:00Z'),
        rentalPolicy: mockPolicy,
        rentalOrderLinesViaOrderId: [
          {
            id: 'line-1',
            productId: 'prod-tent',
            quantity: 1,
            product: { requiresDeepReturnInspection: false },
            rentalQuantityReservationsViaOrderLineId: [
              { id: 'res-own-1', version: 1, occupiedFrom: new Date('2026-10-20T07:00:00Z'), occupiedUntil: new Date('2026-10-26T18:00:00Z') },
            ],
          },
        ],
        deliveryTasksViaOrderId: [
          { id: 'dt-handover', taskType: 'HANDOVER', status: DeliveryTaskStatus.SCHEDULED },
          { id: 'dt-return', taskType: 'RETURN', status: DeliveryTaskStatus.SCHEDULED },
        ],
      };

      mockTx.rentalOrder.findMany.mockResolvedValue([order]);

      const cmd: TripRescheduledCommand = {
        eventId: 'evt-resched-1',
        eventType: 'TRIP_RESCHEDULED',
        entityId: 'trip-1',
        entityVersion: 2,
        correlationId: 'corr-resched-1',
        occurredAt: new Date(),
        payload: {
          tripId: 'trip-1',
          newStartAt,
          newEndAt,
          contextVersion: 2,
        },
      };

      const result = await adapter.processTripRescheduled(cmd);
      expect(result.status).toBe('PROCESSED');
      expect(result.affectedOrderIds).toContain('order-pre');

      // Verify RB-POL-30 formula:
      // occupiedFrom = plannedHandoverAt - 12 hours (12 * 3600_000)
      const expectedOccupiedFrom = new Date(newStartAt.getTime() - 12 * 3600_000);
      // occupiedUntil = effectiveDueAt(originalRentalEndAt, newEndAt) + 24 hours (24 * 3600_000)
      // Since newEndAt (Nov 04) > originalRentalEndAt (Oct 25), effectiveDue = Nov 04T18:00:00Z
      const expectedOccupiedUntil = new Date(newEndAt.getTime() + 24 * 3600_000);

      // Verify reservation updated with expected RB-POL-30 window
      expect(mockTx.rentalQuantityReservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res-own-1' },
          data: expect.objectContaining({
            occupiedFrom: expectedOccupiedFrom,
            occupiedUntil: expectedOccupiedUntil,
          }),
        }),
      );

      // Verify optimistic locking on order update
      expect(mockTx.rentalOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-pre', version: 1 },
          data: expect.objectContaining({
            plannedHandoverAt: newStartAt,
            plannedReturnAt: newEndAt,
            operationalReturnDueAt: newEndAt,
            contextVersionSnapshot: 2,
          }),
        }),
      );
    });

    it('RESCHEDULE CAPACITY CONFLICT (P0-03): preserves existing reservation all-or-nothing on pre-handover shortage', async () => {
      const order = {
        id: 'order-pre-conflict',
        tripId: 'trip-1',
        status: RentalOrderStatus.PAID,
        version: 2,
        rentalEndAt: new Date('2026-10-25T18:00:00Z'),
        rentalFee: '500000.00',
        contextVersionSnapshot: 1,
        occupiedStartAt: new Date('2026-10-20T07:00:00Z'),
        occupiedEndAt: new Date('2026-10-26T18:00:00Z'),
        plannedHandoverAt: new Date('2026-10-20T08:00:00Z'),
        plannedReturnAt: new Date('2026-10-25T18:00:00Z'),
        operationalReturnDueAt: new Date('2026-10-25T18:00:00Z'),
        rentalPolicy: mockPolicy,
        rentalOrderLinesViaOrderId: [
          {
            id: 'line-c1',
            productId: 'prod-scarce',
            quantity: 5,
            product: { requiresDeepReturnInspection: false },
            rentalQuantityReservationsViaOrderLineId: [
              { id: 'res-c1', version: 1, occupiedFrom: new Date('2026-10-20T07:00:00Z'), occupiedUntil: new Date('2026-10-26T18:00:00Z') },
            ],
          },
        ],
        deliveryTasksViaOrderId: [],
      };

      mockTx.rentalOrder.findMany.mockResolvedValue([order]);
      // Mock shortage: only 2 available units for requested 5
      mockTx.equipmentUnit.findMany.mockResolvedValue([
        {
          id: 'u-1',
          status: EquipmentUnitStatus.AVAILABLE,
          currentInventoryLocationId: 'loc-1',
          homeInventoryLocationId: 'loc-1',
          readinessCommitmentsViaUnitId: [],
          returnInspectionTasks: [],
        },
        {
          id: 'u-2',
          status: EquipmentUnitStatus.AVAILABLE,
          currentInventoryLocationId: 'loc-1',
          homeInventoryLocationId: 'loc-1',
          readinessCommitmentsViaUnitId: [],
          returnInspectionTasks: [],
        },
      ]);

      const cmd: TripRescheduledCommand = {
        eventId: 'evt-conflict-pre',
        eventType: 'TRIP_RESCHEDULED',
        entityId: 'trip-1',
        entityVersion: 2,
        correlationId: 'corr-conflict',
        occurredAt: new Date(),
        payload: {
          tripId: 'trip-1',
          newStartAt: new Date('2026-11-01T08:00:00Z'),
          newEndAt: new Date('2026-11-04T18:00:00Z'),
          contextVersion: 2,
        },
      };

      const result = await adapter.processTripRescheduled(cmd);
      expect(result.conflicts.length).toBe(1);
      expect(result.conflicts[0].orderId).toBe('order-pre-conflict');

      // Invariant: Existing reservations MUST NOT be modified or dropped!
      expect(mockTx.rentalQuantityReservation.update).not.toHaveBeenCalled();

      // Order marked ACTION_REQUIRED with optimistic lock
      expect(mockTx.rentalOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-pre-conflict', version: 2 },
          data: expect.objectContaining({
            exceptionStatus: RentalOrderExceptionStatus.ACTION_REQUIRED,
            contextVersionSnapshot: 2,
          }),
        }),
      );

      // Outbox event RENTAL_ACTION_REQUIRED emitted
      expect(mockTx.rentalOutboxEvent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            eventType: 'RENTAL_ACTION_REQUIRED',
            aggregateId: 'order-pre-conflict',
          }),
        }),
      );
    });

    it('RESCHEDULE ACTIVE (P0-03 & P1-06): preserves active user occupancy, updates operational schedule, and emits SCHEDULE_NOTICE', async () => {
      const originalRentalEndAt = new Date('2026-10-25T18:00:00Z');
      const oldDueAt = new Date('2026-10-25T18:00:00Z');
      const order = {
        id: 'order-active-1',
        tripId: 'trip-1',
        status: RentalOrderStatus.ACTIVE,
        version: 3,
        rentalEndAt: originalRentalEndAt,
        rentalFee: '600000.00',
        contextVersionSnapshot: 1,
        occupiedStartAt: new Date('2026-10-20T07:00:00Z'),
        occupiedEndAt: new Date('2026-10-26T18:00:00Z'),
        plannedHandoverAt: new Date('2026-10-20T08:00:00Z'),
        plannedReturnAt: oldDueAt,
        operationalReturnDueAt: oldDueAt,
        rentalPolicy: mockPolicy,
        rentalOrderLinesViaOrderId: [
          {
            id: 'line-active-1',
            productId: 'prod-tent',
            quantity: 1,
            product: { requiresDeepReturnInspection: false },
            rentalQuantityReservationsViaOrderLineId: [
              { id: 'res-act-1', version: 1, occupiedFrom: new Date('2026-10-20T07:00:00Z'), occupiedUntil: new Date('2026-10-26T18:00:00Z') },
            ],
          },
        ],
        deliveryTasksViaOrderId: [
          { id: 'dt-ret-active', taskType: 'RETURN', status: DeliveryTaskStatus.SCHEDULED },
        ],
      };

      mockTx.rentalOrder.findMany.mockResolvedValue([order]);
      mockTx.rentalDocument.findFirst.mockResolvedValue({ id: 'doc-handover-root' });

      const newStartAt = new Date('2026-10-20T08:00:00Z');
      const newEndAt = new Date('2026-10-28T18:00:00Z'); // Extended by trip

      const cmd: TripRescheduledCommand = {
        eventId: 'evt-active-resched',
        eventType: 'TRIP_RESCHEDULED',
        entityId: 'trip-1',
        entityVersion: 2,
        correlationId: 'corr-active-resched',
        occurredAt: new Date(),
        payload: {
          tripId: 'trip-1',
          newStartAt,
          newEndAt,
          contextVersion: 2,
        },
      };

      const result = await adapter.processTripRescheduled(cmd);
      expect(result.scheduleNoticesIssued.length).toBe(1);

      // Verify active user's actual occupation is updated and extended
      expect(mockTx.rentalQuantityReservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res-act-1' },
          data: expect.objectContaining({
            occupiedUntil: new Date(newEndAt.getTime() + 24 * 3600_000),
          }),
        }),
      );

      // Verify operational schedule is recorded correctly with optimistic lock
      expect(mockTx.rentalOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-active-1', version: 3 },
          data: expect.objectContaining({
            operationalReturnDueAt: newEndAt,
            plannedReturnAt: newEndAt,
          }),
        }),
      );

      // Verify documentary SCHEDULE_NOTICE emitted
      expect(mockTx.rentalOutboxEvent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            eventType: 'RENTAL_SCHEDULE_NOTICE_ISSUED',
            aggregateId: 'order-active-1',
          }),
        }),
      );
    });

    it('CUSTODY ON PRE-HANDOVER CANCELLATION (P0-02): units NOT set to AVAILABLE when package has been transferred to delivery', async () => {
      const order = {
        id: 'order-transferred-cancel',
        tripId: 'trip-1',
        status: RentalOrderStatus.READY_FOR_HANDOVER,
        version: 2,
        financialStatus: 'PAID',
        rentalEndAt: new Date('2026-10-25T18:00:00Z'),
        contextVersionSnapshot: 1,
        rentalOrderLinesViaOrderId: [
          {
            rentalUnitAssignmentsViaOrderLineId: [
              {
                equipmentUnitId: 'unit-with-delivery',
                equipmentUnit: {
                  id: 'unit-with-delivery',
                  status: EquipmentUnitStatus.PACKED,
                  currentInventoryLocationId: null, // Out of warehouse!
                },
              },
            ],
          },
        ],
        inventoryTaskViaOrderId: {
          id: 'inv-task-1',
          status: InventoryTaskStatus.TRANSFERRED, // Already transferred to delivery
          package: { status: PackageStatus.TRANSFERRED_TO_DELIVERY },
        },
        deliveryTasksViaOrderId: [
          {
            id: 'del-task-1',
            status: DeliveryTaskStatus.PACKAGE_RECEIVED, // Delivery staff has physical custody!
            taskType: 'HANDOVER',
          },
        ],
      };

      mockTx.rentalOrder.findMany.mockResolvedValue([order]);

      const cmd: TripCancelledCommand = {
        eventId: 'evt-cancel-transfer',
        eventType: 'TRIP_CANCELLED',
        entityId: 'trip-1',
        entityVersion: 2,
        correlationId: 'corr-cancel-transfer',
        occurredAt: new Date(),
        payload: {
          tripId: 'trip-1',
          reason: 'Trip cancelled by leader',
          effectiveAt: new Date(),
          tripVersion: 2,
        },
      };

      const result = await adapter.processTripCancelled(cmd);
      expect(result.cancelledOrderIds).toContain('order-transferred-cancel');
      expect(result.actionRequiredOrderIds).toContain('order-transferred-cancel');

      // CRITICAL P0-02 INVARIANT: EquipmentUnit MUST NOT be set to AVAILABLE!
      expect(mockTx.equipmentUnit.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: EquipmentUnitStatus.AVAILABLE }),
        }),
      );

      // Delivery task marked with required return note
      expect(mockTx.deliveryTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'del-task-1' },
          data: expect.objectContaining({
            exceptionNotes: 'RETURN_TO_INVENTORY_LOCATION_REQUIRED',
          }),
        }),
      );

      // Order marked CANCELLED with exceptionStatus: ACTION_REQUIRED
      expect(mockTx.rentalOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-transferred-cancel', version: 2 },
          data: expect.objectContaining({
            status: RentalOrderStatus.CANCELLED,
            exceptionStatus: RentalOrderExceptionStatus.ACTION_REQUIRED,
          }),
        }),
      );

      // Outbox RENTAL_ACTION_REQUIRED emitted for custody recovery
      expect(mockTx.rentalOutboxEvent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            eventType: 'RENTAL_ACTION_REQUIRED',
            aggregateId: 'order-transferred-cancel',
          }),
        }),
      );
    });

    it('CUSTODY ON PRE-HANDOVER CANCELLATION (P0-02): units safely returned to AVAILABLE when still at InventoryLocation', async () => {
      const order = {
        id: 'order-warehouse-cancel',
        tripId: 'trip-1',
        status: RentalOrderStatus.PREPARING,
        version: 1,
        financialStatus: 'PAID',
        rentalEndAt: new Date('2026-10-25T18:00:00Z'),
        contextVersionSnapshot: 1,
        rentalOrderLinesViaOrderId: [
          {
            rentalUnitAssignmentsViaOrderLineId: [
              {
                equipmentUnitId: 'unit-in-warehouse',
                equipmentUnit: {
                  id: 'unit-in-warehouse',
                  status: EquipmentUnitStatus.PICKED,
                  currentInventoryLocationId: PRIMARY_LOC_ID, // Still physically at primary warehouse!
                  condition: EquipmentCondition.GOOD,
                },
              },
            ],
          },
        ],
        inventoryTaskViaOrderId: {
          id: 'inv-task-2',
          status: InventoryTaskStatus.PICKING,
          package: null,
        },
        deliveryTasksViaOrderId: [
          {
            id: 'del-task-2',
            status: DeliveryTaskStatus.SCHEDULED,
            taskType: 'HANDOVER',
          },
        ],
      };

      mockTx.rentalOrder.findMany.mockResolvedValue([order]);

      const cmd: TripCancelledCommand = {
        eventId: 'evt-cancel-warehouse',
        eventType: 'TRIP_CANCELLED',
        entityId: 'trip-1',
        entityVersion: 2,
        correlationId: 'corr-cancel-wh',
        occurredAt: new Date(),
        payload: {
          tripId: 'trip-1',
          reason: 'Cancelled before transfer',
          effectiveAt: new Date(),
          tripVersion: 2,
        },
      };

      // Mô phỏng điều kiện version của Prisma: lần update thứ hai với version cũ sẽ lỗi.
      let persistedVersion = order.version;
      mockTx.rentalOrder.update.mockImplementation(async ({ where, data }: any) => {
        if (where.version !== persistedVersion) throw new Error('P2025');
        persistedVersion += data.version.increment;
        return { ...order, version: persistedVersion };
      });
      const result = await adapter.processTripCancelled(cmd);
      expect(result.cancelledOrderIds).toContain('order-warehouse-cancel');
      expect(mockTx.rentalOrder.update).toHaveBeenCalledTimes(1);
      expect(mockTx.rentalOrder.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: order.id, version: order.version },
        data: expect.objectContaining({
          cancelledAt: cmd.payload.effectiveAt,
          contextVersionSnapshot: cmd.payload.tripVersion,
          version: { increment: 1 },
        }),
      }));

      // Units at warehouse can safely be set to AVAILABLE
      expect(mockTx.equipmentUnit.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'unit-in-warehouse' },
          data: expect.objectContaining({ status: EquipmentUnitStatus.AVAILABLE }),
        }),
      );

      // Tasks closed/cancelled
      expect(mockTx.inventoryTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-task-2' },
          data: expect.objectContaining({ status: InventoryTaskStatus.CLOSED }),
        }),
      );
      expect(mockTx.deliveryTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'del-task-2' },
          data: expect.objectContaining({ status: DeliveryTaskStatus.CANCELLED }),
        }),
      );
    });

    it('CANCELLATION ACTIVE (P1-06): preserves user custody, contractual rentalEndAt, no forced due truncation', async () => {
      const contractEndAt = new Date('2026-10-30T18:00:00Z');
      const order = {
        id: 'order-active-cancel',
        tripId: 'trip-1',
        status: RentalOrderStatus.ACTIVE,
        version: 4,
        rentalEndAt: contractEndAt, // Contractual end date
        operationalReturnDueAt: contractEndAt,
        contextVersionSnapshot: 1,
        rentalOrderLinesViaOrderId: [],
        inventoryTaskViaOrderId: null,
        deliveryTasksViaOrderId: [
          { id: 'dt-ret-active', taskType: 'RETURN', status: DeliveryTaskStatus.SCHEDULED },
        ],
      };

      mockTx.rentalOrder.findMany.mockResolvedValue([order]);

      const tripAbortEffectiveAt = new Date('2026-10-22T10:00:00Z'); // Aborted on day 2

      const cmd: TripCancelledCommand = {
        eventId: 'evt-abort-active',
        eventType: 'TRIP_ABORTED',
        entityId: 'trip-1',
        entityVersion: 2,
        correlationId: 'corr-abort-active',
        occurredAt: new Date(),
        payload: {
          tripId: 'trip-1',
          reason: 'Trip aborted due to mountain closure',
          effectiveAt: tripAbortEffectiveAt,
          tripVersion: 2,
        },
      };

      const result = await adapter.processTripCancelled(cmd);
      expect(result.actionRequiredOrderIds).toContain('order-active-cancel');
      expect(result.cancelledOrderIds).toEqual([]); // NOT cancelled!

      // INVARIANT P1-06: Do NOT set operationalReturnDueAt to now (effectiveAt) if rentalEndAt is later!
      // Order is marked ACTION_REQUIRED with contractual rights preserved.
      expect(mockTx.rentalOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-active-cancel', version: 4 },
          data: expect.objectContaining({
            exceptionStatus: RentalOrderExceptionStatus.ACTION_REQUIRED,
            contextVersionSnapshot: 2,
          }),
        }),
      );
      // Ensure operationalReturnDueAt was NOT truncated to tripAbortEffectiveAt!
      const updateCall = mockTx.rentalOrder.update.mock.calls.find(
        (c: any) => c[0].where.id === 'order-active-cancel',
      );
      expect(updateCall[0].data.operationalReturnDueAt).toBeUndefined();

      // Emits RENTAL_ACTION_REQUIRED with custody info
      expect(mockTx.rentalOutboxEvent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            eventType: 'RENTAL_ACTION_REQUIRED',
            aggregateId: 'order-active-cancel',
          }),
        }),
      );
    });

    it('BOOKING CANCELLATION: preserves delivery custody and marks ACTION_REQUIRED', async () => {
      const order = {
        id: 'order-bk-del',
        bookingId: 'booking-1',
        tripId: 'trip-1',
        status: RentalOrderStatus.READY_FOR_HANDOVER,
        version: 1,
        financialStatus: 'PAID',
        rentalEndAt: new Date('2026-10-25T18:00:00Z'),
        contextVersionSnapshot: 1,
        rentalOrderLinesViaOrderId: [
          {
            rentalUnitAssignmentsViaOrderLineId: [
              {
                equipmentUnitId: 'u-bk-1',
                equipmentUnit: {
                  id: 'u-bk-1',
                  status: EquipmentUnitStatus.PACKED,
                  currentInventoryLocationId: null,
                },
              },
            ],
          },
        ],
        inventoryTaskViaOrderId: {
          id: 'inv-bk-1',
          status: InventoryTaskStatus.TRANSFERRED,
          package: { status: PackageStatus.TRANSFERRED_TO_DELIVERY },
        },
        deliveryTasksViaOrderId: [
          {
            id: 'del-bk-1',
            status: DeliveryTaskStatus.PACKAGE_RECEIVED,
            taskType: 'HANDOVER',
          },
        ],
      };

      mockTx.rentalOrder.findMany.mockResolvedValue([order]);

      const cmd: BookingCancelledCommand = {
        eventId: 'evt-bk-cancel-del',
        eventType: 'BOOKING_CANCELLED',
        entityId: 'booking-1',
        entityVersion: 2,
        correlationId: 'corr-bk',
        occurredAt: new Date(),
        payload: {
          bookingId: 'booking-1',
          reason: 'User cancelled booking',
          effectiveAt: new Date(),
          version: 2,
        },
      };

      const result = await adapter.processBookingCancelled(cmd);
      expect(result.cancelledOrderIds).toContain('order-bk-del');
      expect(result.actionRequiredOrderIds).toContain('order-bk-del');

      // Units must not be made available
      expect(mockTx.equipmentUnit.update).not.toHaveBeenCalled();
    });

    it('CONCURRENCY & LOCKING (P0-A): acquires sorted product row locks to prevent deadlock and scopes to primary InventoryLocation (RB-POL-33)', async () => {
      const order1 = {
        id: 'order-p1',
        tripId: 'trip-concurrency',
        status: RentalOrderStatus.PAID,
        version: 1,
        rentalStartAt: new Date('2026-11-01T08:00:00Z'),
        rentalEndAt: new Date('2026-11-05T18:00:00Z'),
        contextVersionSnapshot: 1,
        occupiedStartAt: new Date('2026-11-01T08:00:00Z'),
        occupiedEndAt: new Date('2026-11-06T18:00:00Z'),
        plannedHandoverAt: new Date('2026-11-01T08:00:00Z'),
        plannedReturnAt: new Date('2026-11-05T18:00:00Z'),
        operationalReturnDueAt: new Date('2026-11-05T18:00:00Z'),
        rentalPolicy: mockPolicy,
        rentalOrderLinesViaOrderId: [
          {
            id: 'l-1',
            productId: 'prod-z-tent', // Later alphabetically
            quantity: 1,
            product: { requiresDeepReturnInspection: false },
            rentalQuantityReservationsViaOrderLineId: [
              { id: 'res-z', version: 1, occupiedFrom: new Date('2026-11-01T08:00:00Z'), occupiedUntil: new Date('2026-11-06T18:00:00Z') },
            ],
            rentalUnitAssignmentsViaOrderLineId: [],
          },
        ],
        deliveryTasksViaOrderId: [],
      };

      const order2 = {
        id: 'order-p2',
        tripId: 'trip-concurrency',
        status: RentalOrderStatus.PAID,
        version: 1,
        rentalStartAt: new Date('2026-11-01T08:00:00Z'),
        rentalEndAt: new Date('2026-11-05T18:00:00Z'),
        contextVersionSnapshot: 1,
        occupiedStartAt: new Date('2026-11-01T08:00:00Z'),
        occupiedEndAt: new Date('2026-11-06T18:00:00Z'),
        plannedHandoverAt: new Date('2026-11-01T08:00:00Z'),
        plannedReturnAt: new Date('2026-11-05T18:00:00Z'),
        operationalReturnDueAt: new Date('2026-11-05T18:00:00Z'),
        rentalPolicy: mockPolicy,
        rentalOrderLinesViaOrderId: [
          {
            id: 'l-2',
            productId: 'prod-a-stove', // Earlier alphabetically
            quantity: 1,
            product: { requiresDeepReturnInspection: false },
            rentalQuantityReservationsViaOrderLineId: [
              { id: 'res-a', version: 1, occupiedFrom: new Date('2026-11-01T08:00:00Z'), occupiedUntil: new Date('2026-11-06T18:00:00Z') },
            ],
            rentalUnitAssignmentsViaOrderLineId: [],
          },
        ],
        deliveryTasksViaOrderId: [],
      };

      mockTx.rentalOrder.findMany.mockResolvedValue([order1, order2]);

      const cmd: TripRescheduledCommand = {
        eventId: 'evt-concurrency-lock',
        eventType: 'TRIP_RESCHEDULED',
        entityId: 'trip-concurrency',
        entityVersion: 2,
        correlationId: 'corr-concurrency',
        occurredAt: new Date(),
        payload: {
          tripId: 'trip-concurrency',
          newStartAt: new Date('2026-11-02T08:00:00Z'),
          newEndAt: new Date('2026-11-06T18:00:00Z'),
          contextVersion: 2,
        },
      };

      const result = await adapter.processTripRescheduled(cmd);
      expect(result.status).toBe('PROCESSED');
      expect(result.affectedOrderIds).toEqual(['order-p1', 'order-p2']);

      // Invariant: Product locks MUST be acquired in sorted order to prevent deadlocks!
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(2);
      expect(mockTx.inventoryLocation.findUnique).toHaveBeenCalledWith({
        where: { id: PRIMARY_LOC_ID },
        select: { id: true, status: true },
      });
      // Verified capacity snapshot called with primary location ID
      expect(mockTx.equipmentUnit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { currentInventoryLocationId: PRIMARY_LOC_ID },
              { currentInventoryLocationId: null, homeInventoryLocationId: PRIMARY_LOC_ID },
            ],
          }),
        }),
      );
    });

    it('CANCELLATION CONSISTENCY (P0-B): synchronizes Package, RentalUnitAssignment, and EquipmentUnit release on pre-handover cancellation', async () => {
      const effectiveAt = new Date('2026-10-21T12:00:00Z');
      const order = {
        id: 'order-cancel-sync',
        tripId: 'trip-1',
        status: RentalOrderStatus.PREPARING,
        version: 2,
        financialStatus: 'PAID',
        rentalEndAt: new Date('2026-10-25T18:00:00Z'),
        contextVersionSnapshot: 1,
        rentalOrderLinesViaOrderId: [
          {
            rentalUnitAssignmentsViaOrderLineId: [
              {
                id: 'assign-1',
                status: RentalUnitAssignmentStatus.PACKED,
                equipmentUnitId: 'unit-sync-1',
                equipmentUnit: {
                  id: 'unit-sync-1',
                  status: EquipmentUnitStatus.PACKED,
                  currentInventoryLocationId: PRIMARY_LOC_ID, // Matches primary location!
                  condition: EquipmentCondition.GOOD,
                },
              },
            ],
          },
        ],
        inventoryTaskViaOrderId: {
          id: 'inv-sync-1',
          status: InventoryTaskStatus.PACKED,
          package: {
            id: 'pkg-sync-1',
            status: PackageStatus.PACKED,
          },
        },
        deliveryTasksViaOrderId: [
          { id: 'del-sync-1', status: DeliveryTaskStatus.SCHEDULED, taskType: 'HANDOVER' },
        ],
      };

      mockTx.rentalOrder.findMany.mockResolvedValue([order]);

      const cmd: TripCancelledCommand = {
        eventId: 'evt-cancel-sync',
        eventType: 'TRIP_CANCELLED',
        entityId: 'trip-1',
        entityVersion: 2,
        correlationId: 'corr-cancel-sync',
        occurredAt: new Date(),
        payload: {
          tripId: 'trip-1',
          reason: 'Cancelled before handover',
          effectiveAt,
          tripVersion: 2,
        },
      };

      const result = await adapter.processTripCancelled(cmd);
      expect(result.cancelledOrderIds).toContain('order-cancel-sync');

      // 1. Package updated to CANCELLED
      expect(mockTx.package.update).toHaveBeenCalledWith({
        where: { id: 'pkg-sync-1' },
        data: expect.objectContaining({ status: PackageStatus.CANCELLED }),
      });

      // 2. RentalUnitAssignment updated to CLOSED with closedAt: effectiveAt
      expect(mockTx.rentalUnitAssignment.update).toHaveBeenCalledWith({
        where: { id: 'assign-1' },
        data: expect.objectContaining({
          status: RentalUnitAssignmentStatus.CLOSED,
          closedAt: effectiveAt,
        }),
      });

      // 3. EquipmentUnit safely released to AVAILABLE
      expect(mockTx.equipmentUnit.update).toHaveBeenCalledWith({
        where: { id: 'unit-sync-1' },
        data: expect.objectContaining({ status: EquipmentUnitStatus.AVAILABLE }),
      });

      // 4. Tasks updated
      expect(mockTx.inventoryTask.update).toHaveBeenCalledWith({
        where: { id: 'inv-sync-1' },
        data: expect.objectContaining({ status: InventoryTaskStatus.CLOSED }),
      });
      expect(mockTx.deliveryTask.update).toHaveBeenCalledWith({
        where: { id: 'del-sync-1' },
        data: expect.objectContaining({ status: DeliveryTaskStatus.CANCELLED }),
      });
    });

    it('CANCELLATION UNSAFE CUSTODY (P0-B): does NOT mark unit AVAILABLE if damaged or at wrong location', async () => {
      const order = {
        id: 'order-unsafe-unit',
        tripId: 'trip-1',
        status: RentalOrderStatus.PREPARING,
        version: 1,
        financialStatus: 'PAID',
        rentalEndAt: new Date('2026-10-25T18:00:00Z'),
        contextVersionSnapshot: 1,
        rentalOrderLinesViaOrderId: [
          {
            rentalUnitAssignmentsViaOrderLineId: [
              {
                id: 'assign-damaged',
                status: RentalUnitAssignmentStatus.ASSIGNED,
                equipmentUnitId: 'unit-damaged',
                equipmentUnit: {
                  id: 'unit-damaged',
                  status: EquipmentUnitStatus.DAMAGED,
                  currentInventoryLocationId: PRIMARY_LOC_ID,
                  condition: EquipmentCondition.DAMAGED,
                },
              },
              {
                id: 'assign-wrong-loc',
                status: RentalUnitAssignmentStatus.ASSIGNED,
                equipmentUnitId: 'unit-wrong-loc',
                equipmentUnit: {
                  id: 'unit-wrong-loc',
                  status: EquipmentUnitStatus.PICKED,
                  currentInventoryLocationId: 'loc-other-warehouse', // Not primary location!
                  condition: EquipmentCondition.GOOD,
                },
              },
            ],
          },
        ],
        inventoryTaskViaOrderId: null,
        deliveryTasksViaOrderId: [],
      };

      mockTx.rentalOrder.findMany.mockResolvedValue([order]);

      const cmd: TripCancelledCommand = {
        eventId: 'evt-cancel-unsafe',
        eventType: 'TRIP_CANCELLED',
        entityId: 'trip-1',
        entityVersion: 2,
        correlationId: 'corr-cancel-unsafe',
        occurredAt: new Date(),
        payload: {
          tripId: 'trip-1',
          reason: 'Cancelled with damaged unit',
          effectiveAt: new Date(),
          tripVersion: 2,
        },
      };

      const result = await adapter.processTripCancelled(cmd);
      expect(result.cancelledOrderIds).toContain('order-unsafe-unit');

      // Assignments are closed
      expect(mockTx.rentalUnitAssignment.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'assign-damaged' }, data: expect.objectContaining({ status: RentalUnitAssignmentStatus.CLOSED }) }),
      );
      expect(mockTx.rentalUnitAssignment.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'assign-wrong-loc' }, data: expect.objectContaining({ status: RentalUnitAssignmentStatus.CLOSED }) }),
      );

      // Neither unit should be made AVAILABLE!
      expect(mockTx.equipmentUnit.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'unit-damaged' } }),
      );
      expect(mockTx.equipmentUnit.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'unit-wrong-loc' } }),
      );
    });

    it('OCCUPIED WINDOW RB-POL-30 (P1-C): anchors occupiedFrom strictly on contractual rentalStartAt - 12h, preserving commercial start when plannedHandoverAt differs', async () => {
      const contractualStartAt = new Date('2026-10-20T10:00:00Z');
      const operationalHandoverAt = new Date('2026-10-20T06:00:00Z'); // 4h earlier delivery
      const originalRentalEndAt = new Date('2026-10-25T18:00:00Z');

      const order = {
        id: 'order-diff-start',
        tripId: 'trip-1',
        status: RentalOrderStatus.PAID,
        version: 1,
        rentalStartAt: contractualStartAt, // Contractual commercial anchor
        rentalEndAt: originalRentalEndAt,
        rentalFee: '500000.00',
        contextVersionSnapshot: 1,
        occupiedStartAt: new Date(contractualStartAt.getTime() - 12 * 3600_000),
        occupiedEndAt: new Date('2026-10-26T18:00:00Z'),
        plannedHandoverAt: operationalHandoverAt, // Different from rentalStartAt!
        plannedReturnAt: originalRentalEndAt,
        operationalReturnDueAt: originalRentalEndAt,
        rentalPolicy: mockPolicy,
        rentalOrderLinesViaOrderId: [
          {
            id: 'line-diff-1',
            productId: 'prod-tent',
            quantity: 1,
            product: { requiresDeepReturnInspection: false },
            rentalQuantityReservationsViaOrderLineId: [
              { id: 'res-diff-1', version: 1, occupiedFrom: new Date(contractualStartAt.getTime() - 12 * 3600_000), occupiedUntil: new Date('2026-10-26T18:00:00Z') },
            ],
            rentalUnitAssignmentsViaOrderLineId: [],
          },
        ],
        deliveryTasksViaOrderId: [],
      };

      mockTx.rentalOrder.findMany.mockResolvedValue([order]);

      const newStartAt = new Date('2026-11-01T10:00:00Z');
      const newPlannedHandoverAt = new Date('2026-11-01T07:00:00Z'); // Rescheduled operational handover
      const newEndAt = new Date('2026-11-04T18:00:00Z');

      const cmd: TripRescheduledCommand = {
        eventId: 'evt-resched-diff',
        eventType: 'TRIP_RESCHEDULED',
        entityId: 'trip-1',
        entityVersion: 2,
        correlationId: 'corr-diff',
        occurredAt: new Date(),
        payload: {
          tripId: 'trip-1',
          newStartAt,
          newEndAt,
          plannedHandoverAt: newPlannedHandoverAt,
          contextVersion: 2,
        },
      };

      const result = await adapter.processTripRescheduled(cmd);
      expect(result.status).toBe('PROCESSED');

      // RB-POL-30: occupiedFrom MUST be anchored on contractual rentalStartAt - 12h!
      const expectedOccupiedFrom = new Date(contractualStartAt.getTime() - 12 * 3600_000);
      expect(mockTx.rentalQuantityReservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res-diff-1' },
          data: expect.objectContaining({
            occupiedFrom: expectedOccupiedFrom,
          }),
        }),
      );

      // Operational plannedHandoverAt is updated without breaking commercial rentalStartAt
      expect(mockTx.rentalOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-diff-start', version: 1 },
          data: expect.objectContaining({
            plannedHandoverAt: newPlannedHandoverAt,
          }),
        }),
      );
    });

    it('EVENT ORDERING (P1-D): Booking cancellation succeeds even if Trip contextVersionSnapshot is higher, and checks booking stream high-water mark independently', async () => {
      const order = {
        id: 'order-trip-v8',
        bookingId: 'booking-stream-1',
        tripId: 'trip-1',
        status: RentalOrderStatus.PAID,
        version: 1,
        financialStatus: 'PAID',
        rentalEndAt: new Date('2026-10-25T18:00:00Z'),
        contextVersionSnapshot: 8, // Trip contextVersion is 8!
        rentalOrderLinesViaOrderId: [
          {
            rentalUnitAssignmentsViaOrderLineId: [],
          },
        ],
        inventoryTaskViaOrderId: null,
        deliveryTasksViaOrderId: [],
      };

      mockTx.rentalOrder.findMany.mockResolvedValue([order]);

      const cmd: BookingCancelledCommand = {
        eventId: 'evt-bk-cancel-v2',
        eventType: 'BOOKING_CANCELLED',
        entityId: 'booking-stream-1',
        entityVersion: 2, // Booking version is 2! (2 < 8, but MUST NOT be dropped as out-of-order)
        correlationId: 'corr-bk-v2',
        occurredAt: new Date(),
        payload: {
          bookingId: 'booking-stream-1',
          reason: 'Customer cancelled booking',
          effectiveAt: new Date(),
          version: 2,
        },
      };

      const result = await adapter.processBookingCancelled(cmd);
      expect(result.status).toBe('PROCESSED');
      expect(result.cancelledOrderIds).toContain('order-trip-v8');

      // Order updated to CANCELLED without corrupting Trip contextVersionSnapshot
      expect(mockTx.rentalOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-trip-v8', version: 1 },
          data: expect.objectContaining({
            status: RentalOrderStatus.CANCELLED,
          }),
        }),
      );
      // contextVersionSnapshot must NOT be overwritten to 2
      const updateData = mockTx.rentalOrder.update.mock.calls.find(
        (c: any) => c[0].where.id === 'order-trip-v8',
      )[0].data;
      expect(updateData.contextVersionSnapshot).toBeUndefined();

      // Now test out-of-order in the Booking stream:
      // If a newer event for booking-stream-1 was already processed (e.g. version 3),
      // then an incoming event with version 2 is skipped with SKIPPED_OUT_OF_ORDER!
      mockTx.rentalInboxEvent.findFirst.mockResolvedValue({
        id: 'inbox-bk-v3',
        entityId: 'booking-stream-1',
        entityVersion: 3,
        status: 'PROCESSED',
      });

      const staleCmd: BookingCancelledCommand = {
        ...cmd,
        eventId: 'evt-bk-cancel-stale',
      };

      const staleResult = await adapter.processBookingCancelled(staleCmd);
      expect(staleResult.status).toBe('SKIPPED_OUT_OF_ORDER');
      expect(staleResult.affectedOrderCount).toBe(0);
    });

    it('ACTIVE CAPACITY (P1-E): no false conflict when customer own rented unit satisfies extension and no future competitors exist', async () => {
      const order = {
        id: 'order-active-sole-unit',
        tripId: 'trip-1',
        status: RentalOrderStatus.ACTIVE,
        version: 2,
        rentalEndAt: new Date('2026-10-25T18:00:00Z'),
        rentalFee: '600000.00',
        contextVersionSnapshot: 1,
        occupiedStartAt: new Date('2026-10-20T08:00:00Z'),
        occupiedEndAt: new Date('2026-10-26T18:00:00Z'),
        plannedHandoverAt: new Date('2026-10-20T08:00:00Z'),
        plannedReturnAt: new Date('2026-10-25T18:00:00Z'),
        operationalReturnDueAt: new Date('2026-10-25T18:00:00Z'),
        rentalPolicy: mockPolicy,
        rentalOrderLinesViaOrderId: [
          {
            id: 'line-active-sole',
            productId: 'prod-rare-gps',
            quantity: 1,
            product: { requiresDeepReturnInspection: false },
            rentalQuantityReservationsViaOrderLineId: [
              { id: 'res-act-sole', version: 1, occupiedFrom: new Date('2026-10-20T08:00:00Z'), occupiedUntil: new Date('2026-10-26T18:00:00Z') },
            ],
            rentalUnitAssignmentsViaOrderLineId: [
              {
                id: 'assign-act-1',
                status: RentalUnitAssignmentStatus.HANDED_OVER,
                equipmentUnitId: 'unit-rare-1',
                equipmentUnit: {
                  id: 'unit-rare-1',
                  status: EquipmentUnitStatus.RENTED, // Currently RENTED to this user!
                  currentInventoryLocationId: null, // Out in the field
                  homeInventoryLocationId: PRIMARY_LOC_ID,
                },
              },
            ],
          },
        ],
        deliveryTasksViaOrderId: [],
      };

      mockTx.rentalOrder.findMany.mockResolvedValue([order]);
      mockTx.rentalDocument.findFirst.mockResolvedValue({ id: 'doc-handover-root' });

      // There is only 1 unit total in inventory for this product, and it is the RENTED unit!
      mockTx.equipmentUnit.findMany.mockResolvedValue([
        {
          id: 'unit-rare-1',
          status: EquipmentUnitStatus.RENTED,
          currentInventoryLocationId: null,
          homeInventoryLocationId: PRIMARY_LOC_ID,
          readinessCommitmentsViaUnitId: [],
          returnInspectionTasks: [],
        },
      ]);
      // No competitor reservations exist for this product
      mockTx.rentalQuantityReservation.findMany.mockResolvedValue([]);

      const cmd: TripRescheduledCommand = {
        eventId: 'evt-active-sole-extension',
        eventType: 'TRIP_RESCHEDULED',
        entityId: 'trip-1',
        entityVersion: 2,
        correlationId: 'corr-sole',
        occurredAt: new Date(),
        payload: {
          tripId: 'trip-1',
          newStartAt: new Date('2026-10-20T08:00:00Z'),
          newEndAt: new Date('2026-10-27T18:00:00Z'), // Extended by 2 days
          contextVersion: 2,
        },
      };

      const result = await adapter.processTripRescheduled(cmd);
      // Invariant: MUST NOT flag conflict or ACTION_REQUIRED since customer's own rented unit satisfies the demand!
      expect(result.conflicts).toEqual([]);
      expect(result.status).toBe('PROCESSED');
      expect(result.affectedOrderIds).toContain('order-active-sole-unit');

      // Order operational schedule updated without ACTION_REQUIRED
      expect(mockTx.rentalOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-active-sole-unit', version: 2 },
          data: expect.objectContaining({
            operationalReturnDueAt: new Date('2026-10-27T18:00:00Z'),
          }),
        }),
      );
      const updateData = mockTx.rentalOrder.update.mock.calls.find(
        (c: any) => c[0].where.id === 'order-active-sole-unit',
      )[0].data;
      expect(updateData.exceptionStatus).toBeUndefined();
    });

    it('ACTIVE CAPACITY (P1-E): true conflict detected when competing reservation overlaps in extended window, flags ACTION_REQUIRED without revoking customer custody', async () => {
      const order = {
        id: 'order-active-competing',
        tripId: 'trip-1',
        status: RentalOrderStatus.ACTIVE,
        version: 2,
        rentalEndAt: new Date('2026-10-25T18:00:00Z'),
        rentalFee: '600000.00',
        contextVersionSnapshot: 1,
        occupiedStartAt: new Date('2026-10-20T08:00:00Z'),
        occupiedEndAt: new Date('2026-10-26T18:00:00Z'),
        plannedHandoverAt: new Date('2026-10-20T08:00:00Z'),
        plannedReturnAt: new Date('2026-10-25T18:00:00Z'),
        operationalReturnDueAt: new Date('2026-10-25T18:00:00Z'),
        rentalPolicy: mockPolicy,
        rentalOrderLinesViaOrderId: [
          {
            id: 'line-active-comp',
            productId: 'prod-rare-gps',
            quantity: 1,
            product: { requiresDeepReturnInspection: false },
            rentalQuantityReservationsViaOrderLineId: [
              { id: 'res-own-comp', version: 1, occupiedFrom: new Date('2026-10-20T08:00:00Z'), occupiedUntil: new Date('2026-10-26T18:00:00Z') },
            ],
            rentalUnitAssignmentsViaOrderLineId: [
              {
                id: 'assign-comp-1',
                status: RentalUnitAssignmentStatus.HANDED_OVER,
                equipmentUnitId: 'unit-rare-1',
                equipmentUnit: {
                  id: 'unit-rare-1',
                  status: EquipmentUnitStatus.RENTED,
                  currentInventoryLocationId: null,
                  homeInventoryLocationId: PRIMARY_LOC_ID,
                },
              },
            ],
          },
        ],
        deliveryTasksViaOrderId: [],
      };

      mockTx.rentalOrder.findMany.mockResolvedValue([order]);
      mockTx.rentalDocument.findFirst.mockResolvedValue({ id: 'doc-handover-root' });

      // 1 unit total in catalog (the rented unit)
      mockTx.equipmentUnit.findMany.mockResolvedValue([
        {
          id: 'unit-rare-1',
          status: EquipmentUnitStatus.RENTED,
          currentInventoryLocationId: null,
          homeInventoryLocationId: PRIMARY_LOC_ID,
          readinessCommitmentsViaUnitId: [],
          returnInspectionTasks: [],
        },
      ]);
      // But another customer has reserved 1 unit of this product during the extended window!
      mockTx.rentalQuantityReservation.findMany.mockResolvedValue([
        {
          id: 'res-competitor-future',
          quantity: 1,
          occupiedFrom: new Date('2026-10-26T12:00:00Z'),
          occupiedUntil: new Date('2026-10-30T18:00:00Z'),
        },
      ]);

      const cmd: TripRescheduledCommand = {
        eventId: 'evt-active-comp-extension',
        eventType: 'TRIP_RESCHEDULED',
        entityId: 'trip-1',
        entityVersion: 2,
        correlationId: 'corr-comp',
        occurredAt: new Date(),
        payload: {
          tripId: 'trip-1',
          newStartAt: new Date('2026-10-20T08:00:00Z'),
          newEndAt: new Date('2026-10-28T18:00:00Z'),
          contextVersion: 2,
        },
      };

      const result = await adapter.processTripRescheduled(cmd);
      // Invariant: True conflict MUST be detected!
      expect(result.conflicts.length).toBe(1);
      expect(result.conflicts[0].orderId).toBe('order-active-competing');

      // Order marked ACTION_REQUIRED
      expect(mockTx.rentalOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-active-competing', version: 2 },
          data: expect.objectContaining({
            exceptionStatus: RentalOrderExceptionStatus.ACTION_REQUIRED,
            operationalReturnDueAt: new Date('2026-10-28T18:00:00Z'), // Custody & extension recorded!
          }),
        }),
      );

      // Outbox RENTAL_ACTION_REQUIRED emitted
      expect(mockTx.rentalOutboxEvent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            eventType: 'RENTAL_ACTION_REQUIRED',
            aggregateId: 'order-active-competing',
          }),
        }),
      );
    });

    describe('Preflight 07B Regression Tests', () => {
      it('PREFLIGHT 1: Reschedule excludes ALL own reservation cycles (base + extension) from competitor count and updates base without double-counting', async () => {
        const newStartAt = new Date('2026-11-01T08:00:00Z');
        const newEndAt = new Date('2026-11-04T18:00:00Z');
        const originalRentalEndAt = new Date('2026-10-25T18:00:00Z');
        const order = {
          id: 'order-multi-res',
          tripId: 'trip-1',
          status: RentalOrderStatus.PAID,
          version: 1,
          rentalStartAt: newStartAt,
          rentalEndAt: originalRentalEndAt,
          rentalFee: '800000.00',
          contextVersionSnapshot: 1,
          occupiedStartAt: new Date('2026-10-20T07:00:00Z'),
          occupiedEndAt: new Date('2026-10-28T18:00:00Z'),
          plannedHandoverAt: new Date('2026-10-20T08:00:00Z'),
          plannedReturnAt: new Date('2026-10-25T18:00:00Z'),
          operationalReturnDueAt: new Date('2026-10-25T18:00:00Z'),
          rentalPolicy: mockPolicy,
          rentalOrderLinesViaOrderId: [
            {
              id: 'line-multi-res',
              productId: 'prod-tent',
              quantity: 1,
              product: { requiresDeepReturnInspection: false },
              rentalQuantityReservationsViaOrderLineId: [
                {
                  id: 'res-base-1',
                  reservationCycle: 1,
                  status: ReservationStatus.CONFIRMED,
                  occupiedFrom: new Date('2026-10-20T07:00:00Z'),
                  occupiedTo: new Date('2026-10-25T18:00:00Z'),
                  version: 1,
                },
                {
                  id: 'res-ext-cycle-2',
                  reservationCycle: 2,
                  status: ReservationStatus.CONFIRMED,
                  occupiedFrom: new Date('2026-10-25T18:00:00Z'),
                  occupiedTo: new Date('2026-10-28T18:00:00Z'),
                  version: 1,
                },
              ],
            },
          ],
          deliveryTasksViaOrderId: [
            { id: 'dt-handover', taskType: 'DELIVERY', status: DeliveryTaskStatus.SCHEDULED },
            { id: 'dt-return', taskType: 'RETURN', status: DeliveryTaskStatus.SCHEDULED },
          ],
        };

        mockTx.rentalOrder.findMany.mockResolvedValue([order]);

        const cmd: TripRescheduledCommand = {
          eventId: 'evt-resched-multi-cycle',
          eventType: 'TRIP_RESCHEDULED',
          entityId: 'trip-1',
          entityVersion: 2,
          correlationId: 'corr-multi-cycle',
          occurredAt: new Date(),
          payload: {
            tripId: 'trip-1',
            newStartAt,
            newEndAt,
            contextVersion: 2,
          },
        };

        const result = await adapter.processTripRescheduled(cmd);
        expect(result.status).toBe('PROCESSED');
        expect(result.affectedOrderIds).toContain('order-multi-res');
        expect(result.conflicts).toHaveLength(0);

        // Verify that rentalQuantityReservation.findMany excluded BOTH own reservation IDs (base + extension cycle 2)
        expect(mockTx.rentalQuantityReservation.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              id: expect.objectContaining({
                notIn: expect.arrayContaining(['res-base-1', 'res-ext-cycle-2']),
              }),
            }),
          }),
        );

        // Verify base reservation (cycle 1) was updated
        expect(mockTx.rentalQuantityReservation.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'res-base-1' },
          }),
        );
      });

      it('PREFLIGHT 2: HandleBookingCancelledUseCase rejects version mismatch and adapter skips out-of-order on booking stream', async () => {
        const mockPortInstance: jest.Mocked<TripLifecyclePort> = {
          processTripRescheduled: jest.fn(),
          processTripCancelled: jest.fn(),
          processBookingCancelled: jest.fn(),
        };
        const useCase = new HandleBookingCancelledUseCase(mockPortInstance);

        // Version mismatch between entityVersion and payload.version
        const mismatchCmd: BookingCancelledCommand = {
          eventId: 'evt-mismatch-1',
          eventType: 'BOOKING_CANCELLED',
          entityId: 'book-1',
          entityVersion: 2,
          correlationId: 'corr-1',
          occurredAt: new Date(),
          payload: {
            bookingId: 'book-1',
            reason: 'Mismatch test',
            effectiveAt: new Date(),
            version: 5, // Mismatch with entityVersion 2!
          },
        };

        await expect(useCase.execute(mismatchCmd)).rejects.toMatchObject({
          code: 'RENTAL_LIFECYCLE_EVENT_INVALID',
        });

        // Now test adapter out-of-order skip using canonical version
        mockTx.rentalInboxEvent.findFirst.mockResolvedValueOnce({
          id: 'inbox-higher',
          entityId: 'book-1',
          entityVersion: 6,
          status: 'PROCESSED',
        });

        const canonicalCmd: BookingCancelledCommand = {
          eventId: 'evt-canonical-late',
          eventType: 'BOOKING_CANCELLED',
          entityId: 'book-1',
          entityVersion: 3,
          correlationId: 'corr-canonical',
          occurredAt: new Date(),
          payload: {
            bookingId: 'book-1',
            reason: 'Late arrival',
            effectiveAt: new Date(),
            version: 3,
          },
        };

        const result = await adapter.processBookingCancelled(canonicalCmd);
        expect(result.status).toBe('SKIPPED_OUT_OF_ORDER');
        expect(mockTx.rentalOrder.findMany).not.toHaveBeenCalled();
      });

      it('PREFLIGHT 3: Cancellation with unsafe unit sets ACTION_REQUIRED, blocks task, and creates audit outbox', async () => {
        const order = {
          id: 'order-unsafe-test',
          bookingId: 'book-unsafe-1',
          tripId: 'trip-1',
          status: RentalOrderStatus.PREPARING,
          version: 1,
          financialStatus: 'PAID',
          rentalOrderLinesViaOrderId: [
            {
              id: 'line-unsafe',
              rentalUnitAssignmentsViaOrderLineId: [
                {
                  id: 'assign-unsafe-1',
                  status: RentalUnitAssignmentStatus.ASSIGNED,
                  equipmentUnitId: 'unit-unsafe-1',
                  equipmentUnit: {
                    id: 'unit-unsafe-1',
                    status: EquipmentUnitStatus.PICKED,
                    condition: EquipmentCondition.DAMAGED, // DAMAGED unit! Unsafe!
                    currentInventoryLocationId: PRIMARY_LOC_ID,
                  },
                },
              ],
            },
          ],
          inventoryTaskViaOrderId: {
            id: 'task-inv-unsafe',
            status: InventoryTaskStatus.PICKING,
            package: { id: 'pkg-1', status: PackageStatus.OPEN },
          },
          deliveryTasksViaOrderId: [],
        };

        mockTx.rentalOrder.findMany.mockResolvedValue([order]);

        const cmd: BookingCancelledCommand = {
          eventId: 'evt-cancel-unsafe-test',
          eventType: 'BOOKING_CANCELLED',
          entityId: 'book-unsafe-1',
          entityVersion: 1,
          correlationId: 'corr-unsafe',
          occurredAt: new Date(),
          payload: {
            bookingId: 'book-unsafe-1',
            reason: 'Customer cancelled with damaged unit',
            effectiveAt: new Date(),
            version: 1,
          },
        };

        const result = await adapter.processBookingCancelled(cmd);
        expect(result.status).toBe('PROCESSED');
        expect(result.actionRequiredOrderIds).toContain('order-unsafe-test');

        // Order marked ACTION_REQUIRED
        expect(mockTx.rentalOrder.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'order-unsafe-test', version: 1 },
            data: expect.objectContaining({
              status: RentalOrderStatus.CANCELLED,
              exceptionStatus: RentalOrderExceptionStatus.ACTION_REQUIRED,
            }),
          }),
        );

        // InventoryTask blocked (not cleanly closed) for custody resolution
        expect(mockTx.inventoryTask.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'task-inv-unsafe' },
            data: expect.objectContaining({
              status: InventoryTaskStatus.BLOCKED,
            }),
          }),
        );

        // Outbox event RENTAL_ACTION_REQUIRED emitted with unsafe unit details
        expect(mockTx.rentalOutboxEvent.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({
              eventType: 'RENTAL_ACTION_REQUIRED',
              aggregateId: 'order-unsafe-test',
              payload: expect.objectContaining({
                reason: 'PRE_HANDOVER_CANCELLATION_UNSAFE_UNIT_CUSTODY',
                unsafeUnits: expect.arrayContaining([
                  expect.objectContaining({
                    unitId: 'unit-unsafe-1',
                    reason: 'UNIT_CONDITION_DAMAGED',
                  }),
                ]),
              }),
            }),
          }),
        );

        // Unit was NOT marked AVAILABLE
        expect(mockTx.equipmentUnit.update).not.toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'unit-unsafe-1' },
            data: expect.objectContaining({ status: EquipmentUnitStatus.AVAILABLE }),
          }),
        );
      });

      it('PREFLIGHT 4: Evaluates capacity using server processing time (processingNow) instead of occurredAt', async () => {
        const historicalTime = new Date('2026-01-01T00:00:00Z'); // 10 months ago
        const order = {
          id: 'order-time-eval',
          tripId: 'trip-1',
          status: RentalOrderStatus.PAID,
          version: 1,
          rentalStartAt: new Date('2026-11-01T08:00:00Z'),
          rentalEndAt: new Date('2026-11-04T18:00:00Z'),
          rentalFee: '500000.00',
          contextVersionSnapshot: 1,
          operationalReturnDueAt: new Date('2026-11-04T18:00:00Z'),
          rentalPolicy: mockPolicy,
          rentalOrderLinesViaOrderId: [
            {
              id: 'line-time-eval',
              productId: 'prod-tent',
              quantity: 1,
              product: { requiresDeepReturnInspection: false },
              rentalQuantityReservationsViaOrderLineId: [
                {
                  id: 'res-time-1',
                  reservationCycle: 1,
                  status: ReservationStatus.CONFIRMED,
                  occupiedFrom: new Date('2026-10-20T07:00:00Z'),
                  occupiedTo: new Date('2026-10-25T18:00:00Z'),
                  version: 1,
                },
              ],
            },
          ],
          deliveryTasksViaOrderId: [],
        };

        mockTx.rentalOrder.findMany.mockResolvedValue([order]);

        const cmd: TripRescheduledCommand = {
          eventId: 'evt-time-eval',
          eventType: 'TRIP_RESCHEDULED',
          entityId: 'trip-1',
          entityVersion: 2,
          correlationId: 'corr-time',
          occurredAt: historicalTime, // Historical event!
          payload: {
            tripId: 'trip-1',
            newStartAt: new Date('2026-11-01T08:00:00Z'),
            newEndAt: new Date('2026-11-04T18:00:00Z'),
            contextVersion: 2,
          },
        };

        const beforeCall = new Date().getTime();
        await adapter.processTripRescheduled(cmd);
        const afterCall = new Date().getTime();

        // Check holdExpiresAt evaluated in capacity query
        expect(mockTx.rentalQuantityReservation.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({
                  status: ReservationStatus.HELD,
                  holdExpiresAt: expect.objectContaining({
                    gt: expect.any(Date),
                  }),
                }),
              ]),
            }),
          }),
        );

        // Get the actual holdExpiresAt date passed
        const calls = mockTx.rentalQuantityReservation.findMany.mock.calls;
        const lastCall = calls[calls.length - 1][0];
        const evaluatedDate: Date = lastCall.where.OR[1].holdExpiresAt.gt;
        // Must be close to current server time, NOT historical occurredAt!
        expect(evaluatedDate.getTime()).toBeGreaterThanOrEqual(beforeCall - 1000);
        expect(evaluatedDate.getTime()).toBeLessThanOrEqual(afterCall + 1000);
      });

      it('PREFLIGHT 5: Handles concurrent duplicate insertion (P2002) idempotently without throwing', async () => {
        const cmd: TripRescheduledCommand = {
          eventId: 'evt-p2002-concurrent',
          eventType: 'TRIP_RESCHEDULED',
          entityId: 'trip-1',
          entityVersion: 2,
          correlationId: 'corr-p2002',
          occurredAt: new Date(),
          payload: {
            tripId: 'trip-1',
            newStartAt: new Date('2026-11-01T08:00:00Z'),
            newEndAt: new Date('2026-11-04T18:00:00Z'),
            contextVersion: 2,
          },
        };

        const p2002Error = new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on eventId',
          {
            code: 'P2002',
            clientVersion: '6.3.1',
          },
        );

        // Simulate $transaction failing with P2002
        mockPrisma.$transaction.mockRejectedValueOnce(p2002Error);
        mockPrisma.rentalInboxEvent.findUnique.mockResolvedValueOnce({
          eventId: 'evt-p2002-concurrent',
          status: 'PROCESSED',
          result: {
            eventId: 'evt-p2002-concurrent',
            status: 'PROCESSED',
            affectedOrderCount: 1,
            affectedOrderIds: ['order-p2002'],
            conflicts: [],
            scheduleNoticesIssued: [],
          },
        });

        const result = await adapter.processTripRescheduled(cmd);
        expect(result.status).toBe('PROCESSED');
        expect(result.affectedOrderIds).toEqual(['order-p2002']);
      });
    });

    describe('M9 Membership Source Changed & Booking Cancel Source Discrimination', () => {
      it('leave/remove/rejoin: event version older than order membershipSourceVersion does NOT cancel the order (rejoined order preserved)', async () => {
        const cmd: MembershipSourceChangedCommand = {
          eventId: 'evt-leave-stale',
          eventType: 'PRIVATE_TRIP_MEMBER_LEFT',
          entityId: 'member-1',
          entityVersion: 2,
          correlationId: 'corr-1',
          occurredAt: new Date(),
          payload: {
            membershipKind: 'PRIVATE_TRIP_MEMBER',
            membershipRef: 'member-1',
            version: 2,
            reason: 'Left trip early version',
          },
        };

        // User rejoined and placed order with version 3
        mockTx.rentalOrder.findMany.mockResolvedValueOnce([
          {
            id: 'order-rejoined',
            tripId: 'trip-1',
            status: RentalOrderStatus.PAID,
            version: 1,
            membershipKind: 'PRIVATE_TRIP_MEMBER',
            membershipRef: 'member-1',
            membershipSourceVersion: 3, // Order created at version 3
            rentalPolicy: { freeCancellationHours: 24 },
            rentalOrderLinesViaOrderId: [],
            deliveryTasksViaOrderId: [],
          },
        ]);

        const result = await adapter.processMembershipSourceChanged(cmd);
        // Stale leave event (v2) must NOT cancel order created after rejoin (v3)
        expect(result.status).toBe('PROCESSED');
        expect(result.affectedOrderCount).toBe(0);
        expect(result.affectedOrderIds).toEqual([]);
      });

      it('leave/remove: event version >= order membershipSourceVersion cancels the order', async () => {
        const cmd: MembershipSourceChangedCommand = {
          eventId: 'evt-leave-active',
          eventType: 'PRIVATE_TRIP_MEMBER_LEFT',
          entityId: 'member-1',
          entityVersion: 3,
          correlationId: 'corr-2',
          occurredAt: new Date(),
          payload: {
            membershipKind: 'PRIVATE_TRIP_MEMBER',
            membershipRef: 'member-1',
            version: 3,
            reason: 'Left trip',
          },
        };

        mockTx.rentalOrder.findMany.mockResolvedValueOnce([
          {
            id: 'order-to-cancel',
            tripId: 'trip-1',
            status: RentalOrderStatus.PAID,
            financialStatus: RentalFinancialStatus.PAID,
            version: 1,
            membershipKind: 'PRIVATE_TRIP_MEMBER',
            membershipRef: 'member-1',
            membershipSourceVersion: 3,
            rentalPolicy: { freeCancellationHours: 24 },
            rentalOrderLinesViaOrderId: [],
            deliveryTasksViaOrderId: [],
          },
        ]);

        const result = await adapter.processMembershipSourceChanged(cmd);
        expect(result.status).toBe('PROCESSED');
        expect(result.affectedOrderCount).toBe(1);
        expect(result.affectedOrderIds).toEqual(['order-to-cancel']);
        expect(result.cancelledOrderIds).toEqual(['order-to-cancel']);
      });

      it('duplicate: returns existing result on duplicate eventId for membership source changed', async () => {
        const cachedResult: LifecycleExecutionResult = {
          eventId: 'evt-dup-1',
          status: 'PROCESSED',
          affectedOrderCount: 1,
          affectedOrderIds: ['ord-1'],
          conflicts: [],
          scheduleNoticesIssued: [],
        };
        mockTx.rentalInboxEvent.findUnique.mockResolvedValueOnce({
          eventId: 'evt-dup-1',
          result: cachedResult,
        });

        const cmd: MembershipSourceChangedCommand = {
          eventId: 'evt-dup-1',
          eventType: 'PRIVATE_TRIP_MEMBER_LEFT',
          entityId: 'member-1',
          entityVersion: 1,
          correlationId: 'corr-dup',
          occurredAt: new Date(),
          payload: {
            membershipKind: 'PRIVATE_TRIP_MEMBER',
            membershipRef: 'member-1',
            version: 1,
          },
        };

        const result = await adapter.processMembershipSourceChanged(cmd);
        expect(result.status).toBe('PROCESSED');
        expect(result.affectedOrderIds).toEqual(['ord-1']);
      });

      it('custody sau bàn giao: ACTIVE order keeps physical custody, sets ACTION_REQUIRED, does not blanket cancel', async () => {
        const cmd: MembershipSourceChangedCommand = {
          eventId: 'evt-leave-active-custody',
          eventType: 'PRIVATE_TRIP_MEMBER_REMOVED',
          entityId: 'member-1',
          entityVersion: 2,
          correlationId: 'corr-custody',
          occurredAt: new Date(),
          payload: {
            membershipKind: 'PRIVATE_TRIP_MEMBER',
            membershipRef: 'member-1',
            version: 2,
            reason: 'Removed by leader after start',
          },
        };

        mockTx.rentalOrder.findMany.mockResolvedValueOnce([
          {
            id: 'order-active-custody',
            tripId: 'trip-1',
            status: RentalOrderStatus.ACTIVE, // Customer physically holds equipment
            version: 1,
            membershipKind: 'PRIVATE_TRIP_MEMBER',
            membershipRef: 'member-1',
            membershipSourceVersion: 2,
            rentalPolicy: { freeCancellationHours: 24 },
            rentalOrderLinesViaOrderId: [],
            deliveryTasksViaOrderId: [],
          },
        ]);

        const result = await adapter.processMembershipSourceChanged(cmd);
        expect(result.status).toBe('PROCESSED');
        expect(result.affectedOrderIds).toEqual(['order-active-custody']);
        // Crucial: NOT in cancelledOrderIds, but marked in actionRequiredOrderIds!
        expect(result.cancelledOrderIds).toEqual([]);
        expect(result.actionRequiredOrderIds).toEqual(['order-active-custody']);

        expect(mockTx.rentalOrder.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'order-active-custody', version: 1 },
            data: expect.objectContaining({
              exceptionStatus: RentalOrderExceptionStatus.ACTION_REQUIRED,
            }),
          }),
        );
      });

      it('booking cancel phân biệt source: BOOKING_CANCELLED only affects buyer orders, not participant orders', async () => {
        const cmd: BookingCancelledCommand = {
          eventId: 'evt-booking-cancel-source-check',
          eventType: 'BOOKING_CANCELLED',
          entityId: 'booking-buyer-1',
          entityVersion: 2,
          correlationId: 'corr-booking-cancel',
          occurredAt: new Date(),
          payload: {
            bookingId: 'booking-buyer-1',
            reason: 'Buyer cancelled booking',
            effectiveAt: new Date(),
            version: 2,
          },
        };

        // When finding candidate orders, only orders with membershipKind: 'PUBLIC_BOOKING_BUYER' match
        mockTx.rentalOrder.findMany.mockResolvedValueOnce([
          {
            id: 'order-buyer-only',
            tripId: 'trip-1',
            status: RentalOrderStatus.PAID,
            financialStatus: RentalFinancialStatus.PAID,
            version: 1,
            membershipKind: 'PUBLIC_BOOKING_BUYER',
            membershipRef: 'booking-buyer-1',
            membershipSourceVersion: 2,
            rentalPolicy: { freeCancellationHours: 24 },
            rentalOrderLinesViaOrderId: [],
            deliveryTasksViaOrderId: [],
          },
        ]);

        const result = await adapter.processBookingCancelled(cmd);
        expect(result.status).toBe('PROCESSED');
        expect(result.affectedOrderIds).toEqual(['order-buyer-only']);
        expect(result.cancelledOrderIds).toEqual(['order-buyer-only']);
      });
    });
  });
});

