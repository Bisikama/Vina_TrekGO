/* eslint-disable @typescript-eslint/unbound-method */
import type { RentalOrderPort } from '../ports/rental-order.port';
import { CreateRentalOrderUseCase } from './create-rental-order.use-case';

describe('CreateRentalOrderUseCase', () => {
  it('delegates RB-API-201 to the port without Prisma in application layer', async () => {
    const port: jest.Mocked<RentalOrderPort> = {
      createOrder: jest.fn().mockResolvedValue({
        order: {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          quoteId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          bookingId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          tripId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          status: 'PENDING_PAYMENT',
          exceptionStatus: 'NONE',
          financialStatus: 'UNPAID',
          rentalFee: 100000,
          totalDeposit: 500000,
          totalAmount: 600000,
          currency: 'VND',
          paymentExpiresAt: '2026-10-04T14:15:00.000Z',
          dueAt: '2026-10-05T14:00:00.000Z',
          version: 1,
          createdAt: '2026-10-04T14:00:00.000Z',
        },
        quantityReservations: [],
      }),
      listOrders: jest.fn(),
      getOrder: jest.fn(),
      getPayment: jest.fn(),
      previewCancellation: jest.fn(),
      cancelOrder: jest.fn(),
      processPaymentEvent: jest.fn(),
      expirePendingOrders: jest.fn(),
    };

    const useCase = new CreateRentalOrderUseCase(port);
    const now = new Date('2026-10-04T14:00:00.000Z');

    await useCase.execute({
      userId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      quoteId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      idempotencyKey: 'rb-api-201-test-key',
      now,
    });

    expect(port.createOrder).toHaveBeenCalledWith({
      userId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      quoteId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      idempotencyKey: 'rb-api-201-test-key',
      now,
    });
  });
});
