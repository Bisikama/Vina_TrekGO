import envconfig from 'src/shared/config';
/** RB-POL-33 / MVP_SINGLE_LOCATION_01.
 * Server-owned primary location. Never infer a primary from a list of ACTIVE inventory locations.
 * Strictly uses RENTAL_PRIMARY_INVENTORY_LOCATION_ID.
 * Config changes while a quote is pending invalidate that quote; no speculative transfers.
 */
import type { Prisma } from '@prisma/client';
import { AppError } from 'src/shared/errors/app-error';
import { RENTAL_ORDERING_ERROR_CODES as RT } from 'src/shared/errors/codes/rental-ordering.error-codes';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function primaryRentalInventoryLocationId(): string {
  const primary = (process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID !== undefined ? process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID : envconfig.RENTAL_PRIMARY_INVENTORY_LOCATION_ID)?.trim();
  if (!primary || !UUID_RE.test(primary)) {
    throw AppError.fromCode(RT.INVENTORY_LOCATION_NOT_CONFIGURED, {
      details: { reason: 'PRIMARY_RENTAL_INVENTORY_LOCATION_MISSING' },
    });
  }
  return primary;
}

export function assertPrimaryRentalLocation(inputLocationId: string | null | undefined): string {
  const primary = primaryRentalInventoryLocationId();
  if (inputLocationId != null && inputLocationId !== primary) {
    throw AppError.fromCode('VALIDATION_ERROR', {
      details: { reason: 'MVP_SINGLE_LOCATION_MISMATCH', field: 'inventoryLocationId' },
    });
  }
  return primary;
}

export async function resolveActivePrimaryRentalLocation(db: Pick<Prisma.TransactionClient, 'inventoryLocation'>): Promise<string> {
  const id = primaryRentalInventoryLocationId();
  const location = await db.inventoryLocation.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!location || location.status !== 'ACTIVE') {
    throw AppError.fromCode(RT.INVENTORY_LOCATION_NOT_CONFIGURED, {
      details: { reason: 'PRIMARY_RENTAL_INVENTORY_LOCATION_NOT_ACTIVE' },
    });
  }
  return id;
}
