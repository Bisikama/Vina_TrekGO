import { Test, TestingModule } from '@nestjs/testing';
import { RentalExtensionService } from 'src/modules/rental/ordering/extension/rental-extension.service';
import { RENTAL_CONTEXT_PORT, RentalContextPort } from 'src/modules/rental/ordering/application/ports/rental-context.port';
import { PrismaService } from 'src/shared/services/prisma.service';

describe('Phase 03_ORDERING Unit Tests', () => {
  let service: RentalExtensionService;
  let mockPrisma: any;
  let mockContext: any;

  beforeEach(async () => {
    mockPrisma = {
      rentalOrder: { findUnique: jest.fn(), update: jest.fn() },
      rentalExtensionRequest: { create: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      idempotencyRecord: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      $transaction: jest.fn(),
    };

    mockContext = {
      getByTripId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RentalExtensionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RENTAL_CONTEXT_PORT, useValue: mockContext },
      ],
    }).compile();

    service = module.get<RentalExtensionService>(RentalExtensionService);
  });

  describe('quote()', () => {
    it('should throw EXTENSION_LIMIT_EXCEEDED if already extended twice', async () => {
      mockPrisma.rentalOrder.findUnique.mockResolvedValue({
        id: 'order-1',
        userId: 'user-1',
        status: 'ACTIVE',
        rentalEndAt: new Date(Date.now() + 1000000),
        policySnapshot: { maxExtensionCount: 2 },
      });
      mockContext.getByTripId.mockResolvedValue({
        trip: { endAt: new Date(Date.now() + 2000000) },
        membershipRef: undefined,
      });
      mockPrisma.rentalExtensionRequest.count.mockResolvedValue(2); // Already extended 2 times

      await expect(service.quote('user-1', 'order-1', new Date(Date.now() + 1500000), 'opt-1'))
        .rejects.toThrow('EXTENSION_LIMIT_EXCEEDED');
    });

    it('should throw RENTAL_DURATION_NOT_ALLOWED if requested duration exceeds 14 days', async () => {
      const rentalStartAt = new Date('2023-01-01T00:00:00Z');
      const requestedReturnAt = new Date('2023-01-16T00:00:00Z'); // 15 days later

      mockPrisma.rentalOrder.findUnique.mockResolvedValue({
        id: 'order-1',
        userId: 'user-1',
        status: 'ACTIVE',
        rentalStartAt,
        rentalEndAt: new Date('2023-01-10T00:00:00Z'),
        policySnapshot: { maxExtensionCount: 2, maxTotalRentalDays: 14 },
      });
      mockContext.getByTripId.mockResolvedValue({
        trip: { endAt: new Date('2023-01-10T00:00:00Z') },
        membershipRef: undefined,
      });
      mockPrisma.rentalExtensionRequest.count.mockResolvedValue(0);

      await expect(service.quote('user-1', 'order-1', requestedReturnAt, 'opt-1', new Date('2023-01-09T00:00:00Z')))
        .rejects.toThrow('RENTAL_DURATION_NOT_ALLOWED');
    });
  });

  describe('confirm()', () => {
    it('should throw TERMS_NOT_ACCEPTED if acceptedTermsVersion is missing', async () => {
      await expect(service.confirm('user-1', 'order-1', 'quote-1', 1, 'key-1'))
        .rejects.toThrow('TERMS_NOT_ACCEPTED');
    });
  });
});
