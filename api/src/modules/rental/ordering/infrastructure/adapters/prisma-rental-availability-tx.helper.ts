import type { Prisma } from '@prisma/client';
import type { RentalAvailabilityQuery } from '../../application/ports/rental-availability.port';
import { getVerifiedCapacitySnapshot } from './rental-capacity-snapshot';

export async function getAvailableCountWithTx(
  tx: Prisma.TransactionClient,
  query: RentalAvailabilityQuery,
): Promise<number> {
  // Caller must lock product row before this read, then reserve within same transaction.
  return (await getVerifiedCapacitySnapshot(tx, query)).availableCount;
}
