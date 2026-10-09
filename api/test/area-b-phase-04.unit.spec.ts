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
      mockPrisma = {
        $transaction: jest.fn(cb => cb(mockPrisma)),
        $queryRaw: jest.fn().mockImplementation((query) => {
          if (query[0].includes('clock_timestamp')) return [{ now: new Date('2023-01-01T12:00:00Z') }];
          return [{ id: 'mock-id' }];
        }),
        paymentOutboxEvent: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn(), update: jest.fn(), upsert: jest.fn() },
        payment: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
        rentalOrder: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
        paymentConsumerReceipt: { findUnique: jest.fn(), create: jest.fn() },
        paymentApplication: { findFirst: jest.fn(), update: jest.fn() },
        rentalExtensionRequest: { findFirst: jest.fn() },
        tripMember: { findUnique: jest.fn().mockResolvedValue({ id: 'member-1', status: 'ACTIVE', trip: { status: 'CONFIRMED' } }) },
        inventoryLocation: { findMany: jest.fn().mockResolvedValue([{ id: 'loc-1' }]) },
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
      // Setup mock data where paidAt > paymentExpiresAt
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
        rentalOrderLinesViaOrderId: [{
          id: 'line-1', orderId: 'order-1', quantity: 2, chargedDays: 2,
          dailyPriceSnapshot: new Prisma.Decimal(50), depositPerUnitSnapshot: new Prisma.Decimal(50), lineRentalFee: new Prisma.Decimal(200), lineDeposit: new Prisma.Decimal(100),
          rentalQuantityReservationsViaOrderLineId: [{ status: 'HELD', quantity: 2, holdExpiresAt: new Date('2023-01-02T00:00:00Z'), occupiedFrom: new Date(), occupiedUntil: new Date() }]
        }]
      });

      // Avoid testing full integration here, just check that it calls paymentApplication.update with REJECTED and LATE_PAYMENT
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
      mockPrisma.$queryRaw.mockResolvedValue([{ now: new Date('2023-01-01T10:10:00Z') }]); // Worker runs 10 mins late!

      mockPrisma.payment.findUniqueOrThrow.mockResolvedValue({
        id: 'pay-1', invoiceId: 'inv-1', status: 'SUCCEEDED', paidAt, reconcileStatus: 'SCHEDULED', currency: 'VND', amount: new Prisma.Decimal(300),
        application: { invoiceId: 'inv-1', status: 'PENDING' },
        invoice: { rentalOrderId: 'order-1', status: 'PENDING_PAYMENT', userId: 'user-1', currency: 'VND', totalAmount: new Prisma.Decimal(300), expiresAt: paymentExpiresAt },
        allocations: [{ component: 'RENTAL_FEE', amount: new Prisma.Decimal(200), rentalOrderLineId: 'line-1' }, { component: 'RENTAL_DEPOSIT', amount: new Prisma.Decimal(100), rentalOrderLineId: 'line-1' }]
      });

      mockPrisma.rentalOrder.findUniqueOrThrow.mockResolvedValue({
        id: 'order-1', tripId: 'trip-1', bookingId: 'booking-1', userId: 'user-1', status: 'PENDING_PAYMENT', financialStatus: 'PAYMENT_PENDING', currency: 'VND',
        totalAmount: new Prisma.Decimal(300), rentalFee: new Prisma.Decimal(200), totalDeposit: new Prisma.Decimal(100),
        paymentExpiresAt, occupiedStartAt: new Date('2023-01-01T00:00:00Z'), occupiedEndAt: new Date('2023-01-02T00:00:00Z'),
        rentalOrderLinesViaOrderId: [{
          id: 'line-1', orderId: 'order-1', quantity: 2, chargedDays: 2, productId: 'prod-1',
          dailyPriceSnapshot: new Prisma.Decimal(50), depositPerUnitSnapshot: new Prisma.Decimal(50), lineRentalFee: new Prisma.Decimal(200), lineDeposit: new Prisma.Decimal(100),
          rentalQuantityReservationsViaOrderLineId: [{ status: 'HELD', productId: 'prod-1', quantity: 2, holdExpiresAt: new Date('2023-01-02T00:00:00Z'), occupiedFrom: new Date('2023-01-01T00:00:00Z'), occupiedUntil: new Date('2023-01-02T00:00:00Z') }]
        }]
      });

      // Member eligible guard and locks
      mockPrisma.$queryRaw.mockImplementation((query) => {
        if (query[0].includes('clock_timestamp')) return [{ now: new Date('2023-01-01T10:10:00Z') }];
        return [{ id: 'mock-id' }];
      });

      await consumer.consume('event-1');
      console.log('paymentApplication.update calls:', mockPrisma.paymentApplication.update.mock.calls);
      
      // Should APPLIED successfully, not REJECTED
      expect(mockPrisma.paymentApplication.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'APPLIED' })
      }));
      expect(mockPrisma.rentalOrder.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'PAID' })
      }));
    });
  });
});
