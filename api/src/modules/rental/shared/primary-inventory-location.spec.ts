import { assertPrimaryRentalLocation, primaryRentalInventoryLocationId, resolveActivePrimaryRentalLocation } from './primary-inventory-location';

describe('primaryRentalInventoryLocationId (RB-POL-33)', () => {
  const originalPrimary = process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID;
  const originalDefault = process.env.RENTAL_DEFAULT_INVENTORY_LOCATION_ID;
  const idA = '11111111-1111-4111-8111-111111111111';
  const idB = '22222222-2222-4222-8222-222222222222';

  afterEach(() => {
    process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID = originalPrimary;
    process.env.RENTAL_DEFAULT_INVENTORY_LOCATION_ID = originalDefault;
  });

  it('fails closed if primary config is absent', () => {
    delete process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID;
    delete process.env.RENTAL_DEFAULT_INVENTORY_LOCATION_ID;
    expect(() => primaryRentalInventoryLocationId()).toThrow();
  });

  it('fails closed if only legacy DEFAULT is configured and canonical PRIMARY is missing', () => {
    delete process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID;
    process.env.RENTAL_DEFAULT_INVENTORY_LOCATION_ID = idA;
    expect(() => primaryRentalInventoryLocationId()).toThrow();
  });

  it('fails closed if format is not a valid UUID', () => {
    process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID = 'not-a-uuid';
    delete process.env.RENTAL_DEFAULT_INVENTORY_LOCATION_ID;
    expect(() => primaryRentalInventoryLocationId()).toThrow();
  });

  it('returns canonical id when configured', () => {
    process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID = idA;
    delete process.env.RENTAL_DEFAULT_INVENTORY_LOCATION_ID;
    expect(primaryRentalInventoryLocationId()).toBe(idA);
  });

  it('assertPrimaryRentalLocation succeeds for matching or null input and rejects mismatch', () => {
    process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID = idA;
    delete process.env.RENTAL_DEFAULT_INVENTORY_LOCATION_ID;
    expect(assertPrimaryRentalLocation(null)).toBe(idA);
    expect(assertPrimaryRentalLocation(idA)).toBe(idA);
    expect(() => assertPrimaryRentalLocation(idB)).toThrow();
  });

  it('resolveActivePrimaryRentalLocation fails if inventory location is inactive or missing in db', async () => {
    process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID = idA;
    delete process.env.RENTAL_DEFAULT_INVENTORY_LOCATION_ID;
    const dbMissing = {
      inventoryLocation: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    await expect(resolveActivePrimaryRentalLocation(dbMissing as any)).rejects.toThrow();

    const dbInactive = {
      inventoryLocation: {
        findUnique: jest.fn().mockResolvedValue({ id: idA, status: 'INACTIVE' }),
      },
    };
    await expect(resolveActivePrimaryRentalLocation(dbInactive as any)).rejects.toThrow();

    const dbActive = {
      inventoryLocation: {
        findUnique: jest.fn().mockResolvedValue({ id: idA, status: 'ACTIVE' }),
      },
    };
    await expect(resolveActivePrimaryRentalLocation(dbActive as any)).resolves.toBe(idA);
  });
});
