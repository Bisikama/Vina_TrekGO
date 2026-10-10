import {
  EquipmentCondition,
  EquipmentUnitStatus,
  Prisma,
  RentalUnitAssignmentStatus,
  ReservationStatus,
} from '@prisma/client';
import type { RentalAvailabilityQuery } from '../../application/ports/rental-availability.port';

/**
 * B2 transaction-scoped copy of the frozen B1 availability semantics.
 *
 * IMPORTANT: keep this query logically identical to
 * PrismaRentalAvailabilityAdapter.getAvailableCount(). B1 itself is frozen,
 * so API-201 reuses the same rules without changing B1's public code path.
 */
export async function getAvailableCountWithTx(
  tx: Prisma.TransactionClient,
  query: RentalAvailabilityQuery,
): Promise<number> {
  const usablePhysicalCapacity = await tx.equipmentUnit.count({
    where: {
      productId: query.productId,
      status: {
        notIn: [
          EquipmentUnitStatus.MAINTENANCE,
          EquipmentUnitStatus.DAMAGED,
          EquipmentUnitStatus.LOST,
          EquipmentUnitStatus.RETIRED,
        ],
      },
      condition: {
        notIn: [EquipmentCondition.DAMAGED, EquipmentCondition.LOST],
      },
    },
  });

  const overlappingReservations =
    await tx.rentalQuantityReservation.findMany({
      where: {
        productId: query.productId,
        occupiedFrom: { lt: query.occupiedUntil },
        occupiedUntil: { gt: query.occupiedFrom },
        OR: [
          { status: ReservationStatus.CONFIRMED },
          {
            status: ReservationStatus.HELD,
            holdExpiresAt: { gt: query.now },
          },
        ],
      },
      select: { quantity: true },
    });

  const reservedQuantity = overlappingReservations.reduce(
    (total, reservation) => total + reservation.quantity,
    0,
  );

  const additionalBlockedUnitCount = await tx.equipmentUnit.count({
    where: {
      productId: query.productId,
      condition: {
        notIn: [EquipmentCondition.DAMAGED, EquipmentCondition.LOST],
      },
      status: {
        notIn: [
          EquipmentUnitStatus.MAINTENANCE,
          EquipmentUnitStatus.DAMAGED,
          EquipmentUnitStatus.LOST,
          EquipmentUnitStatus.RETIRED,
        ],
      },
      OR: [
        {
          status: {
            in: [
              EquipmentUnitStatus.PICKED,
              EquipmentUnitStatus.PACKED,
              EquipmentUnitStatus.RENTED,
              EquipmentUnitStatus.RETURN_PENDING,
              EquipmentUnitStatus.CLEANING,
            ],
          },
        },
        {
          rentalUnitAssignmentsViaEquipmentUnitId: {
            some: {
              status: {
                in: [
                  RentalUnitAssignmentStatus.ASSIGNED,
                  RentalUnitAssignmentStatus.PACKED,
                  RentalUnitAssignmentStatus.HANDED_OVER,
                ],
              },
            },
          },
        },
      ],
      rentalUnitAssignmentsViaEquipmentUnitId: {
        none: {
          status: {
            in: [
              RentalUnitAssignmentStatus.ASSIGNED,
              RentalUnitAssignmentStatus.PACKED,
              RentalUnitAssignmentStatus.HANDED_OVER,
              RentalUnitAssignmentStatus.RETURNED,
              RentalUnitAssignmentStatus.CLOSED,
            ],
          },
          orderLine: {
            productId: query.productId,
            rentalQuantityReservationsViaOrderLineId: {
              some: {
                productId: query.productId,
                status: ReservationStatus.CONFIRMED,
                occupiedFrom: { lt: query.occupiedUntil },
                occupiedUntil: { gt: query.occupiedFrom },
              },
            },
          },
        },
      },
    },
  });

  return Math.max(
    0,
    usablePhysicalCapacity - reservedQuantity - additionalBlockedUnitCount,
  );
}
