import { calculateSafeCapacity } from 'src/modules/rental/ordering/application/services/capacity-safety-gate';
import { PrismaRentalAvailabilityAdapter } from 'src/modules/rental/ordering/infrastructure/adapters/prisma-rental-availability.adapter';

describe('Capacity Safety Gate P0 (RB-POL-31)', () => {
  const from = new Date('2026-10-15T00:00:00.000Z');
  const until = new Date('2026-10-17T00:00:00.000Z');

  describe('Event Sweep & Half-Open Intervals', () => {
    it('should sort end (-delta) before start (+delta) at boundary timestamps so back-to-back reservations do not overlap', () => {
      const mid = new Date('2026-10-16T00:00:00.000Z');

      const units = [
        { id: 'u1', ready: true },
        { id: 'u2', ready: true },
      ];

      // Reservation 1: from -> mid (qty: 2)
      // Reservation 2: mid -> until (qty: 2)
      // At timestamp `mid`, res1 ends and res2 starts. In half-open intervals [start, end),
      // peak reserved should be 2, NOT 4!
      const reservations = [
        { id: 'res-1', quantity: 2, occupiedFrom: from, occupiedUntil: mid },
        { id: 'res-2', quantity: 2, occupiedFrom: mid, occupiedUntil: until },
      ];

      const result = calculateSafeCapacity({ from, until, units, reservations });

      expect(result.peakReserved).toBe(2);
      expect(result.availableCount).toBe(0);
      expect(result.actionRequired).toBe(false);
    });

    it('should correctly accumulate overlapping reservations', () => {
      const t1 = new Date('2026-10-15T06:00:00.000Z');
      const t2 = new Date('2026-10-16T18:00:00.000Z');

      const units = [
        { id: 'u1', ready: true },
        { id: 'u2', ready: true },
        { id: 'u3', ready: true },
        { id: 'u4', ready: true },
        { id: 'u5', ready: true },
      ];

      const reservations = [
        { id: 'res-1', quantity: 2, occupiedFrom: from, occupiedUntil: t2 },
        { id: 'res-2', quantity: 2, occupiedFrom: t1, occupiedUntil: until },
      ];

      const result = calculateSafeCapacity({ from, until, units, reservations });

      // Between t1 and t2, both are active -> 2 + 2 = 4
      expect(result.peakReserved).toBe(4);
      expect(result.availableCount).toBe(1); // 5 - 4 = 1
    });

    it('should deduplicate reservations by id', () => {
      const units = [{ id: 'u1', ready: true }, { id: 'u2', ready: true }];
      const reservations = [
        { id: 'res-1', quantity: 1, occupiedFrom: from, occupiedUntil: until },
        { id: 'res-1', quantity: 1, occupiedFrom: from, occupiedUntil: until },
      ];

      const result = calculateSafeCapacity({ from, until, units, reservations });
      expect(result.peakReserved).toBe(1);
      expect(result.availableCount).toBe(1);
    });
  });

  describe('Readiness & UNKNOWN Supply Exclusion', () => {
    it('should exclude units that are not ready and lack verified commitments', () => {
      const units = [
        { id: 'u1', ready: true },
        { id: 'u2', ready: false }, // UNKNOWN supply (no evidence)
        { id: 'u3', ready: false }, // UNKNOWN supply
      ];

      const result = calculateSafeCapacity({ from, until, units, reservations: [] });

      expect(result.verifiedSupply).toBe(1);
      expect(result.unknownUnitCount).toBe(2);
      expect(result.availableCount).toBe(1);
    });

    it('should accept non-ready units IF verified commitment with evidence covers the window', () => {
      const units = [
        { id: 'u1', ready: true },
        {
          id: 'u2',
          ready: false,
          evidenceRef: 'DOC-123',
          verifiedBy: 'STAFF-1',
          verifiedReadyAt: new Date('2026-10-14T00:00:00.000Z'), // Before window
          verifiedUntil: new Date('2026-10-18T00:00:00.000Z'),   // After window
        },
        {
          id: 'u3',
          ready: false,
          evidenceRef: 'DOC-999',
          verifiedBy: 'STAFF-1',
          verifiedReadyAt: new Date('2026-10-16T00:00:00.000Z'), // Too late! Starts mid-window
          verifiedUntil: new Date('2026-10-18T00:00:00.000Z'),
        },
      ];

      const result = calculateSafeCapacity({ from, until, units, reservations: [] });

      expect(result.verifiedSupply).toBe(2); // u1 and u2
      expect(result.unknownUnitCount).toBe(1); // u3 is unknown
      expect(result.availableCount).toBe(2);
    });

    it('should fail closed when reservations exceed verified supply (actionRequired = true)', () => {
      const units = [{ id: 'u1', ready: true }];
      const reservations = [{ id: 'res-1', quantity: 2, occupiedFrom: from, occupiedUntil: until }];

      const result = calculateSafeCapacity({ from, until, units, reservations });

      expect(result.peakReserved).toBe(2);
      expect(result.verifiedSupply).toBe(1);
      expect(result.availableCount).toBe(0); // Math.max(0, 1 - 2)
      expect(result.actionRequired).toBe(true);
    });
  });

  describe('Occupied Window Bounds', () => {
    it('should throw error if from >= until', () => {
      expect(() => {
        calculateSafeCapacity({ from: until, until: from, units: [], reservations: [] });
      }).toThrow('INVALID_OCCUPIED_WINDOW');
    });

    it('should ignore reservations entirely outside the requested window', () => {
      const units = [{ id: 'u1', ready: true }, { id: 'u2', ready: true }];
      const reservations = [
        { id: 'res-old', quantity: 2, occupiedFrom: new Date('2026-10-10T00:00:00Z'), occupiedUntil: new Date('2026-10-12T00:00:00Z') },
        { id: 'res-future', quantity: 2, occupiedFrom: new Date('2026-10-20T00:00:00Z'), occupiedUntil: new Date('2026-10-22T00:00:00Z') },
      ];

      const result = calculateSafeCapacity({ from, until, units, reservations });

      expect(result.peakReserved).toBe(0);
      expect(result.availableCount).toBe(2);
    });
  });

  describe('RentalCapacityAlert & Observability Failure Handling', () => {
    it('should record RentalCapacityAlert with stable alertKey and actual occupied window on shortage', async () => {
      const mockUpsert = jest.fn().mockResolvedValue({});
      const mockPrisma: any = {
        equipmentUnit: { findMany: jest.fn().mockResolvedValue([]) },
        rentalQuantityReservation: { findMany: jest.fn().mockResolvedValue([]) },
        rentalCapacityAlert: { upsert: mockUpsert },
      };

      const adapter = new PrismaRentalAvailabilityAdapter(mockPrisma);
      const query = {
        productId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        occupiedFrom: from,
        occupiedUntil: until,
        now: new Date('2026-10-14T00:00:00.000Z'),
        requestedQuantity: 5,
      };

      const available = await adapter.getAvailableCount(query);
      expect(available).toBe(0); // 0 units available, requested 5
      expect(mockUpsert).toHaveBeenCalledTimes(1);

      const upsertArg = mockUpsert.mock.calls[0][0];
      // Stable alertKey is 64 hex chars (sha256)
      expect(upsertArg.where.alertKey).toMatch(/^[a-f0-9]{64}$/);
      expect(upsertArg.create.productId).toBe(query.productId);
      expect(upsertArg.create.occupiedFrom).toEqual(from);
      expect(upsertArg.create.occupiedUntil).toEqual(until);
      expect(upsertArg.create.requestedQuantity).toBe(5);
      expect(upsertArg.create.availableCount).toBe(0);
      expect(upsertArg.create.status).toBe('ACTION_REQUIRED');
      expect(upsertArg.create.reason).toBe('CAPACITY_INSUFFICIENT');
    });

    it('should not allow observability failure (alert upsert throwing) to enable overbooking or break availability calculation', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const mockUpsert = jest.fn().mockRejectedValue(new Error('DB Connection Timeout'));
      const mockPrisma: any = {
        equipmentUnit: { findMany: jest.fn().mockResolvedValue([]) },
        rentalQuantityReservation: { findMany: jest.fn().mockResolvedValue([]) },
        rentalCapacityAlert: { upsert: mockUpsert },
      };

      const adapter = new PrismaRentalAvailabilityAdapter(mockPrisma);
      const query = {
        productId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        occupiedFrom: from,
        occupiedUntil: until,
        now: new Date('2026-10-14T00:00:00.000Z'),
        requestedQuantity: 3,
      };

      // Even if alert persistence fails, availableCount MUST still return 0 (safe capacity)
      const available = await adapter.getAvailableCount(query);
      expect(available).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[RentalCapacityAlert] Failed to persist availability alert:'),
        expect.any(Error),
      );
      consoleErrorSpy.mockRestore();
    });

    it('should trigger ACTION_REQUIRED alert with actual requestedQuantity=3 and availableCount=2 when shortage occurs', async () => {
      const mockUpsert = jest.fn().mockResolvedValue({});
      const mockPrisma: any = {
        equipmentUnit: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'u1', status: 'AVAILABLE', currentInventoryLocationId: 'loc-1', homeInventoryLocationId: 'loc-1', readinessCommitmentsViaUnitId: [], returnInspectionTasks: [] },
            { id: 'u2', status: 'AVAILABLE', currentInventoryLocationId: 'loc-1', homeInventoryLocationId: 'loc-1', readinessCommitmentsViaUnitId: [], returnInspectionTasks: [] },
          ]),
        },
        rentalQuantityReservation: { findMany: jest.fn().mockResolvedValue([]) },
        rentalCapacityAlert: { upsert: mockUpsert },
      };

      const adapter = new PrismaRentalAvailabilityAdapter(mockPrisma);
      const query = {
        productId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        occupiedFrom: from,
        occupiedUntil: until,
        now: new Date('2026-10-14T00:00:00.000Z'),
        requestedQuantity: 3, // Request 3, but only 2 available!
      };

      const available = await adapter.getAvailableCount(query);
      expect(available).toBe(2);

      expect(mockUpsert).toHaveBeenCalledTimes(1);
      const upsertArg = mockUpsert.mock.calls[0][0];
      expect(upsertArg.create.requestedQuantity).toBe(3);
      expect(upsertArg.create.availableCount).toBe(2);
      expect(upsertArg.create.status).toBe('ACTION_REQUIRED');
      expect(upsertArg.create.reason).toBe('CAPACITY_INSUFFICIENT');
    });

    it('should reject invalid occupied window (from >= until) and fail closed without creating fake alert', async () => {
      const mockUpsert = jest.fn();
      const mockPrisma: any = {
        equipmentUnit: { findMany: jest.fn() },
        rentalQuantityReservation: { findMany: jest.fn() },
        rentalCapacityAlert: { upsert: mockUpsert },
      };

      const adapter = new PrismaRentalAvailabilityAdapter(mockPrisma);
      const invalidQuery = {
        productId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        occupiedFrom: until,
        occupiedUntil: from, // Inverted!
        now: new Date('2026-10-14T00:00:00.000Z'),
        requestedQuantity: 3,
      };

      await expect(adapter.getAvailableCount(invalidQuery)).rejects.toThrow('INVALID_OCCUPIED_WINDOW');
      expect(mockUpsert).not.toHaveBeenCalled();
    });
  });
});


