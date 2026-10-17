jest.mock('@nestjs/schedule', () => ({
  Cron: jest.fn(() => () => {}),
  CronExpression: {},
  Interval: jest.fn(() => () => {}),
}));

import {
  RentalOrderStatus,
  RentalOrderExceptionStatus,
  RentalExtensionStatus,
  ReservationStatus,
  DeliveryTaskStatus,
  DeliveryTaskType,
  PaymentStatus,
  InvoiceStatus,
  Prisma,
} from '@prisma/client';
import { RentalExtensionService, applyExtensionWithTx, releaseExtensionWithTx, consumeExtensionPaymentWithTx } from './rental-extension.service';
import { RentalOverdueService } from '../../lifecycle/application/services/rental-overdue.service';
import { effectiveDueAt } from './rental-extension.policy';
import { RentalExtensionController } from './rental-extension.controller';
import { RentalExtensionPaymentsController } from '../../payments/rental-extension-payments.controller';

describe('Phase 07B: Rental Extension & Overdue Lifecycle Unit Tests', () => {
  let mockPrisma: any;
  let mockTx: any;
  let mockContext: any;
  let extensionService: RentalExtensionService;
  let overdueService: RentalOverdueService;

  const PRIMARY_LOC_ID = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID = PRIMARY_LOC_ID;

    mockTx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      rentalOrder: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      rentalDocument: {
        findFirst: jest.fn().mockImplementation(({ where }: any) => {
          if (where?.documentType === 'HANDOVER') {
            return Promise.resolve({
              id: 'root-handover-1',
              orderId: where.orderId ?? 'order-1',
              documentType: 'HANDOVER',
            });
          }
          return Promise.resolve(null);
        }),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'doc-appendix-1', documentNumber: 'TG-EXTENSION_APPENDIX-123' }),
        count: jest.fn().mockResolvedValue(0),
      },
      paymentOutboxEvent: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      rentalOrderLine: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      rentalQuantityReservation: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'res-delta-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        aggregate: jest.fn().mockResolvedValue({ _max: { reservationCycle: 1 } }),
      },
      rentalUnitAssignment: {
        count: jest.fn().mockResolvedValue(1),
      },
      deliveryTask: {
        update: jest.fn().mockResolvedValue({}),
      },
      rentalExtensionRequest: {
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      rentalExtensionLine: {
        findMany: jest.fn().mockResolvedValue([{ orderLineId: 'line-1' }]),
      },
      idempotencyRecord: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      payment: {
        update: jest.fn().mockResolvedValue({}),
      },
      invoice: {
        update: jest.fn().mockResolvedValue({}),
      },
      rentalOutboxEvent: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      inventoryLocation: {
        findUnique: jest.fn().mockResolvedValue({ id: PRIMARY_LOC_ID, status: 'ACTIVE' }),
      },
      equipmentUnit: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'unit-1',
            status: 'AVAILABLE',
            currentInventoryLocationId: PRIMARY_LOC_ID,
            homeInventoryLocationId: PRIMARY_LOC_ID,
            readinessCommitmentsViaUnitId: [],
            returnInspectionTasks: [],
          },
        ]),
      },
    };

    mockPrisma = {
      $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => cb(mockTx)),
      rentalOrder: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      rentalExtensionRequest: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockResolvedValue({}),
      },
      idempotencyRecord: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      rentalOutboxEvent: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      inventoryLocation: {
        findUnique: jest.fn().mockResolvedValue({ id: PRIMARY_LOC_ID, status: 'ACTIVE' }),
      },
    };

    mockContext = {
      getByTripId: jest.fn().mockResolvedValue({
        trip: { endAt: new Date('2026-10-26T18:00:00Z') },
        membershipRef: 'mem-1',
        pickup: { scheduledAt: new Date('2026-10-20T08:00:00Z'), id: 'pu-1' },
        dropoff: { scheduledAt: new Date('2026-10-24T18:00:00Z'), id: 'do-1' },
        activePolicy: { maxRentalAfterTripHours: 48 },
        returnOptions: [
          {
            id: 'RETURN_POINT_1',
            pointId: 'sp-1',
            pointName: 'Station 1',
            method: 'DIRECT_RETURN',
            available: true,
            windowStart: new Date('2026-10-24T00:00:00Z'),
            windowEnd: new Date('2026-10-28T00:00:00Z'),
          },
        ],
      }),
    };

    extensionService = new RentalExtensionService(mockPrisma, mockContext);
    overdueService = new RentalOverdueService(mockPrisma);
  });

  const baseOrder = {
    id: 'order-ext-1',
    userId: 'user-1',
    tripId: 'trip-1',
    membershipRef: 'mem-1',
    status: RentalOrderStatus.ACTIVE,
    exceptionStatus: RentalOrderExceptionStatus.NONE,
    version: 2,
    rentalStartAt: new Date('2026-10-20T08:00:00Z'),
    rentalEndAt: new Date('2026-10-24T18:00:00Z'),
    plannedReturnAt: new Date('2026-10-24T18:00:00Z'),
    operationalReturnDueAt: new Date('2026-10-24T18:00:00Z'),
    occupiedEndAt: new Date('2026-10-25T18:00:00Z'),
    currency: 'VND',
    policySnapshot: {
      termsVersion: 'v1.5.2',
      maxExtensionCount: 2,
      maxTotalRentalDays: 14,
      maxRentalAfterTripHours: 48,
      extensionRequestCutoffMinutes: 120, // 2 hours
      extensionHoldMinutes: 15,
      quoteTtlMinutes: 10,
      postReturnBufferHours: 24,
      deepInspectionBufferHours: 48,
    },
    rentalOrderLinesViaOrderId: [
      {
        id: 'line-1',
        productId: 'prod-tent',
        quantity: 1,
        dailyPriceSnapshot: new Prisma.Decimal('100000.00'),
        lineRentalFee: new Prisma.Decimal('400000.00'),
        chargedDays: 4,
        product: {
          id: 'prod-tent',
          requiresDeepReturnInspection: false,
        },
      },
    ],
    deliveryTasksViaOrderId: [
      {
        id: 'task-ret-1',
        taskType: DeliveryTaskType.RETURN,
        status: DeliveryTaskStatus.SCHEDULED,
        staffId: 'staff-del-1', // Target 1.3.3: Staff assigned/claimed MUST NOT block extension!
      },
    ],
    returnInspectionsViaOrderId: [],
  };

  describe('1. Extension Conditions & Guard Rules', () => {
    it('REJECTS extension quote if order is not ACTIVE', async () => {
      mockPrisma.rentalOrder.findUnique.mockResolvedValueOnce({
        ...baseOrder,
        status: RentalOrderStatus.READY_FOR_HANDOVER, // Not ACTIVE
      });

      await expect(
        extensionService.quote(
          'user-1',
          'order-ext-1',
          new Date('2026-10-26T18:00:00Z'),
          'RETURN_POINT_1',
          new Date('2026-10-24T10:00:00Z'),
        ),
      ).rejects.toMatchObject({ code: 'EXTENSION_INVALID_ORDER_STATE' });
    });

    it('REJECTS extension quote if now is past cutoff before effectiveDueAt (RB-POL-23)', async () => {
      mockPrisma.rentalOrder.findUnique.mockResolvedValueOnce(baseOrder);
      const lateTime = new Date('2026-10-24T16:30:00Z');

      await expect(
        extensionService.quote(
          'user-1',
          'order-ext-1',
          new Date('2026-10-26T18:00:00Z'),
          'RETURN_POINT_1',
          lateTime,
        ),
      ).rejects.toMatchObject({ code: 'EXTENSION_TOO_LATE' });
    });

    it('REJECTS extension quote if exceptionStatus is already OVERDUE', async () => {
      mockPrisma.rentalOrder.findUnique.mockResolvedValueOnce({
        ...baseOrder,
        exceptionStatus: RentalOrderExceptionStatus.OVERDUE,
      });

      await expect(
        extensionService.quote(
          'user-1',
          'order-ext-1',
          new Date('2026-10-26T18:00:00Z'),
          'RETURN_POINT_1',
          new Date('2026-10-24T10:00:00Z'),
        ),
      ).rejects.toMatchObject({ code: 'EXTENSION_TOO_LATE' });
    });

    it('REJECTS extension quote if return inspection has already started', async () => {
      mockPrisma.rentalOrder.findUnique.mockResolvedValueOnce({
        ...baseOrder,
        returnInspectionsViaOrderId: [{ id: 'insp-1', status: 'IN_PROGRESS' }],
      });

      await expect(
        extensionService.quote(
          'user-1',
          'order-ext-1',
          new Date('2026-10-26T18:00:00Z'),
          'RETURN_POINT_1',
          new Date('2026-10-24T10:00:00Z'),
        ),
      ).rejects.toMatchObject({ code: 'EXTENSION_RETURN_STARTED' });
    });

    it('INVARIANT: ReturnTask in SCHEDULED (even with staff claimed/assigned in target 1.3.3) does NOT block extension', async () => {
      mockPrisma.rentalOrder.findUnique.mockResolvedValueOnce({
        ...baseOrder,
        deliveryTasksViaOrderId: [
          {
            id: 'task-ret-claimed',
            taskType: DeliveryTaskType.RETURN,
            status: DeliveryTaskStatus.SCHEDULED,
            staffId: 'staff-delivery-99', // Claimed by delivery staff
          },
        ],
      });

      mockPrisma.rentalExtensionRequest.count.mockResolvedValueOnce(0);
      mockPrisma.rentalExtensionRequest.create.mockResolvedValueOnce({
        id: 'quote-valid-1',
      });

      const result = await extensionService.quote(
        'user-1',
        'order-ext-1',
        new Date('2026-10-26T18:00:00Z'),
        'RETURN_POINT_1',
        new Date('2026-10-24T10:00:00Z'),
      );

      expect(result.extensionQuoteId).toBe('quote-valid-1');
      expect(result.expectedVersion).toBe(2);
      expect(result.termsVersion).toBe('v1.5.2');
    });

    it('REJECTS extension if ReturnTask is in physical collection (COLLECTING/RETURNED)', async () => {
      mockPrisma.rentalOrder.findUnique.mockResolvedValueOnce({
        ...baseOrder,
        deliveryTasksViaOrderId: [
          {
            id: 'task-ret-collecting',
            taskType: DeliveryTaskType.RETURN,
            status: DeliveryTaskStatus.COLLECTING, // Physical collection started!
          },
        ],
      });

      await expect(
        extensionService.quote(
          'user-1',
          'order-ext-1',
          new Date('2026-10-26T18:00:00Z'),
          'RETURN_POINT_1',
          new Date('2026-10-24T10:00:00Z'),
        ),
      ).rejects.toMatchObject({ code: 'EXTENSION_RETURN_TASK_STARTED' });
    });
  });

  describe('2. P0-01: Product-Specific Return Buffer (RB-POL-30)', () => {
    it('Calculates 24h buffer for standard product and 48h buffer for deep-inspection product in mixed cart', async () => {
      const returnAt = new Date('2026-10-26T18:00:00Z');
      const mixedOrder = {
        ...baseOrder,
        rentalOrderLinesViaOrderId: [
          {
            id: 'line-std',
            productId: 'prod-tent',
            quantity: 1,
            dailyPriceSnapshot: new Prisma.Decimal('100000.00'),
            lineRentalFee: new Prisma.Decimal('400000.00'),
            chargedDays: 4,
            product: { id: 'prod-tent', requiresDeepReturnInspection: false },
          },
          {
            id: 'line-deep',
            productId: 'prod-stove',
            quantity: 1,
            dailyPriceSnapshot: new Prisma.Decimal('50000.00'),
            lineRentalFee: new Prisma.Decimal('200000.00'),
            chargedDays: 4,
            product: { id: 'prod-stove', requiresDeepReturnInspection: true }, // Deep inspection!
          },
        ],
      };

      mockPrisma.rentalOrder.findUnique.mockResolvedValueOnce(mixedOrder);
      mockPrisma.rentalExtensionRequest.count.mockResolvedValueOnce(0);
      mockPrisma.rentalExtensionRequest.create.mockImplementationOnce(async ({ data }: any) => ({
        id: 'quote-mixed-1',
        ...data,
      }));

      await extensionService.quote(
        'user-1',
        'order-ext-1',
        returnAt,
        'RETURN_POINT_1',
        new Date('2026-10-24T10:00:00Z'),
      );

      // Verify that create received requestedOccupiedUntil = returnAt + 48h (because of deep inspection product)
      const expectedDeepOccupiedUntil = new Date(returnAt.getTime() + 48 * 3600000);
      expect(mockPrisma.rentalExtensionRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            requestedOccupiedUntil: expectedDeepOccupiedUntil,
          }),
        }),
      );
    });
  });

  describe('3. P0-02 & P0-03: Primary InventoryLocation Scoping & Terms Acceptance Audit', () => {
    const rawQuote = {
      id: 'quote-1',
      orderId: 'order-ext-1',
      userId: 'user-1',
      status: RentalExtensionStatus.QUOTED,
      previousRentalEndAt: baseOrder.rentalEndAt,
      requestedRentalEndAt: new Date('2026-10-26T18:00:00Z'),
      previousOccupiedUntil: baseOrder.occupiedEndAt,
      requestedOccupiedUntil: new Date('2026-10-27T18:00:00Z'),
      returnOptionSnapshot: { id: 'RETURN_POINT_1', pointId: 'sp-1' },
      additionalFee: new Prisma.Decimal('200000.00'),
      currency: 'VND',
      policySnapshot: baseOrder.policySnapshot,
      quotedOrderVersion: 2,
      quoteExpiresAt: new Date('2026-10-24T10:10:00Z'),
      order: baseOrder,
    };

    it('P0-03: REJECTS confirmation when acceptedTermsVersion does not match quoted terms', async () => {
      mockPrisma.rentalExtensionRequest.findUnique.mockResolvedValueOnce(rawQuote);

      await expect(
        extensionService.confirm('user-1', 'order-ext-1', 'quote-1', 2, 'idem-key-terms-mismatch', 'v0.9-stale'),
      ).rejects.toMatchObject({ code: 'TERMS_VERSION_MISMATCH' });
    });

    it('P0-02 & P0-03: Scopes delta capacity to primary location and atomically persists acceptance audit & termsHash', async () => {
      mockPrisma.rentalExtensionRequest.findUnique.mockResolvedValueOnce(rawQuote);
      mockTx.rentalOrder.findUnique.mockResolvedValueOnce(baseOrder);
      mockTx.rentalExtensionRequest.count.mockResolvedValueOnce(0);
      mockTx.rentalQuantityReservation.aggregate.mockResolvedValueOnce({ _max: { reservationCycle: 1 } });
      mockTx.rentalExtensionRequest.update.mockResolvedValueOnce({
        id: 'quote-1',
        additionalFee: new Prisma.Decimal('200000.00'),
        acceptedTermsVersion: 'v1.5.2',
      });

      const now = new Date('2026-10-24T10:00:00Z');
      const result = await extensionService.confirm(
        'user-1',
        'order-ext-1',
        'quote-1',
        2,
        'idem-key-confirm-audit',
        'v1.5.2',
        now,
      );

      expect(result.status).toBe('PENDING_PAYMENT');
      expect(result.additionalFee).toBe(200000);

      // Verify primary location resolved
      expect(mockTx.inventoryLocation.findUnique).toHaveBeenCalledWith({
        where: { id: PRIMARY_LOC_ID },
        select: { id: true, status: true },
      });

      // Verify acceptance audit fields persisted atomically on RentalExtensionRequest
      expect(mockTx.rentalExtensionRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'quote-1' },
          data: expect.objectContaining({
            status: RentalExtensionStatus.PENDING_PAYMENT,
            acceptedByUserId: 'user-1',
            acceptedAt: now,
            acceptedTermsVersion: 'v1.5.2',
            termsHash: expect.stringMatching(/^[a-f0-9]{64}$/), // 64-char sha256 hex string!
          }),
        }),
      );
    });

    it('P0-02: REJECTS confirmation with EXTENSION_CAPACITY_CONFLICT when primary warehouse inventory is insufficient', async () => {
      mockPrisma.rentalExtensionRequest.findUnique.mockResolvedValueOnce(rawQuote);
      mockTx.rentalOrder.findUnique.mockResolvedValueOnce(baseOrder);
      mockTx.rentalExtensionRequest.count.mockResolvedValueOnce(0);
      mockTx.rentalQuantityReservation.aggregate.mockResolvedValueOnce({ _max: { reservationCycle: 1 } });

      // Simulate 0 available units and 0 assigned units in primary location
      mockTx.equipmentUnit.findMany.mockResolvedValueOnce([]); // 0 available in primary
      mockTx.rentalUnitAssignment.count.mockResolvedValueOnce(0); // 0 assigned own units

      await expect(
        extensionService.confirm(
          'user-1',
          'order-ext-1',
          'quote-1',
          2,
          'idem-key-conflict',
          'v1.5.2',
          new Date('2026-10-24T10:00:00Z'),
        ),
      ).rejects.toMatchObject({ code: 'EXTENSION_CAPACITY_CONFLICT' });
    });
  });

  describe('4. P1-06: Shared Payment Integration, Reversal & Late Payment', () => {
    it('APPLIES extension on payment success: synchronizes rentalEndAt, operationalReturnDueAt, delivery task, and confirms delta reservation', async () => {
      const now = new Date('2026-10-24T12:00:00Z');
      const ext = {
        id: 'ext-pending-1',
        orderId: 'order-ext-1',
        status: RentalExtensionStatus.PENDING_PAYMENT,
        previousRentalEndAt: baseOrder.rentalEndAt,
        requestedRentalEndAt: new Date('2026-10-26T18:00:00Z'),
        previousOccupiedUntil: baseOrder.occupiedEndAt,
        requestedOccupiedUntil: new Date('2026-10-27T18:00:00Z'),
        returnOptionSnapshot: { id: 'RETURN_POINT_1', pointId: 'sp-new-point' },
        additionalFee: new Prisma.Decimal('200000.00'),
        currency: 'VND',
        holdExpiresAt: new Date(now.getTime() + 600000), // Active hold
        lines: [
          {
            orderLineId: 'line-1',
            newChargedDays: 6,
            additionalFee: new Prisma.Decimal('200000.00'),
          },
        ],
        invoiceId: 'inv-ext-1',
        paymentRef: 'pay-ext-1',
        acceptedByUserId: 'user-1',
        acceptedAt: now,
        acceptedTermsVersion: 'v1.5.2',
        termsHash: 'a'.repeat(64),
      };

      mockTx.rentalExtensionRequest.findUnique.mockResolvedValue(ext);
      mockTx.rentalOrder.findUnique.mockResolvedValueOnce(baseOrder);
      mockTx.rentalQuantityReservation.findMany.mockResolvedValueOnce([{ id: 'res-delta-1' }]);
      mockTx.rentalOrderLine.findUnique.mockResolvedValueOnce(baseOrder.rentalOrderLinesViaOrderId[0]);

      await consumeExtensionPaymentWithTx(
        mockTx,
        'ext-pending-1',
        {
          id: 'pay-ext-1',
          invoiceId: 'inv-ext-1',
          amount: new Prisma.Decimal('200000.00'),
          currency: 'VND',
          transactionRef: 'tx-vnpay-success',
        },
        'SUCCEEDED',
        'provider-ref-123',
        now,
      );

      // Verify payment and invoice marked SUCCEEDED / PAID
      expect(mockTx.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-ext-1' },
          data: expect.objectContaining({ status: PaymentStatus.SUCCEEDED }),
        }),
      );
      expect(mockTx.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-ext-1' },
          data: expect.objectContaining({ status: InvoiceStatus.PAID }),
        }),
      );

      // Verify delta reservation confirmed
      expect(mockTx.rentalQuantityReservation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['res-delta-1'] } },
          data: expect.objectContaining({
            status: ReservationStatus.CONFIRMED,
            confirmedAt: now,
          }),
        }),
      );

      // Verify rental order dates and operationalReturnDueAt synchronized
      expect(mockTx.rentalOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-ext-1' },
          data: expect.objectContaining({
            rentalEndAt: ext.requestedRentalEndAt,
            plannedReturnAt: ext.requestedRentalEndAt,
            operationalReturnDueAt: ext.requestedRentalEndAt,
            occupiedEndAt: ext.requestedOccupiedUntil,
            returnPointId: 'sp-new-point',
          }),
        }),
      );
    });

    it('P1-06: RELEASES hold and emits RENTAL_EXTENSION_REFUND_REQUIRED on late payment after hold expiry', async () => {
      const now = new Date('2026-10-24T12:00:00Z');
      const expiredHoldTime = new Date('2026-10-24T11:00:00Z'); // Expired 1 hour ago!
      const ext = {
        id: 'ext-pending-expired',
        orderId: 'order-ext-1',
        status: RentalExtensionStatus.PENDING_PAYMENT,
        previousOccupiedUntil: baseOrder.occupiedEndAt,
        requestedOccupiedUntil: new Date('2026-10-27T18:00:00Z'),
        holdExpiresAt: expiredHoldTime, // EXPIRED!
        additionalFee: new Prisma.Decimal('200000.00'),
        currency: 'VND',
        invoiceId: 'inv-expired',
        paymentRef: 'pay-expired',
      };

      mockTx.rentalExtensionRequest.findUnique
        .mockResolvedValueOnce(ext)
        .mockResolvedValueOnce(ext);

      await consumeExtensionPaymentWithTx(
        mockTx,
        'ext-pending-expired',
        {
          id: 'pay-expired',
          invoiceId: 'inv-expired',
          amount: new Prisma.Decimal('200000.00'),
          currency: 'VND',
          transactionRef: 'tx-late-success',
        },
        'SUCCEEDED',
        'provider-late-ref',
        now,
      );

      // Verify extension is EXPIRED, NOT APPLIED
      expect(mockTx.rentalExtensionRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ext-pending-expired' },
          data: expect.objectContaining({ status: RentalExtensionStatus.EXPIRED }),
        }),
      );

      // Verify delta reservations released
      expect(mockTx.rentalQuantityReservation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ReservationStatus.RELEASED }),
        }),
      );

      // Verify RENTAL_EXTENSION_REFUND_REQUIRED emitted to outbox for Shared Payment reconciliation
      expect(mockTx.rentalOutboxEvent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            eventType: 'RENTAL_EXTENSION_REFUND_REQUIRED',
            aggregateId: 'ext-pending-expired',
            payload: expect.objectContaining({
              reason: 'EXTENSION_HOLD_EXPIRED',
              paymentId: 'pay-expired',
              invoiceId: 'inv-expired',
            }),
          }),
        }),
      );

      // INVARIANT: Order dates NOT extended
      expect(mockTx.rentalOrder.update).not.toHaveBeenCalled();
    });
  });

  describe('5. P1-04: SOT Overdue Lifecycle & Milestone Follow-up Scans', () => {
    it('Transitions ACTIVE order to OVERDUE when now > effectiveOperationalDueAt, preserving equipmentUnit and not deducting deposits', async () => {
      const orderOverdue = {
        id: 'order-overdue-1',
        userId: 'user-overdue',
        tripId: 'trip-1',
        status: RentalOrderStatus.ACTIVE,
        exceptionStatus: RentalOrderExceptionStatus.NONE,
        rentalStartAt: new Date('2026-10-20T08:00:00Z'),
        rentalEndAt: new Date('2026-10-24T18:00:00Z'),
        operationalReturnDueAt: new Date('2026-10-24T18:00:00Z'),
        version: 1,
      };

      mockPrisma.rentalOrder.findMany
        .mockResolvedValueOnce([orderOverdue]) // First scan: NONE orders
        .mockResolvedValueOnce([]); // Second scan: existing OVERDUE orders

      mockTx.rentalOrder.findUnique.mockResolvedValueOnce(orderOverdue);

      const now = new Date('2026-10-24T19:00:00Z'); // 1 hour past dueAt (18:00)

      const result = await overdueService.scanAndMarkOverdue(now);
      expect(result.scannedCount).toBe(1);
      expect(result.overdueOrderIds).toContain('order-overdue-1');

      // Order exceptionStatus updated to OVERDUE
      expect(mockTx.rentalOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-overdue-1', version: 1 },
          data: expect.objectContaining({
            exceptionStatus: RentalOrderExceptionStatus.OVERDUE,
          }),
        }),
      );

      // Outbox RENTAL_ORDER_OVERDUE emitted
      expect(mockTx.rentalOutboxEvent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            eventType: 'RENTAL_ORDER_OVERDUE',
            aggregateId: 'order-overdue-1',
            payload: expect.objectContaining({
              equipmentStatus: 'RENTED', // INVARIANT: EquipmentUnit NOT declared LOST!
              depositDeductionApplied: false, // INVARIANT: NO automatic deposit deduction!
            }),
          }),
        }),
      );
    });

    it('P1-04: Follow-up scan emits CONTACT_REQUIRED at +2h and ADMIN_LOST_ELIGIBLE at >=48h', async () => {
      const dueAt = new Date('2026-10-24T18:00:00Z');
      const order2h = {
        id: 'order-overdue-2h',
        userId: 'user-2h',
        tripId: 'trip-1',
        status: RentalOrderStatus.ACTIVE,
        exceptionStatus: RentalOrderExceptionStatus.OVERDUE,
        rentalStartAt: new Date('2026-10-20T08:00:00Z'),
        rentalEndAt: dueAt,
        operationalReturnDueAt: dueAt,
      };
      const order48h = {
        id: 'order-overdue-48h',
        userId: 'user-48h',
        tripId: 'trip-2',
        status: RentalOrderStatus.ACTIVE,
        exceptionStatus: RentalOrderExceptionStatus.OVERDUE,
        rentalStartAt: new Date('2026-10-20T08:00:00Z'),
        rentalEndAt: dueAt,
        operationalReturnDueAt: dueAt,
      };

      mockPrisma.rentalOrder.findMany
        .mockResolvedValueOnce([]) // First scan: 0 NONE orders
        .mockResolvedValueOnce([order2h, order48h]); // Second scan: 2 existing OVERDUE orders

      // Run scan at 50h past dueAt
      const now = new Date(dueAt.getTime() + 50 * 3600000);
      await overdueService.scanAndMarkOverdue(now);

      // Emitted RENTAL_ORDER_OVERDUE_CONTACT_REQUIRED for +2h
      expect(mockPrisma.rentalOutboxEvent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            eventType: 'RENTAL_ORDER_OVERDUE_CONTACT_REQUIRED',
            payload: expect.objectContaining({
              missingReviewRequired: true,
              customerContactRequired: true,
            }),
          }),
        }),
      );

      // Emitted RENTAL_ORDER_OVERDUE_ADMIN_LOST_ELIGIBLE for >=48h
      expect(mockPrisma.rentalOutboxEvent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            eventType: 'RENTAL_ORDER_OVERDUE_ADMIN_LOST_ELIGIBLE',
            payload: expect.objectContaining({
              adminLostReviewEligible: true,
              manualReviewRequired: true,
            }),
          }),
        }),
      );
    });
  });

  describe('6. P1-05: RB-API-801–804 Route Contracts & Swagger Metadata', () => {
    it('RentalExtensionController registers RB-API-801, 802, and 804 routes with proper decorators', () => {
      const controllerPath = Reflect.getMetadata('path', RentalExtensionController);
      expect(controllerPath).toBe('rental-orders');

      // RB-API-801: POST :id/extension-quotes
      const quotePath = Reflect.getMetadata('path', RentalExtensionController.prototype.quote);
      expect(quotePath).toBe(':id/extension-quotes');

      // RB-API-802: POST :id/extensions
      const confirmPath = Reflect.getMetadata('path', RentalExtensionController.prototype.confirm);
      expect(confirmPath).toBe(':id/extensions');

      // RB-API-804: GET :id/extensions
      const listPath = Reflect.getMetadata('path', RentalExtensionController.prototype.list);
      expect(listPath).toBe(':id/extensions');
    });

    it('RentalExtensionPaymentsController registers RB-API-803 route with proper decorators', () => {
      const controllerPath = Reflect.getMetadata('path', RentalExtensionPaymentsController);
      expect(controllerPath).toBe('rental-extensions');

      // RB-API-803: POST :id/payments
      const checkoutPath = Reflect.getMetadata('path', RentalExtensionPaymentsController.prototype.checkout);
      expect(checkoutPath).toBe(':id/payments');
    });
  });

  describe('7. Phase 07B Targeted Fixes & Required Regression Scenarios', () => {
    const mixedOrder = {
      ...baseOrder,
      id: 'order-mixed-cart',
      rentalStartAt: new Date('2026-10-20T08:00:00Z'),
      rentalEndAt: new Date('2026-10-24T18:00:00Z'),
      plannedReturnAt: new Date('2026-10-24T18:00:00Z'),
      operationalReturnDueAt: new Date('2026-10-24T18:00:00Z'),
      occupiedEndAt: new Date('2026-10-26T18:00:00Z'),
      rentalOrderLinesViaOrderId: [
        {
          id: 'line-std-1',
          productId: 'prod-tent-std',
          quantity: 1,
          dailyPriceSnapshot: new Prisma.Decimal('100000.00'),
          lineRentalFee: new Prisma.Decimal('400000.00'),
          chargedDays: 4,
          product: { id: 'prod-tent-std', requiresDeepReturnInspection: false },
        },
        {
          id: 'line-deep-2',
          productId: 'prod-stove-deep',
          quantity: 1,
          dailyPriceSnapshot: new Prisma.Decimal('50000.00'),
          lineRentalFee: new Prisma.Decimal('200000.00'),
          chargedDays: 4,
          product: { id: 'prod-stove-deep', requiresDeepReturnInspection: true },
        },
      ],
    };

    it('Scenario 1: Mixed cart normal 24h + deep 48h extended by 1h produces valid per-line contiguous delta windows with occupiedFrom < occupiedUntil', async () => {
      const requestedReturnAt = new Date('2026-10-24T19:00:00Z');
      const quoteMixed = {
        id: 'quote-mixed-1h',
        orderId: 'order-mixed-cart',
        userId: 'user-1',
        status: RentalExtensionStatus.QUOTED,
        previousRentalEndAt: mixedOrder.rentalEndAt,
        requestedRentalEndAt: requestedReturnAt,
        previousOccupiedUntil: mixedOrder.occupiedEndAt,
        requestedOccupiedUntil: new Date('2026-10-26T19:00:00Z'),
        returnOptionSnapshot: { id: 'RETURN_POINT_1', pointId: 'sp-1' },
        additionalFee: new Prisma.Decimal('150000.00'),
        currency: 'VND',
        policySnapshot: mixedOrder.policySnapshot,
        quotedOrderVersion: 2,
        quoteExpiresAt: new Date('2026-10-24T10:10:00Z'),
        termsHash: 'a'.repeat(64),
        order: mixedOrder,
      };

      mockPrisma.rentalExtensionRequest.findUnique.mockResolvedValueOnce(quoteMixed);
      mockTx.rentalOrder.findUnique.mockResolvedValueOnce(mixedOrder);
      mockTx.rentalExtensionRequest.count.mockResolvedValueOnce(0);
      mockTx.rentalQuantityReservation.aggregate.mockResolvedValueOnce({ _max: { reservationCycle: 1 } });
      mockTx.rentalExtensionRequest.update.mockResolvedValueOnce({
        id: 'quote-mixed-1h',
        additionalFee: new Prisma.Decimal('150000.00'),
      });

      mockTx.rentalQuantityReservation.findFirst = jest.fn().mockImplementation(({ where }: any) => {
        if (where.orderLineId === 'line-std-1') {
          return Promise.resolve({
            id: 'res-std-cycle-1',
            orderLineId: 'line-std-1',
            occupiedFrom: new Date('2026-10-20T08:00:00Z'),
            occupiedUntil: new Date('2026-10-25T18:00:00Z'),
            status: ReservationStatus.CONFIRMED,
            reservationCycle: 1,
          });
        }
        if (where.orderLineId === 'line-deep-2') {
          return Promise.resolve({
            id: 'res-deep-cycle-1',
            orderLineId: 'line-deep-2',
            occupiedFrom: new Date('2026-10-20T08:00:00Z'),
            occupiedUntil: new Date('2026-10-26T18:00:00Z'),
            status: ReservationStatus.CONFIRMED,
            reservationCycle: 1,
          });
        }
        return Promise.resolve(null);
      });

      await extensionService.confirm(
        'user-1',
        'order-mixed-cart',
        'quote-mixed-1h',
        2,
        'idem-key-mixed-1h',
        'v1.5.2',
        new Date('2026-10-24T10:00:00Z'),
      );

      // Verify line-std: from 2026-10-25T18:00:00Z to 2026-10-25T19:00:00Z (1h delta, occupiedFrom < occupiedUntil)
      expect(mockTx.rentalQuantityReservation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderLineId: 'line-std-1',
          productId: 'prod-tent-std',
          occupiedFrom: new Date('2026-10-25T18:00:00Z'),
          occupiedUntil: new Date('2026-10-25T19:00:00Z'),
          status: ReservationStatus.HELD,
          reservationCycle: 2,
        }),
      });

      // Verify line-deep: from 2026-10-26T18:00:00Z to 2026-10-26T19:00:00Z (1h delta, occupiedFrom < occupiedUntil)
      expect(mockTx.rentalQuantityReservation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderLineId: 'line-deep-2',
          productId: 'prod-stove-deep',
          occupiedFrom: new Date('2026-10-26T18:00:00Z'),
          occupiedUntil: new Date('2026-10-26T19:00:00Z'),
          status: ReservationStatus.HELD,
          reservationCycle: 2,
        }),
      });
    });

    it('Scenario 2: Mixed cart extended longer than 24h (30h extension)', async () => {
      const requestedReturnAt = new Date('2026-10-26T00:00:00Z');
      const quoteMixed30h = {
        id: 'quote-mixed-30h',
        orderId: 'order-mixed-cart',
        userId: 'user-1',
        status: RentalExtensionStatus.QUOTED,
        previousRentalEndAt: mixedOrder.rentalEndAt,
        requestedRentalEndAt: requestedReturnAt,
        previousOccupiedUntil: mixedOrder.occupiedEndAt,
        requestedOccupiedUntil: new Date('2026-10-28T00:00:00Z'),
        returnOptionSnapshot: { id: 'RETURN_POINT_1', pointId: 'sp-1' },
        additionalFee: new Prisma.Decimal('300000.00'),
        currency: 'VND',
        policySnapshot: mixedOrder.policySnapshot,
        quotedOrderVersion: 2,
        quoteExpiresAt: new Date('2026-10-24T10:10:00Z'),
        termsHash: 'b'.repeat(64),
        order: mixedOrder,
      };

      mockPrisma.rentalExtensionRequest.findUnique.mockResolvedValueOnce(quoteMixed30h);
      mockTx.rentalOrder.findUnique.mockResolvedValueOnce(mixedOrder);
      mockTx.rentalExtensionRequest.count.mockResolvedValueOnce(0);
      mockTx.rentalQuantityReservation.aggregate.mockResolvedValueOnce({ _max: { reservationCycle: 1 } });
      mockTx.rentalExtensionRequest.update.mockResolvedValueOnce({
        id: 'quote-mixed-30h',
        additionalFee: new Prisma.Decimal('300000.00'),
      });

      mockTx.rentalQuantityReservation.findFirst = jest.fn().mockImplementation(({ where }: any) => {
        if (where.orderLineId === 'line-std-1') {
          return Promise.resolve({
            id: 'res-std-cycle-1',
            orderLineId: 'line-std-1',
            occupiedUntil: new Date('2026-10-25T18:00:00Z'),
            status: ReservationStatus.CONFIRMED,
          });
        }
        if (where.orderLineId === 'line-deep-2') {
          return Promise.resolve({
            id: 'res-deep-cycle-1',
            orderLineId: 'line-deep-2',
            occupiedUntil: new Date('2026-10-26T18:00:00Z'),
            status: ReservationStatus.CONFIRMED,
          });
        }
        return Promise.resolve(null);
      });

      await extensionService.confirm(
        'user-1',
        'order-mixed-cart',
        'quote-mixed-30h',
        2,
        'idem-key-mixed-30h',
        'v1.5.2',
        new Date('2026-10-24T10:00:00Z'),
      );

      // Line std delta: from 2026-10-25T18:00:00Z to 2026-10-27T00:00:00Z (returnAt + 24h)
      expect(mockTx.rentalQuantityReservation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderLineId: 'line-std-1',
          occupiedFrom: new Date('2026-10-25T18:00:00Z'),
          occupiedUntil: new Date('2026-10-27T00:00:00Z'),
          status: ReservationStatus.HELD,
        }),
      });

      // Line deep delta: from 2026-10-26T18:00:00Z to 2026-10-28T00:00:00Z (returnAt + 48h)
      expect(mockTx.rentalQuantityReservation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderLineId: 'line-deep-2',
          occupiedFrom: new Date('2026-10-26T18:00:00Z'),
          occupiedUntil: new Date('2026-10-28T00:00:00Z'),
          status: ReservationStatus.HELD,
        }),
      });
    });

    it('Scenario 3: Mixed cart zero-fee APPLIED immediately in confirm transaction', async () => {
      const quoteZeroFee = {
        id: 'quote-zero-fee',
        orderId: 'order-mixed-cart',
        userId: 'user-1',
        status: RentalExtensionStatus.QUOTED,
        previousRentalEndAt: mixedOrder.rentalEndAt,
        requestedRentalEndAt: new Date('2026-10-24T19:00:00Z'),
        previousOccupiedUntil: mixedOrder.occupiedEndAt,
        requestedOccupiedUntil: new Date('2026-10-26T19:00:00Z'),
        returnOptionSnapshot: { id: 'RETURN_POINT_1', pointId: 'sp-1' },
        additionalFee: new Prisma.Decimal('0.00'),
        currency: 'VND',
        policySnapshot: mixedOrder.policySnapshot,
        quotedOrderVersion: 2,
        quoteExpiresAt: new Date('2026-10-24T10:10:00Z'),
        termsHash: '0'.repeat(64),
        order: mixedOrder,
      };

      mockPrisma.rentalExtensionRequest.findUnique.mockResolvedValueOnce(quoteZeroFee);
      mockTx.rentalOrder.findUnique.mockResolvedValue(mixedOrder);
      mockTx.rentalExtensionRequest.count.mockResolvedValueOnce(0);
      mockTx.rentalQuantityReservation.aggregate.mockResolvedValueOnce({ _max: { reservationCycle: 1 } });
      mockTx.rentalExtensionRequest.update.mockResolvedValueOnce({
        id: 'quote-zero-fee',
        additionalFee: new Prisma.Decimal('0.00'),
      });

      mockTx.rentalExtensionRequest.findUnique.mockResolvedValueOnce({
        ...quoteZeroFee,
        status: RentalExtensionStatus.PENDING_PAYMENT,
        holdExpiresAt: new Date('2026-10-24T10:15:00Z'),
        acceptedByUserId: 'user-1',
        acceptedAt: new Date('2026-10-24T10:00:00Z'),
        acceptedTermsVersion: 'v1.5.2',
        termsHash: '0'.repeat(64),
        lines: [{ orderLineId: 'line-std-1', newChargedDays: 4, additionalFee: new Prisma.Decimal('0.00') }],
      });
      mockTx.rentalOrderLine.findUnique.mockResolvedValue({ id: 'line-std-1', chargedDays: 4 });

      const result = await extensionService.confirm(
        'user-1',
        'order-mixed-cart',
        'quote-zero-fee',
        2,
        'idem-key-zero-fee',
        'v1.5.2',
        new Date('2026-10-24T10:00:00Z'),
      );

      expect(result.status).toBe('APPLIED');
      expect(result.additionalFee).toBe(0);
    });

    it('Scenario 4: Payment success within hold TTL applies extension and confirms delta reservations', async () => {
      const now = new Date('2026-10-24T10:05:00Z');
      const ext = {
        id: 'ext-pending-in-ttl',
        orderId: 'order-mixed-cart',
        status: RentalExtensionStatus.PENDING_PAYMENT,
        previousRentalEndAt: mixedOrder.rentalEndAt,
        requestedRentalEndAt: new Date('2026-10-26T18:00:00Z'),
        previousOccupiedUntil: mixedOrder.occupiedEndAt,
        requestedOccupiedUntil: new Date('2026-10-28T18:00:00Z'),
        returnOptionSnapshot: { id: 'RETURN_POINT_1', pointId: 'sp-1' },
        additionalFee: new Prisma.Decimal('200000.00'),
        currency: 'VND',
        holdExpiresAt: new Date('2026-10-24T10:15:00Z'),
        invoiceId: 'inv-ext-1',
        paymentRef: 'pay-ext-1',
        acceptedByUserId: 'user-1',
        acceptedAt: now,
        acceptedTermsVersion: 'v1.5.2',
        termsHash: '4'.repeat(64),
        lines: [
          { orderLineId: 'line-std-1', newChargedDays: 6, additionalFee: new Prisma.Decimal('200000.00') },
        ],
      };

      mockTx.rentalExtensionRequest.findUnique.mockResolvedValue(ext);
      mockTx.rentalOrder.findUnique.mockResolvedValue(mixedOrder);
      mockTx.rentalQuantityReservation.findMany.mockResolvedValueOnce([{ id: 'res-held-1', holdExpiresAt: ext.holdExpiresAt }]);
      mockTx.rentalOrderLine.findUnique.mockResolvedValue({ id: 'line-std-1', chargedDays: 4 });

      const payment = {
        id: 'pay-ext-1',
        invoiceId: 'inv-ext-1',
        amount: new Prisma.Decimal('200000.00'),
        currency: 'VND',
        transactionRef: 'txn-prov-1',
      };

      await consumeExtensionPaymentWithTx(mockTx, 'ext-pending-in-ttl', payment, 'SUCCEEDED', 'txn-prov-1', now);

      expect(mockTx.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'pay-ext-1' }, data: expect.objectContaining({ status: PaymentStatus.SUCCEEDED }) }),
      );
      expect(mockTx.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'inv-ext-1' }, data: expect.objectContaining({ status: InvoiceStatus.PAID }) }),
      );
      expect(mockTx.rentalQuantityReservation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['res-held-1'] } },
          data: expect.objectContaining({ status: ReservationStatus.CONFIRMED }),
        }),
      );
      expect(mockTx.rentalExtensionRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'ext-pending-in-ttl' }, data: expect.objectContaining({ status: RentalExtensionStatus.APPLIED }) }),
      );
    });

    it('Scenario 5: Hold expired and late payment releases hold and emits RENTAL_EXTENSION_REFUND_REQUIRED without applying extension', async () => {
      const now = new Date('2026-10-24T10:25:00Z');
      const ext = {
        id: 'ext-pending-expired',
        orderId: 'order-mixed-cart',
        status: RentalExtensionStatus.PENDING_PAYMENT,
        previousRentalEndAt: mixedOrder.rentalEndAt,
        requestedRentalEndAt: new Date('2026-10-26T18:00:00Z'),
        previousOccupiedUntil: mixedOrder.occupiedEndAt,
        requestedOccupiedUntil: new Date('2026-10-28T18:00:00Z'),
        returnOptionSnapshot: { id: 'RETURN_POINT_1', pointId: 'sp-1' },
        additionalFee: new Prisma.Decimal('200000.00'),
        currency: 'VND',
        holdExpiresAt: new Date('2026-10-24T10:15:00Z'),
        invoiceId: 'inv-ext-late',
        paymentRef: 'pay-ext-late',
        lines: [{ orderLineId: 'line-std-1' }],
      };

      mockTx.rentalExtensionRequest.findUnique.mockResolvedValue(ext);
      const payment = {
        id: 'pay-ext-late',
        invoiceId: 'inv-ext-late',
        amount: new Prisma.Decimal('200000.00'),
        currency: 'VND',
        transactionRef: 'txn-prov-late',
      };

      await consumeExtensionPaymentWithTx(mockTx, 'ext-pending-expired', payment, 'SUCCEEDED', 'txn-prov-late', now);

      expect(mockTx.rentalQuantityReservation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: ReservationStatus.HELD }),
          data: expect.objectContaining({ status: ReservationStatus.RELEASED }),
        }),
      );
      expect(mockTx.rentalExtensionRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'ext-pending-expired' }, data: expect.objectContaining({ status: RentalExtensionStatus.EXPIRED }) }),
      );
      expect(mockTx.rentalOrder.update).not.toHaveBeenCalled();
      expect(mockTx.rentalOutboxEvent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            eventType: 'RENTAL_EXTENSION_REFUND_REQUIRED',
            payload: expect.objectContaining({
              reason: 'EXTENSION_HOLD_EXPIRED',
              paymentId: 'pay-ext-late',
            }),
          }),
        }),
      );
    });

    it('Scenario 6: Two orders competing for same product capacity - second order fails with EXTENSION_CAPACITY_CONFLICT', async () => {
      mockPrisma.rentalExtensionRequest.findUnique.mockResolvedValueOnce({
        id: 'quote-order-b',
        orderId: 'order-b',
        userId: 'user-b',
        status: RentalExtensionStatus.QUOTED,
        previousRentalEndAt: mixedOrder.rentalEndAt,
        requestedRentalEndAt: new Date('2026-10-26T18:00:00Z'),
        previousOccupiedUntil: mixedOrder.occupiedEndAt,
        requestedOccupiedUntil: new Date('2026-10-27T18:00:00Z'),
        returnOptionSnapshot: { id: 'RETURN_POINT_1', pointId: 'sp-1' },
        additionalFee: new Prisma.Decimal('100000.00'),
        currency: 'VND',
        policySnapshot: mixedOrder.policySnapshot,
        quotedOrderVersion: 2,
        quoteExpiresAt: new Date('2026-10-24T10:10:00Z'),
        order: { ...mixedOrder, id: 'order-b', userId: 'user-b' },
      });

      mockTx.rentalOrder.findUnique.mockResolvedValueOnce({ ...mixedOrder, id: 'order-b', userId: 'user-b' });
      mockTx.rentalExtensionRequest.count.mockResolvedValueOnce(0);
      mockTx.rentalQuantityReservation.aggregate.mockResolvedValueOnce({ _max: { reservationCycle: 1 } });

      mockTx.equipmentUnit.findMany.mockResolvedValueOnce([]);
      mockTx.rentalUnitAssignment.count.mockResolvedValueOnce(0);

      await expect(
        extensionService.confirm(
          'user-b',
          'order-b',
          'quote-order-b',
          2,
          'idem-key-competing-order',
          'v1.5.2',
          new Date('2026-10-24T10:00:00Z'),
        ),
      ).rejects.toMatchObject({ code: 'EXTENSION_CAPACITY_CONFLICT' });
    });

    it('Scenario 7: Mismatch termsHash rejects confirm with TERMS_HASH_MISMATCH', async () => {
      const quoteWithHash = {
        id: 'quote-terms-test',
        orderId: 'order-mixed-cart',
        userId: 'user-1',
        status: RentalExtensionStatus.QUOTED,
        previousRentalEndAt: mixedOrder.rentalEndAt,
        requestedRentalEndAt: new Date('2026-10-26T18:00:00Z'),
        previousOccupiedUntil: mixedOrder.occupiedEndAt,
        requestedOccupiedUntil: new Date('2026-10-28T18:00:00Z'),
        returnOptionSnapshot: { id: 'RETURN_POINT_1', pointId: 'sp-1' },
        additionalFee: new Prisma.Decimal('200000.00'),
        currency: 'VND',
        policySnapshot: mixedOrder.policySnapshot,
        quotedOrderVersion: 2,
        quoteExpiresAt: new Date('2026-10-24T10:10:00Z'),
        termsHash: 'c'.repeat(64),
        order: mixedOrder,
      };

      mockPrisma.rentalExtensionRequest.findUnique.mockResolvedValueOnce(quoteWithHash);

      await expect(
        extensionService.confirm(
          'user-1',
          'order-mixed-cart',
          'quote-terms-test',
          2,
          'idem-terms-hash-mismatch',
          'v1.5.2',
          'f'.repeat(64),
          new Date('2026-10-24T10:00:00Z'),
        ),
      ).rejects.toMatchObject({ code: 'TERMS_HASH_MISMATCH' });
    });

    it('Scenario 8: Trip reschedule followed by Extension APPLIED preserves later operationalReturnDueAt', async () => {
      const now = new Date('2026-10-24T10:00:00Z');
      const orderAfterReschedule = {
        ...mixedOrder,
        rentalEndAt: new Date('2026-10-24T18:00:00Z'),
        operationalReturnDueAt: new Date('2026-10-28T18:00:00Z'),
        occupiedEndAt: new Date('2026-10-30T18:00:00Z'),
      };

      const ext = {
        id: 'ext-after-reschedule',
        orderId: 'order-mixed-cart',
        status: RentalExtensionStatus.PENDING_PAYMENT,
        previousRentalEndAt: orderAfterReschedule.rentalEndAt,
        requestedRentalEndAt: new Date('2026-10-26T18:00:00Z'),
        previousOccupiedUntil: orderAfterReschedule.occupiedEndAt,
        requestedOccupiedUntil: new Date('2026-10-30T18:00:00Z'),
        returnOptionSnapshot: { id: 'RETURN_POINT_1', pointId: 'sp-1' },
        additionalFee: new Prisma.Decimal('100000.00'),
        currency: 'VND',
        holdExpiresAt: new Date('2026-10-24T10:15:00Z'),
        acceptedByUserId: 'user-1',
        acceptedAt: now,
        acceptedTermsVersion: 'v1.5.2',
        termsHash: '8'.repeat(64),
        lines: [{ orderLineId: 'line-std-1', newChargedDays: 5, additionalFee: new Prisma.Decimal('100000.00') }],
      };

      mockTx.rentalExtensionRequest.findUnique.mockResolvedValue(ext);
      mockTx.rentalOrder.findUnique.mockResolvedValue(orderAfterReschedule);
      mockTx.rentalQuantityReservation.findMany.mockResolvedValue([]);
      mockTx.rentalOrderLine.findUnique.mockResolvedValue({ id: 'line-std-1', chargedDays: 4 });

      await applyExtensionWithTx(mockTx, 'ext-after-reschedule', now);

      expect(mockTx.rentalOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-mixed-cart' },
          data: expect.objectContaining({
            rentalEndAt: new Date('2026-10-26T18:00:00Z'),
            operationalReturnDueAt: new Date('2026-10-28T18:00:00Z'),
            plannedReturnAt: new Date('2026-10-28T18:00:00Z'),
          }),
        }),
      );

      expect(mockTx.deliveryTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-ret-1' },
          data: expect.objectContaining({
            scheduledAt: new Date('2026-10-28T18:00:00Z'),
          }),
        }),
      );
    });

    it('Scenario 9: Extension APPLIED issues EXTENSION_APPENDIX idempotently when root HANDOVER document exists', async () => {
      const now = new Date('2026-10-24T10:00:00Z');
      const ext = {
        id: 'ext-with-appendix',
        orderId: 'order-mixed-cart',
        status: RentalExtensionStatus.PENDING_PAYMENT,
        previousRentalEndAt: mixedOrder.rentalEndAt,
        requestedRentalEndAt: new Date('2026-10-26T18:00:00Z'),
        previousOccupiedUntil: mixedOrder.occupiedEndAt,
        requestedOccupiedUntil: new Date('2026-10-28T18:00:00Z'),
        returnOptionSnapshot: { id: 'RETURN_POINT_1', pointId: 'sp-1' },
        additionalFee: new Prisma.Decimal('200000.00'),
        currency: 'VND',
        holdExpiresAt: new Date('2026-10-24T10:15:00Z'),
        acceptedByUserId: 'user-1',
        acceptedAt: now,
        acceptedTermsVersion: 'v1.5.2',
        termsHash: 'e'.repeat(64),
        lines: [{ orderLineId: 'line-std-1', newChargedDays: 6, additionalFee: new Prisma.Decimal('200000.00') }],
      };

      mockTx.rentalExtensionRequest.findUnique
        .mockResolvedValueOnce(ext)
        .mockResolvedValueOnce({
          ...ext,
          status: RentalExtensionStatus.APPLIED,
          appliedAt: now,
        });

      mockTx.rentalOrder.findUnique.mockResolvedValue(mixedOrder);
      mockTx.rentalQuantityReservation.findMany.mockResolvedValue([]);
      mockTx.rentalOrderLine.findUnique.mockResolvedValue({ id: 'line-std-1', chargedDays: 4 });

      mockTx.rentalDocument = {
        findFirst: jest.fn().mockImplementation(({ where }: any) => {
          if (where.documentType === 'HANDOVER') {
            return Promise.resolve({ id: 'root-handover-1', orderId: 'order-mixed-cart', documentType: 'HANDOVER' });
          }
          return Promise.resolve(null);
        }),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'doc-appendix-1', documentNumber: 'TG-EXTENSION_APPENDIX-123' }),
        count: jest.fn().mockResolvedValue(0),
      };

      await applyExtensionWithTx(mockTx, 'ext-with-appendix', now);

      expect(mockTx.rentalDocument.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentType: 'EXTENSION_APPENDIX',
            rootDocumentId: 'root-handover-1',
            sourceRef: 'ext-with-appendix',
          }),
        }),
      );
    });

    it('Scenario 10: Extension APPLIED FAILS CLOSED and rolls back when root HANDOVER document is missing', async () => {
      const now = new Date('2026-10-24T10:00:00Z');
      const ext = {
        id: 'ext-no-root-doc',
        orderId: 'order-mixed-cart',
        status: RentalExtensionStatus.PENDING_PAYMENT,
        previousRentalEndAt: mixedOrder.rentalEndAt,
        requestedRentalEndAt: new Date('2026-10-26T18:00:00Z'),
        previousOccupiedUntil: mixedOrder.occupiedEndAt,
        requestedOccupiedUntil: new Date('2026-10-28T18:00:00Z'),
        returnOptionSnapshot: { id: 'RETURN_POINT_1', pointId: 'sp-1' },
        additionalFee: new Prisma.Decimal('0.00'), // Zero fee case
        currency: 'VND',
        holdExpiresAt: new Date('2026-10-24T10:15:00Z'),
        acceptedByUserId: 'user-1',
        acceptedAt: now,
        acceptedTermsVersion: 'v1.5.2',
        termsHash: 'e'.repeat(64),
        lines: [],
      };

      mockTx.rentalExtensionRequest.findUnique
        .mockResolvedValueOnce(ext)
        .mockResolvedValueOnce({ ...ext, status: RentalExtensionStatus.APPLIED, appliedAt: now });
      mockTx.rentalOrder.findUnique.mockResolvedValue(mixedOrder);
      mockTx.rentalQuantityReservation.findMany.mockResolvedValue([]);

      // Mock missing root HANDOVER document
      mockTx.rentalDocument.findFirst.mockResolvedValue(null);

      // SOT requirement: Must throw and NOT silently skip
      await expect(applyExtensionWithTx(mockTx, 'ext-no-root-doc', now)).rejects.toThrow(
        'HANDOVER_DOCUMENT_REQUIRED_FOR_APPENDIX',
      );
    });

    it('Scenario 11: Provider-confirmed paidAt before TTL applies extension even when worker processing occurs after TTL', async () => {
      const holdExpiresAt = new Date('2026-10-24T10:15:00Z');
      const providerPaidAt = new Date('2026-10-24T10:14:00Z'); // Paid on time at MoMo/VNPay!
      const workerProcessingTime = new Date('2026-10-24T10:20:00Z'); // Delayed worker processing!

      const ext = {
        id: 'ext-delayed-worker',
        orderId: 'order-mixed-cart',
        status: RentalExtensionStatus.PENDING_PAYMENT,
        previousRentalEndAt: mixedOrder.rentalEndAt,
        requestedRentalEndAt: new Date('2026-10-26T18:00:00Z'),
        previousOccupiedUntil: mixedOrder.occupiedEndAt,
        requestedOccupiedUntil: new Date('2026-10-28T18:00:00Z'),
        returnOptionSnapshot: { id: 'RETURN_POINT_1', pointId: 'sp-1' },
        additionalFee: new Prisma.Decimal('150000.00'),
        currency: 'VND',
        holdExpiresAt,
        invoiceId: 'inv-timely',
        paymentRef: 'pay-timely',
        acceptedByUserId: 'user-1',
        acceptedAt: providerPaidAt,
        acceptedTermsVersion: 'v1.5.2',
        termsHash: 'd'.repeat(64),
        lines: [{ orderLineId: 'line-std-1', newChargedDays: 6, additionalFee: new Prisma.Decimal('150000.00') }],
      };

      mockTx.rentalExtensionRequest.findUnique
        .mockResolvedValueOnce(ext) // in consumeExtensionPaymentWithTx
        .mockResolvedValueOnce(ext) // in applyExtensionWithTx
        .mockResolvedValueOnce({ ...ext, status: RentalExtensionStatus.APPLIED, appliedAt: workerProcessingTime }); // in issueExtensionAppendixTx

      mockTx.rentalOrder.findUnique.mockResolvedValue(mixedOrder);
      mockTx.rentalQuantityReservation.findMany.mockResolvedValue([]);
      mockTx.rentalOrderLine.findUnique.mockResolvedValue({ id: 'line-std-1', chargedDays: 4 });

      await consumeExtensionPaymentWithTx(
        mockTx,
        'ext-delayed-worker',
        {
          id: 'pay-timely',
          invoiceId: 'inv-timely',
          amount: new Prisma.Decimal('150000.00'),
          currency: 'VND',
          transactionRef: 'momo-tx-001',
          paidAt: providerPaidAt,
        },
        'SUCCEEDED',
        'provider-ref-001',
        workerProcessingTime,
      );

      // Extension MUST be APPLIED, NOT EXPIRED!
      expect(mockTx.rentalExtensionRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ext-delayed-worker' },
          data: expect.objectContaining({ status: RentalExtensionStatus.APPLIED }),
        }),
      );
      // Payment status SUCCEEDED with provider paidAt
      expect(mockTx.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentStatus.SUCCEEDED, paidAt: providerPaidAt }),
        }),
      );
    });

    it('Scenario 12: Genuinely late payment (paidAt > holdExpiresAt) releases hold and requests reversal without applying extension', async () => {
      const holdExpiresAt = new Date('2026-10-24T10:15:00Z');
      const latePaidAt = new Date('2026-10-24T10:20:00Z'); // Paid AFTER hold expired!
      const workerProcessingTime = new Date('2026-10-24T10:21:00Z');

      const ext = {
        id: 'ext-genuinely-late',
        orderId: 'order-mixed-cart',
        status: RentalExtensionStatus.PENDING_PAYMENT,
        previousOccupiedUntil: mixedOrder.occupiedEndAt,
        requestedOccupiedUntil: new Date('2026-10-28T18:00:00Z'),
        returnOptionSnapshot: { id: 'RETURN_POINT_1', pointId: 'sp-1' },
        additionalFee: new Prisma.Decimal('150000.00'),
        currency: 'VND',
        holdExpiresAt,
        invoiceId: 'inv-late',
        paymentRef: 'pay-late',
        lines: [{ orderLineId: 'line-std-1' }],
      };

      mockTx.rentalExtensionRequest.findUnique
        .mockResolvedValueOnce(ext)
        .mockResolvedValueOnce(ext);

      await consumeExtensionPaymentWithTx(
        mockTx,
        'ext-genuinely-late',
        {
          id: 'pay-late',
          invoiceId: 'inv-late',
          amount: new Prisma.Decimal('150000.00'),
          currency: 'VND',
          transactionRef: 'momo-late-tx',
          paidAt: latePaidAt,
        },
        'SUCCEEDED',
        'provider-ref-late',
        workerProcessingTime,
      );

      // Must be marked EXPIRED, NOT APPLIED
      expect(mockTx.rentalExtensionRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ext-genuinely-late' },
          data: expect.objectContaining({ status: RentalExtensionStatus.EXPIRED }),
        }),
      );
      // Must emit refund / reversal outbox events
      expect(mockTx.rentalOutboxEvent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ eventType: 'RENTAL_EXTENSION_REFUND_REQUIRED' }),
        }),
      );
    });

    it('Scenario 13: Expiry scheduler race - if extension is already EXPIRED before callback, payment is acknowledged but extension remains EXPIRED with HOLD_EXPIRED_BEFORE_PROCESSING reversal', async () => {
      const now = new Date('2026-10-24T10:25:00Z');
      const ext = {
        id: 'ext-already-expired',
        orderId: 'order-mixed-cart',
        status: RentalExtensionStatus.EXPIRED, // Scheduler already marked it EXPIRED!
        previousOccupiedUntil: mixedOrder.occupiedEndAt,
        requestedOccupiedUntil: new Date('2026-10-28T18:00:00Z'),
        additionalFee: new Prisma.Decimal('150000.00'),
        currency: 'VND',
        holdExpiresAt: new Date('2026-10-24T10:15:00Z'),
        invoiceId: 'inv-expired-race',
        paymentRef: 'pay-race',
        lines: [],
      };

      mockTx.rentalExtensionRequest.findUnique.mockResolvedValue(ext);

      const res = await consumeExtensionPaymentWithTx(
        mockTx,
        'ext-already-expired',
        {
          id: 'pay-race',
          invoiceId: 'inv-expired-race',
          amount: new Prisma.Decimal('150000.00'),
          currency: 'VND',
          transactionRef: 'tx-race',
          paidAt: new Date('2026-10-24T10:14:00Z'),
        },
        'SUCCEEDED',
        'provider-ref-race',
        now,
      );

      // Payment SUCCEEDED & Invoice PAID (never downgraded to FAILED)
      expect(mockTx.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentStatus.SUCCEEDED }),
        }),
      );
      // Extension must NOT be updated to APPLIED (no unsafe revival of released capacity)
      expect(mockTx.rentalExtensionRequest.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: RentalExtensionStatus.APPLIED }),
        }),
      );
      // Reversal reason must distinguish scheduler race from genuine late payment
      expect(mockTx.paymentOutboxEvent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            eventType: 'TECHNICAL_REVERSAL_REQUESTED',
            payload: expect.objectContaining({ reasonCode: 'HOLD_EXPIRED_BEFORE_PROCESSING' }),
          }),
        }),
      );
      expect(res).toEqual({ applied: false, reasonCode: 'HOLD_EXPIRED_BEFORE_PROCESSING' });
    });

    it('Scenario 14: Payment SUCCEEDED but missing provider paidAt preserves payment as SUCCEEDED, rejects application, and requests reversal', async () => {
      const now = new Date('2026-10-24T10:20:00Z');
      const ext = {
        id: 'ext-missing-paidat',
        orderId: 'order-mixed-cart',
        status: RentalExtensionStatus.PENDING_PAYMENT,
        previousOccupiedUntil: mixedOrder.occupiedEndAt,
        requestedOccupiedUntil: new Date('2026-10-28T18:00:00Z'),
        additionalFee: new Prisma.Decimal('100000.00'),
        currency: 'VND',
        holdExpiresAt: new Date('2026-10-24T10:15:00Z'),
        invoiceId: 'inv-no-paidat',
        paymentRef: 'pay-no-paidat',
        lines: [{ orderLineId: 'line-std-1' }],
      };

      mockTx.rentalExtensionRequest.findUnique
        .mockResolvedValueOnce(ext)
        .mockResolvedValueOnce(ext);

      const res = await consumeExtensionPaymentWithTx(
        mockTx,
        'ext-missing-paidat',
        {
          id: 'pay-no-paidat',
          invoiceId: 'inv-no-paidat',
          amount: new Prisma.Decimal('100000.00'),
          currency: 'VND',
          transactionRef: 'momo-ref-nopaidat',
          paidAt: null, // Missing timestamp from provider!
        },
        'SUCCEEDED',
        'provider-ref-nopaidat',
        now,
      );

      // SOT requirement: Payment status in ledger MUST NOT be overwritten to FAILED!
      expect(mockTx.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentStatus.SUCCEEDED }),
        }),
      );
      expect(mockTx.payment.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentStatus.FAILED }),
        }),
      );

      // Extension hold must be released and marked EXPIRED
      expect(mockTx.rentalExtensionRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ext-missing-paidat' },
          data: expect.objectContaining({ status: RentalExtensionStatus.EXPIRED }),
        }),
      );

      // Technical reversal requested with PAYMENT_TIMESTAMP_UNTRUSTED
      expect(mockTx.paymentOutboxEvent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            eventType: 'TECHNICAL_REVERSAL_REQUESTED',
            payload: expect.objectContaining({ reasonCode: 'PAYMENT_TIMESTAMP_UNTRUSTED' }),
          }),
        }),
      );
      expect(res).toEqual({ applied: false, reasonCode: 'PAYMENT_TIMESTAMP_UNTRUSTED' });
    });

    it('Scenario 15: Timely payment before rental due date applies extension even if worker arrives after original due date', async () => {
      // Original rental due is 18:00
      const originalDueAt = new Date('2026-10-24T18:00:00Z');
      const holdExpiresAt = new Date('2026-10-24T17:55:00Z');
      const providerPaidAt = new Date('2026-10-24T17:50:00Z'); // Paid 10 mins before due date!
      const workerProcessingTime = new Date('2026-10-24T18:15:00Z'); // Worker delayed 15 mins after due date!

      const orderBeforeDue = {
        ...mixedOrder,
        rentalEndAt: originalDueAt,
        operationalReturnDueAt: originalDueAt,
        status: RentalOrderStatus.ACTIVE,
      };

      const ext = {
        id: 'ext-worker-after-due',
        orderId: 'order-mixed-cart',
        status: RentalExtensionStatus.PENDING_PAYMENT,
        previousRentalEndAt: originalDueAt,
        requestedRentalEndAt: new Date('2026-10-26T18:00:00Z'),
        previousOccupiedUntil: mixedOrder.occupiedEndAt,
        requestedOccupiedUntil: new Date('2026-10-28T18:00:00Z'),
        returnOptionSnapshot: { id: 'RETURN_POINT_1', pointId: 'sp-1' },
        additionalFee: new Prisma.Decimal('150000.00'),
        currency: 'VND',
        holdExpiresAt,
        invoiceId: 'inv-after-due',
        paymentRef: 'pay-after-due',
        acceptedByUserId: 'user-1',
        acceptedAt: providerPaidAt,
        acceptedTermsVersion: 'v1.5.2',
        termsHash: 'f'.repeat(64),
        lines: [{ orderLineId: 'line-std-1', newChargedDays: 6, additionalFee: new Prisma.Decimal('150000.00') }],
      };

      mockTx.rentalExtensionRequest.findUnique
        .mockResolvedValueOnce(ext)
        .mockResolvedValueOnce(ext)
        .mockResolvedValueOnce({ ...ext, status: RentalExtensionStatus.APPLIED, appliedAt: workerProcessingTime });

      mockTx.rentalOrder.findUnique.mockResolvedValue(orderBeforeDue);
      mockTx.rentalQuantityReservation.findMany.mockResolvedValue([]);
      mockTx.rentalOrderLine.findUnique.mockResolvedValue({ id: 'line-std-1', chargedDays: 4 });

      const res = await consumeExtensionPaymentWithTx(
        mockTx,
        'ext-worker-after-due',
        {
          id: 'pay-after-due',
          invoiceId: 'inv-after-due',
          amount: new Prisma.Decimal('150000.00'),
          currency: 'VND',
          transactionRef: 'momo-tx-delayed-worker',
          paidAt: providerPaidAt,
        },
        'SUCCEEDED',
        'provider-ref-delayed',
        workerProcessingTime,
      );

      // Must be APPLIED because payment was made before cutoff/due date!
      expect(res).toEqual({ applied: true });
      expect(mockTx.rentalExtensionRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ext-worker-after-due' },
          data: expect.objectContaining({ status: RentalExtensionStatus.APPLIED }),
        }),
      );
      // Outbox event must include appendixDocumentId
      expect(mockTx.rentalOutboxEvent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            eventType: 'RENTAL_EXTENSION_APPLIED',
            payload: expect.objectContaining({
              appendixDocumentId: 'doc-appendix-1',
              extensionId: 'ext-worker-after-due',
            }),
          }),
        }),
      );
    });

    it('Scenario 16: Immutable appendix snapshot accurately records old/new effective operational due dates and quoteId', async () => {
      const now = new Date('2026-10-24T10:00:00Z');
      const priorOperationalDue = new Date('2026-10-25T18:00:00Z'); // Rescheduled earlier by Trip
      const requestedNewEnd = new Date('2026-10-27T18:00:00Z');

      const orderWithPriorReschedule = {
        ...mixedOrder,
        rentalEndAt: new Date('2026-10-24T18:00:00Z'),
        operationalReturnDueAt: priorOperationalDue,
      };

      const ext = {
        id: 'ext-snapshot-dates',
        orderId: 'order-mixed-cart',
        status: RentalExtensionStatus.PENDING_PAYMENT,
        previousRentalEndAt: orderWithPriorReschedule.rentalEndAt,
        requestedRentalEndAt: requestedNewEnd,
        previousOccupiedUntil: mixedOrder.occupiedEndAt,
        requestedOccupiedUntil: new Date('2026-10-29T18:00:00Z'),
        returnOptionSnapshot: { id: 'RETURN_POINT_1', pointId: 'sp-1' },
        additionalFee: new Prisma.Decimal('200000.00'),
        currency: 'VND',
        holdExpiresAt: new Date('2026-10-24T10:15:00Z'),
        acceptedByUserId: 'user-1',
        acceptedAt: now,
        acceptedTermsVersion: 'v1.5.2',
        termsHash: 'c'.repeat(64),
        lines: [],
      };

      mockTx.rentalExtensionRequest.findUnique
        .mockResolvedValueOnce(ext)
        .mockResolvedValueOnce({ ...ext, status: RentalExtensionStatus.APPLIED, appliedAt: now });
      mockTx.rentalOrder.findUnique.mockResolvedValue(orderWithPriorReschedule);
      mockTx.rentalQuantityReservation.findMany.mockResolvedValue([]);

      await applyExtensionWithTx(mockTx, 'ext-snapshot-dates', now);

      // Verify created document snapshot
      expect(mockTx.rentalDocument.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            snapshotJson: expect.objectContaining({
              oldEffectiveOperationalDueAt: priorOperationalDue.toISOString(),
              newEffectiveOperationalDueAt: requestedNewEnd.toISOString(),
              acceptance: expect.objectContaining({
                quoteId: 'ext-snapshot-dates',
              }),
            }),
          }),
        }),
      );
    });

    it('Scenario 17: Duplicate payment callback on already APPLIED extension is idempotent and creates no new appendix or refund', async () => {
      const now = new Date('2026-10-24T10:30:00Z');
      const ext = {
        id: 'ext-already-applied',
        orderId: 'order-mixed-cart',
        status: RentalExtensionStatus.APPLIED, // Already APPLIED!
        appliedAt: new Date('2026-10-24T10:10:00Z'),
        additionalFee: new Prisma.Decimal('150000.00'),
        currency: 'VND',
        invoiceId: 'inv-duplicate',
        paymentRef: 'pay-duplicate',
        lines: [],
      };

      mockTx.rentalExtensionRequest.findUnique.mockResolvedValue(ext);

      const res = await consumeExtensionPaymentWithTx(
        mockTx,
        'ext-already-applied',
        {
          id: 'pay-duplicate',
          invoiceId: 'inv-duplicate',
          amount: new Prisma.Decimal('150000.00'),
          currency: 'VND',
          transactionRef: 'momo-duplicate-ref',
          paidAt: new Date('2026-10-24T10:05:00Z'),
        },
        'SUCCEEDED',
        'provider-ref-dup',
        now,
      );

      // Idempotency: Returns applied: true immediately
      expect(res).toEqual({ applied: true });
      // Must NOT update extension or order again
      expect(mockTx.rentalExtensionRequest.update).not.toHaveBeenCalled();
      expect(mockTx.rentalOrder.update).not.toHaveBeenCalled();
      // Must NOT issue a second document
      expect(mockTx.rentalDocument.create).not.toHaveBeenCalled();
      // Must NOT emit refund
      expect(mockTx.rentalOutboxEvent.upsert).not.toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ eventType: 'RENTAL_EXTENSION_REFUND_REQUIRED' }),
        }),
      );
    });
  });
});
