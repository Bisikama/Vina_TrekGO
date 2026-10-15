import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/shared/services/prisma.service';
import type {
  RentalAvailabilityPort,
  RentalAvailabilityQuery,
} from '../../application/ports/rental-availability.port';
import { getVerifiedCapacitySnapshot } from './rental-capacity-snapshot';

@Injectable()
export class PrismaRentalAvailabilityAdapter implements RentalAvailabilityPort {
  constructor(private readonly prisma: PrismaService) {}

  async getAvailableCount(query: RentalAvailabilityQuery): Promise<number> {
    if (!query.occupiedFrom || !query.occupiedUntil || !(query.occupiedFrom < query.occupiedUntil)) {
      throw new Error('INVALID_OCCUPIED_WINDOW');
    }
    // Snapshot: not a booking guarantee; createOrder recomputes under product-level lock.
    const result = await getVerifiedCapacitySnapshot(this.prisma, query);
    const requestedQuantity = query.requestedQuantity ?? 1;
    const isShortage = requestedQuantity > result.availableCount;
    if (
      isShortage ||
      result.actionRequired ||
      result.unknownUnitCount > 0
    ) {
      const alertKey = createHash('sha256')
        .update(
          [
            query.inventoryLocationId ?? 'all',
            query.productId,
            query.occupiedFrom.toISOString(),
            query.occupiedUntil.toISOString(),
          ].join(':'),
        )
        .digest('hex');
      try {
        await this.prisma.rentalCapacityAlert.upsert({
          where: { alertKey },
          update: {
            requestedQuantity,
            availableCount: result.availableCount,
            unknownUnitCount: result.unknownUnitCount,
            status: 'ACTION_REQUIRED',
          },
          create: {
            alertKey,
            productId: query.productId,
            occupiedFrom: query.occupiedFrom,
            occupiedUntil: query.occupiedUntil,
            requestedQuantity,
            availableCount: result.availableCount,
            unknownUnitCount: result.unknownUnitCount,
            reason:
              isShortage
                ? 'CAPACITY_INSUFFICIENT'
                : result.unknownUnitCount > 0
                  ? 'READINESS_NOT_VERIFIED'
                  : 'CAPACITY_INSUFFICIENT',
            status: 'ACTION_REQUIRED',
          },
        });
      } catch (alertError) {
        console.error('[RentalCapacityAlert] Failed to persist availability alert:', alertError);
      }
    }
    return result.availableCount;
  }
}