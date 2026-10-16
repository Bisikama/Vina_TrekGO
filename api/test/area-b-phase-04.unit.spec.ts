import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { rentalComponents, validateRentalAllocations } from 'src/modules/rental/payments/rental-payment.rules';
import { AppError } from 'src/shared/errors/app-error';
import { RentalPaymentConsumer } from 'src/modules/rental/payments/rental-payment.consumer';
import { PrismaService } from 'src/shared/services/prisma.service';

describe('Phase 04_PAYMENT Unit Tests', () => {
  describe('rentalComponents', () => {
    it('should split line amount into RENTAL_FEE and RENTAL_DEPOSIT', () => {
      const order = {
        id: 'order-1',
        currency: 'VND',
        totalAmount: new Prisma.Decimal(300),
        rentalFee: new Prisma.Decimal(200),
        totalDeposit: new Prisma.Decimal(100),
      } as any;
      const lines = [
        {
          id: 'line-1',
          orderId: 'order-1',
          quantity: 2,
          chargedDays: 2,
          dailyPriceSnapshot: new Prisma.Decimal(50), // 2 * 2 * 50 = 200 fee
          depositPerUnitSnapshot: new Prisma.Decimal(50), // 2 * 50 = 100 deposit
          lineRentalFee: new Prisma.Decimal(200),
          lineDeposit: new Prisma.Decimal(100),
        } as any,
      ];

      const components = rentalComponents(order, lines);
      expect(components).toHaveLength(2);
      expect(components.find(c => c.component === 'RENTAL_FEE')?.amount.toString()).toBe('200');
      expect(components.find(c => c.component === 'RENTAL_DEPOSIT')?.amount.toString()).toBe('100');
    });

    it('should throw PAYMENT_AMOUNT_MISMATCH if total mismatch', () => {
      const order = {
        id: 'order-1',
        currency: 'VND',
        totalAmount: new Prisma.Decimal(500), // Mismatch! (should be 300)
        rentalFee: new Prisma.Decimal(200),
        totalDeposit: new Prisma.Decimal(100),
      } as any;
      const lines = [
        {
          id: 'line-1',
          orderId: 'order-1',
          quantity: 2,
          chargedDays: 2,
          dailyPriceSnapshot: new Prisma.Decimal(50),
          depositPerUnitSnapshot: new Prisma.Decimal(50),
          lineRentalFee: new Prisma.Decimal(200),
          lineDeposit: new Prisma.Decimal(100),
        } as any,
      ];

      expect(() => rentalComponents(order, lines)).toThrow('PAYMENT_AMOUNT_MISMATCH');
    });
  });

  describe('Consumer Late Payment vs Capacity rules', () => {
    let consumer: RentalPaymentConsumer;
    let mockPrisma: any;

    beforeEach(async () => {
      process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID = '11111111-1111-4111-8111-111111111111';
      mockPrisma = {
        $transaction: jest.fn(cb => cb(mockPrisma)),
        $queryRaw: jest.fn().mockImplementation((query) => {
          if (query[0].includes('clock_timestamp')) return [{ now: new Date('2023-01-01T12:00:00Z') }];
          return [{ id: 'mock-id' }];
        }),
        paymentOutboxEvent: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn(), update: jest.fn(), upsert: jest.fn() },
        payment: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
        rentalOrder: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
        rentalQuote: { findUnique: jest.fn().mockResolvedValue({ policySnapshot: { primaryRentalInventoryLocationId: '11111111-1111-4111-8111-111111111111' } }) },
        paymentConsumerReceipt: { findUnique: jest.fn(), create: jest.fn() },
        paymentApplication: { findFirst: jest.fn(), update: jest.fn() },
        rentalExtensionRequest: { findFirst: jest.fn() },
        tripMember: { findUnique: jest.fn().mockResolvedValue({ id: 'member-1', status: 'ACTIVE', trip: { status: 'CONFIRMED' } }) },
        inventoryLocation: {
          findMany: jest.fn().mockResolvedValue([{ id: '11111111-1111-4111-8111-111111111111' }]),
          findUnique: jest.fn().mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111', status: 'ACTIVE' }),
        },
        inventoryTask: { findUnique: jest.fn(), create: jest.fn() },
        invoice: { update: jest.fn() },
        rentalQuantityReservation: { updateMany: jest.fn() },
        rentalOutboxEvent: { create: jest.fn() },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RentalPaymentConsumer,
          { provide: PrismaService, useValue: mockPrisma },
        ],
      }).compile();

      consumer = module.get<RentalPaymentConsumer>(RentalPaymentConsumer);
    });

    it('should classify as LATE_PAYMENT if paidAt is after paymentExpiresAt', async () => {
      mockPrisma.paymentOutboxEvent.findUnique.mockResolvedValue({ id: 'event-1', eventType: 'PAYMENT_SUCCEEDED', aggregateType: 'Payment' });
      mockPrisma.paymentOutboxEvent.findUniqueOrThrow.mockResolvedValue({ id: 'event-1', payload: { schemaVersion: 1, paymentId: 'pay-1', invoiceId: 'inv-1' } });
      mockPrisma.payment.findUnique.mockResolvedValue({ id: 'pay-1', invoiceId: 'inv-1', invoice: { invoiceType: 'RENTAL', rentalOrder: { id: 'order-1', tripId: 'trip-1', bookingId: 'booking-1' } } });
      
      const paidAt = new Date('2023-01-01T10:10:00Z');
      const paymentExpiresAt = new Date('2023-01-01T10:00:00Z'); // Expired!

      mockPrisma.payment.findUniqueOrThrow.mockResolvedValue({
        id: 'pay-1', invoiceId: 'inv-1', status: 'SUCCEEDED', paidAt, reconcileStatus: 'SCHEDULED', currency: 'VND', amount: new Prisma.Decimal(300),
        application: { invoiceId: 'inv-1', status: 'PENDING' },
        invoice: { rentalOrderId: 'order-1', status: 'PENDING_PAYMENT', userId: 'user-1', currency: 'VND', totalAmount: new Prisma.Decimal(300), expiresAt: paymentExpiresAt },
        allocations: [{ component: 'RENTAL_FEE', amount: new Prisma.Decimal(200), rentalOrderLineId: 'line-1' }, { component: 'RENTAL_DEPOSIT', amount: new Prisma.Decimal(100), rentalOrderLineId: 'line-1' }]
      });

      mockPrisma.rentalOrder.findUniqueOrThrow.mockResolvedValue({
        id: 'order-1', tripId: 'trip-1', bookingId: 'booking-1', userId: 'user-1', status: 'PENDING_PAYMENT', financialStatus: 'PAYMENT_PENDING', currency: 'VND',
        totalAmount: new Prisma.Decimal(300), rentalFee: new Prisma.Decimal(200), totalDeposit: new Prisma.Decimal(100),
        paymentExpiresAt,
        plannedHandoverAt: new Date('2023-01-01T12:00:00Z'),
        plannedReturnAt: new Date('2023-01-02T12:00:00Z'),
        policySnapshot: { prepBufferMinutes: 720, returnBufferMinutes: 1440, cleaningBufferMinutes: 1440, deepInspectionBufferMinutes: 2880 },
        quote: {
          rentalQuoteLinesViaQuoteId: [
            { productId: 'prod-1', occupiedFrom: new Date('2023-01-01T00:00:00Z'), occupiedUntil: new Date('2023-01-03T12:00:00Z') }
          ]
        },
        rentalOrderLinesViaOrderId: [{
          id: 'line-1', orderId: 'order-1', quantity: 2, chargedDays: 2, productId: 'prod-1',
          dailyPriceSnapshot: new Prisma.Decimal(50), depositPerUnitSnapshot: new Prisma.Decimal(50), lineRentalFee: new Prisma.Decimal(200), lineDeposit: new Prisma.Decimal(100),
          rentalQuantityReservationsViaOrderLineId: [{ status: 'HELD', productId: 'prod-1', quantity: 2, holdExpiresAt: new Date('2023-01-02T00:00:00Z'), occupiedFrom: new Date('2023-01-01T00:00:00Z'), occupiedUntil: new Date('2023-01-03T12:00:00Z') }]
        }]
      });

      await consumer.consume('event-1');
      
      expect(mockPrisma.paymentApplication.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'REJECTED', reasonCode: 'LATE_PAYMENT' })
      }));
      expect(mockPrisma.paymentOutboxEvent.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ eventType: 'TECHNICAL_REVERSAL_REQUESTED' })
      }));
    });

    it('should NOT classify as LATE_PAYMENT if paidAt <= paymentExpiresAt but worker runs later', async () => {
      mockPrisma.paymentOutboxEvent.findUnique.mockResolvedValue({ id: 'event-1', eventType: 'PAYMENT_SUCCEEDED', aggregateType: 'Payment' });
      mockPrisma.paymentOutboxEvent.findUniqueOrThrow.mockResolvedValue({ id: 'event-1', payload: { schemaVersion: 1, paymentId: 'pay-1', invoiceId: 'inv-1' } });
      mockPrisma.payment.findUnique.mockResolvedValue({ id: 'pay-1', invoiceId: 'inv-1', invoice: { invoiceType: 'RENTAL', rentalOrder: { id: 'order-1', tripId: 'trip-1', bookingId: 'booking-1' } } });
      
      const paidAt = new Date('2023-01-01T09:50:00Z');
      const paymentExpiresAt = new Date('2023-01-01T10:00:00Z');
      mockPrisma.$queryRaw.mockImplementation((query) => {
        if (query[0].includes('clock_timestamp')) return [{ now: new Date('2023-01-01T10:10:00Z') }];
        return [{ id: 'mock-id' }];
      });

      mockPrisma.payment.findUniqueOrThrow.mockResolvedValue({
        id: 'pay-1', invoiceId: 'inv-1', status: 'SUCCEEDED', paidAt, reconcileStatus: 'SCHEDULED', currency: 'VND', amount: new Prisma.Decimal(300),
        application: { invoiceId: 'inv-1', status: 'PENDING' },
        invoice: { rentalOrderId: 'order-1', status: 'PENDING_PAYMENT', userId: 'user-1', currency: 'VND', totalAmount: new Prisma.Decimal(300), expiresAt: paymentExpiresAt },
        allocations: [{ component: 'RENTAL_FEE', amount: new Prisma.Decimal(200), rentalOrderLineId: 'line-1' }, { component: 'RENTAL_DEPOSIT', amount: new Prisma.Decimal(100), rentalOrderLineId: 'line-1' }]
      });

      mockPrisma.rentalOrder.findUniqueOrThrow.mockResolvedValue({
        id: 'order-1', tripId: 'trip-1', bookingId: 'booking-1', userId: 'user-1', status: 'PENDING_PAYMENT', financialStatus: 'PAYMENT_PENDING', currency: 'VND',
        totalAmount: new Prisma.Decimal(300), rentalFee: new Prisma.Decimal(200), totalDeposit: new Prisma.Decimal(100),
        paymentExpiresAt,
        plannedHandoverAt: new Date('2023-01-01T12:00:00Z'),
        plannedReturnAt: new Date('2023-01-02T12:00:00Z'),
        policySnapshot: { prepBufferMinutes: 720, returnBufferMinutes: 1440, cleaningBufferMinutes: 1440, deepInspectionBufferMinutes: 2880 },
        quote: {
          rentalQuoteLinesViaQuoteId: [
            { productId: 'prod-1', occupiedFrom: new Date('2023-01-01T00:00:00Z'), occupiedUntil: new Date('2023-01-03T12:00:00Z') }
          ]
        },
        rentalOrderLinesViaOrderId: [{
          id: 'line-1', orderId: 'order-1', quantity: 2, chargedDays: 2, productId: 'prod-1',
          dailyPriceSnapshot: new Prisma.Decimal(50), depositPerUnitSnapshot: new Prisma.Decimal(50), lineRentalFee: new Prisma.Decimal(200), lineDeposit: new Prisma.Decimal(100),
          rentalQuantityReservationsViaOrderLineId: [{ status: 'HELD', productId: 'prod-1', quantity: 2, holdExpiresAt: new Date('2023-01-02T00:00:00Z'), occupiedFrom: new Date('2023-01-01T00:00:00Z'), occupiedUntil: new Date('2023-01-03T12:00:00Z') }]
        }]
      });

      await consumer.consume('event-1');
      
      expect(mockPrisma.paymentApplication.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'APPLIED' })
      }));
      expect(mockPrisma.rentalOrder.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'PAID' })
      }));
    });

    it('should reject payment if paidAt is missing or untrusted (PAYMENT_TIMESTAMP_UNTRUSTED)', async () => {
      mockPrisma.paymentOutboxEvent.findUnique.mockResolvedValue({ id: 'event-1', eventType: 'PAYMENT_SUCCEEDED', aggregateType: 'Payment' });
      mockPrisma.paymentOutboxEvent.findUniqueOrThrow.mockResolvedValue({ id: 'event-1', payload: { schemaVersion: 1, paymentId: 'pay-1', invoiceId: 'inv-1' } });
      mockPrisma.payment.findUnique.mockResolvedValue({ id: 'pay-1', invoiceId: 'inv-1', invoice: { invoiceType: 'RENTAL', rentalOrder: { id: 'order-1', tripId: 'trip-1', bookingId: 'booking-1' } } });
      
      mockPrisma.payment.findUniqueOrThrow.mockResolvedValue({
        id: 'pay-1', invoiceId: 'inv-1', status: 'SUCCEEDED', paidAt: null, reconcileStatus: 'SCHEDULED', currency: 'VND', amount: new Prisma.Decimal(300),
        application: { invoiceId: 'inv-1', status: 'PENDING' },
        invoice: { rentalOrderId: 'order-1', status: 'PENDING_PAYMENT', userId: 'user-1', currency: 'VND', totalAmount: new Prisma.Decimal(300), expiresAt: new Date('2023-01-01T10:00:00Z') },
        allocations: [{ component: 'RENTAL_FEE', amount: new Prisma.Decimal(200), rentalOrderLineId: 'line-1' }, { component: 'RENTAL_DEPOSIT', amount: new Prisma.Decimal(100), rentalOrderLineId: 'line-1' }]
      });

      mockPrisma.rentalOrder.findUniqueOrThrow.mockResolvedValue({
        id: 'order-1', tripId: 'trip-1', bookingId: 'booking-1', userId: 'user-1', status: 'PENDING_PAYMENT', financialStatus: 'PAYMENT_PENDING', currency: 'VND',
        totalAmount: new Prisma.Decimal(300), rentalFee: new Prisma.Decimal(200), totalDeposit: new Prisma.Decimal(100),
        paymentExpiresAt: new Date('2023-01-01T10:00:00Z'),
        rentalOrderLinesViaOrderId: [{
          id: 'line-1', orderId: 'order-1', quantity: 2, chargedDays: 2, productId: 'prod-1',
          dailyPriceSnapshot: new Prisma.Decimal(50), depositPerUnitSnapshot: new Prisma.Decimal(50), lineRentalFee: new Prisma.Decimal(200), lineDeposit: new Prisma.Decimal(100),
          rentalQuantityReservationsViaOrderLineId: [{ status: 'HELD', productId: 'prod-1', quantity: 2, holdExpiresAt: new Date('2023-01-02T00:00:00Z'), occupiedFrom: new Date('2023-01-01T00:00:00Z'), occupiedUntil: new Date('2023-01-03T12:00:00Z') }]
        }]
      });

      await consumer.consume('event-1');
      
      expect(mockPrisma.paymentApplication.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'REJECTED', reasonCode: 'PAYMENT_TIMESTAMP_UNTRUSTED' })
      }));
      expect(mockPrisma.paymentOutboxEvent.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ eventType: 'TECHNICAL_REVERSAL_REQUESTED' })
      }));
    });

    it('should NOT resurrect order if order is EXPIRED or reservation was already RELEASED', async () => {
      mockPrisma.paymentOutboxEvent.findUnique.mockResolvedValue({ id: 'event-1', eventType: 'PAYMENT_SUCCEEDED', aggregateType: 'Payment' });
      mockPrisma.paymentOutboxEvent.findUniqueOrThrow.mockResolvedValue({ id: 'event-1', payload: { schemaVersion: 1, paymentId: 'pay-1', invoiceId: 'inv-1' } });
      mockPrisma.payment.findUnique.mockResolvedValue({ id: 'pay-1', invoiceId: 'inv-1', invoice: { invoiceType: 'RENTAL', rentalOrder: { id: 'order-1', tripId: 'trip-1', bookingId: 'booking-1' } } });
      
      // paidAt was technically before TTL, but order is already EXPIRED and reservation is RELEASED
      const paidAt = new Date('2023-01-01T09:50:00Z');
      const paymentExpiresAt = new Date('2023-01-01T10:00:00Z');

      mockPrisma.payment.findUniqueOrThrow.mockResolvedValue({
        id: 'pay-1', invoiceId: 'inv-1', status: 'SUCCEEDED', paidAt, reconcileStatus: 'SCHEDULED', currency: 'VND', amount: new Prisma.Decimal(300),
        application: { invoiceId: 'inv-1', status: 'PENDING' },
        invoice: { rentalOrderId: 'order-1', status: 'PENDING_PAYMENT', userId: 'user-1', currency: 'VND', totalAmount: new Prisma.Decimal(300), expiresAt: paymentExpiresAt },
        allocations: [{ component: 'RENTAL_FEE', amount: new Prisma.Decimal(200), rentalOrderLineId: 'line-1' }, { component: 'RENTAL_DEPOSIT', amount: new Prisma.Decimal(100), rentalOrderLineId: 'line-1' }]
      });

      mockPrisma.rentalOrder.findUniqueOrThrow.mockResolvedValue({
        id: 'order-1', tripId: 'trip-1', bookingId: 'booking-1', userId: 'user-1', status: 'EXPIRED', financialStatus: 'PAYMENT_PENDING', currency: 'VND',
        totalAmount: new Prisma.Decimal(300), rentalFee: new Prisma.Decimal(200), totalDeposit: new Prisma.Decimal(100),
        paymentExpiresAt,
        rentalOrderLinesViaOrderId: [{
          id: 'line-1', orderId: 'order-1', quantity: 2, chargedDays: 2, productId: 'prod-1',
          dailyPriceSnapshot: new Prisma.Decimal(50), depositPerUnitSnapshot: new Prisma.Decimal(50), lineRentalFee: new Prisma.Decimal(200), lineDeposit: new Prisma.Decimal(100),
          rentalQuantityReservationsViaOrderLineId: [{ status: 'RELEASED', productId: 'prod-1', quantity: 2, holdExpiresAt: paymentExpiresAt, occupiedFrom: new Date('2023-01-01T00:00:00Z'), occupiedUntil: new Date('2023-01-03T12:00:00Z') }]
        }]
      });

      await consumer.consume('event-1');
      
      expect(mockPrisma.paymentApplication.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'REJECTED' })
      }));
      expect(mockPrisma.rentalOrder.update).not.toHaveBeenCalled();
    });

    it('should verify multi-product order with different occupied windows (24h vs 48h turnaround) and reject shortened reservations', async () => {
      mockPrisma.paymentOutboxEvent.findUnique.mockResolvedValue({ id: 'event-1', eventType: 'PAYMENT_SUCCEEDED', aggregateType: 'Payment' });
      mockPrisma.paymentOutboxEvent.findUniqueOrThrow.mockResolvedValue({ id: 'event-1', payload: { schemaVersion: 1, paymentId: 'pay-1', invoiceId: 'inv-1' } });
      mockPrisma.payment.findUnique.mockResolvedValue({ id: 'pay-1', invoiceId: 'inv-1', invoice: { invoiceType: 'RENTAL', rentalOrder: { id: 'order-1', tripId: 'trip-1', bookingId: 'booking-1' } } });
      
      const paidAt = new Date('2023-01-01T09:50:00Z');
      const paymentExpiresAt = new Date('2023-01-01T10:00:00Z');

      mockPrisma.payment.findUniqueOrThrow.mockResolvedValue({
        id: 'pay-1', invoiceId: 'inv-1', status: 'SUCCEEDED', paidAt, reconcileStatus: 'SCHEDULED', currency: 'VND', amount: new Prisma.Decimal(600),
        application: { invoiceId: 'inv-1', status: 'PENDING' },
        invoice: { rentalOrderId: 'order-1', status: 'PENDING_PAYMENT', userId: 'user-1', currency: 'VND', totalAmount: new Prisma.Decimal(600), expiresAt: paymentExpiresAt },
        allocations: [
          { component: 'RENTAL_FEE', amount: new Prisma.Decimal(200), rentalOrderLineId: 'line-1' },
          { component: 'RENTAL_DEPOSIT', amount: new Prisma.Decimal(100), rentalOrderLineId: 'line-1' },
          { component: 'RENTAL_FEE', amount: new Prisma.Decimal(200), rentalOrderLineId: 'line-2' },
          { component: 'RENTAL_DEPOSIT', amount: new Prisma.Decimal(100), rentalOrderLineId: 'line-2' },
        ]
      });

      // Product 1: standard 24h turnaround (until Jan 3 12:00)
      // Product 2: deep inspection 48h turnaround (until Jan 4 12:00)
      // BUT Product 2 reservation was shortened to Jan 3 12:00 (only 24h)!
      mockPrisma.rentalOrder.findUniqueOrThrow.mockResolvedValue({
        id: 'order-1', tripId: 'trip-1', bookingId: 'booking-1', userId: 'user-1', status: 'PENDING_PAYMENT', financialStatus: 'PAYMENT_PENDING', currency: 'VND',
        totalAmount: new Prisma.Decimal(600), rentalFee: new Prisma.Decimal(400), totalDeposit: new Prisma.Decimal(200),
        paymentExpiresAt,
        plannedHandoverAt: new Date('2023-01-01T12:00:00Z'),
        plannedReturnAt: new Date('2023-01-02T12:00:00Z'),
        policySnapshot: { prepBufferMinutes: 720, returnBufferMinutes: 1440, cleaningBufferMinutes: 1440, deepInspectionBufferMinutes: 2880 },
        quote: {
          rentalQuoteLinesViaQuoteId: [
            { productId: 'prod-std', occupiedFrom: new Date('2023-01-01T00:00:00Z'), occupiedUntil: new Date('2023-01-03T12:00:00Z') }, // 24h
            { productId: 'prod-deep', occupiedFrom: new Date('2023-01-01T00:00:00Z'), occupiedUntil: new Date('2023-01-04T12:00:00Z') }  // 48h
          ]
        },
        rentalOrderLinesViaOrderId: [
          {
            id: 'line-1', orderId: 'order-1', quantity: 1, chargedDays: 2, productId: 'prod-std',
            product: { id: 'prod-std', requiresDeepReturnInspection: false },
            dailyPriceSnapshot: new Prisma.Decimal(100), depositPerUnitSnapshot: new Prisma.Decimal(100), lineRentalFee: new Prisma.Decimal(200), lineDeposit: new Prisma.Decimal(100),
            rentalQuantityReservationsViaOrderLineId: [{ status: 'HELD', productId: 'prod-std', quantity: 1, holdExpiresAt: new Date('2023-01-02T00:00:00Z'), occupiedFrom: new Date('2023-01-01T00:00:00Z'), occupiedUntil: new Date('2023-01-03T12:00:00Z') }]
          },
          {
            id: 'line-2', orderId: 'order-1', quantity: 1, chargedDays: 2, productId: 'prod-deep',
            product: { id: 'prod-deep', requiresDeepReturnInspection: true },
            dailyPriceSnapshot: new Prisma.Decimal(100), depositPerUnitSnapshot: new Prisma.Decimal(100), lineRentalFee: new Prisma.Decimal(200), lineDeposit: new Prisma.Decimal(100),
            // Shortened to Jan 3 12:00! Does NOT cover required Jan 4 12:00!
            rentalQuantityReservationsViaOrderLineId: [{ status: 'HELD', productId: 'prod-deep', quantity: 1, holdExpiresAt: new Date('2023-01-02T00:00:00Z'), occupiedFrom: new Date('2023-01-01T00:00:00Z'), occupiedUntil: new Date('2023-01-03T12:00:00Z') }]
          }
        ]
      });

      await consumer.consume('event-1');
      
      // Must be REJECTED with DOMAIN_NOT_ELIGIBLE because reservation was shortened!
      expect(mockPrisma.paymentApplication.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'REJECTED', reasonCode: 'DOMAIN_NOT_ELIGIBLE' })
      }));
      expect(mockPrisma.rentalOrder.update).not.toHaveBeenCalled();
    });

    it('should fail closed with DOMAIN_NOT_ELIGIBLE and request technical reversal when quote line lacks occupied window and policy snapshot is missing or invalid', async () => {
      mockPrisma.paymentOutboxEvent.findUnique.mockResolvedValue({ id: 'event-1', eventType: 'PAYMENT_SUCCEEDED', aggregateType: 'Payment' });
      mockPrisma.paymentOutboxEvent.findUniqueOrThrow.mockResolvedValue({ id: 'event-1', payload: { schemaVersion: 1, paymentId: 'pay-1', invoiceId: 'inv-1' } });
      mockPrisma.payment.findUnique.mockResolvedValue({ id: 'pay-1', invoiceId: 'inv-1', invoice: { invoiceType: 'RENTAL', rentalOrder: { id: 'order-1', tripId: 'trip-1', bookingId: 'booking-1' } } });
      
      const paidAt = new Date('2023-01-01T09:50:00Z');
      const paymentExpiresAt = new Date('2023-01-01T10:00:00Z');

      mockPrisma.payment.findUniqueOrThrow.mockResolvedValue({
        id: 'pay-1', invoiceId: 'inv-1', status: 'SUCCEEDED', paidAt, reconcileStatus: 'SCHEDULED', currency: 'VND', amount: new Prisma.Decimal(300),
        application: { invoiceId: 'inv-1', status: 'PENDING' },
        invoice: { rentalOrderId: 'order-1', status: 'PENDING_PAYMENT', userId: 'user-1', currency: 'VND', totalAmount: new Prisma.Decimal(300), expiresAt: paymentExpiresAt },
        allocations: [{ component: 'RENTAL_FEE', amount: new Prisma.Decimal(200), rentalOrderLineId: 'line-1' }, { component: 'RENTAL_DEPOSIT', amount: new Prisma.Decimal(100), rentalOrderLineId: 'line-1' }]
      });

      // quoteLine has NO occupiedFrom/occupiedUntil, and policySnapshot is INVALID (empty object, no buffer definitions)
      mockPrisma.rentalOrder.findUniqueOrThrow.mockResolvedValue({
        id: 'order-1', tripId: 'trip-1', bookingId: 'booking-1', userId: 'user-1', status: 'PENDING_PAYMENT', financialStatus: 'PAYMENT_PENDING', currency: 'VND',
        totalAmount: new Prisma.Decimal(300), rentalFee: new Prisma.Decimal(200), totalDeposit: new Prisma.Decimal(100),
        paymentExpiresAt,
        plannedHandoverAt: new Date('2023-01-01T12:00:00Z'),
        plannedReturnAt: new Date('2023-01-03T12:00:00Z'),
        policySnapshot: null, // MISSING SNAPSHOT!
        quote: {
          rentalQuoteLinesViaQuoteId: [
            { productId: 'prod-1', occupiedFrom: null, occupiedUntil: null } // MISSING WINDOW!
          ]
        },
        rentalOrderLinesViaOrderId: [{
          id: 'line-1', orderId: 'order-1', quantity: 1, chargedDays: 2, productId: 'prod-1',
          product: { id: 'prod-1', requiresDeepReturnInspection: false },
          dailyPriceSnapshot: new Prisma.Decimal(100), depositPerUnitSnapshot: new Prisma.Decimal(100), lineRentalFee: new Prisma.Decimal(200), lineDeposit: new Prisma.Decimal(100),
          rentalQuantityReservationsViaOrderLineId: [{ status: 'HELD', productId: 'prod-1', quantity: 1, holdExpiresAt: new Date('2023-01-02T00:00:00Z'), occupiedFrom: new Date('2023-01-01T00:00:00Z'), occupiedUntil: new Date('2023-01-04T12:00:00Z') }]
        }]
      });

      await consumer.consume('event-1');
      
      // Must be REJECTED with DOMAIN_NOT_ELIGIBLE and trigger technical reversal
      expect(mockPrisma.paymentApplication.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'REJECTED', reasonCode: 'DOMAIN_NOT_ELIGIBLE' })
      }));
      expect(mockPrisma.paymentOutboxEvent.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'TECHNICAL_REVERSAL_REQUESTED',
          payload: expect.objectContaining({ reasonCode: 'DOMAIN_NOT_ELIGIBLE' })
        })
      }));
      expect(mockPrisma.rentalOrder.update).not.toHaveBeenCalled();
    });
  });
});
