import { EquipmentCondition, EquipmentUnitStatus, ReservationStatus, Prisma } from '@prisma/client';
import type { RentalAvailabilityQuery } from '../../application/ports/rental-availability.port';
import { calculateSafeCapacity } from '../../application/services/capacity-safety-gate';

/** Read under the caller's existing product-level DB lock for mutation paths. */
export async function getVerifiedCapacitySnapshot(
  db: Prisma.TransactionClient,
  q: RentalAvailabilityQuery,
) {
  const [units, reservations] = await Promise.all([
    db.equipmentUnit.findMany({
      where: {
        productId: q.productId,
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
        ...(q.inventoryLocationId
          ? {
              OR: [
                { currentInventoryLocationId: q.inventoryLocationId },
                {
                  currentInventoryLocationId: null,
                  homeInventoryLocationId: q.inventoryLocationId,
                },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        status: true,
        homeInventoryLocationId: true,
        currentInventoryLocationId: true,
        readinessCommitmentsViaUnitId: {
          select: {
            readyBy: true,
            validUntil: true,
            verifiedAt: true,
            verifiedBy: true,
            evidenceRef: true,
            status: true,
          },
        },
        returnInspectionTasks: { select: { status: true } },
      },
    }),
    db.rentalQuantityReservation.findMany({
      where: {
        productId: q.productId,
        occupiedFrom: { lt: q.occupiedUntil },
        occupiedUntil: { gt: q.occupiedFrom },
        OR: [
          { status: ReservationStatus.CONFIRMED },
          { status: ReservationStatus.HELD, holdExpiresAt: { gt: q.now } },
        ],
        ...(q.inventoryLocationId
          ? {
              orderLine: {
                order: {
                  OR: [
                    { inventoryTaskViaOrderId: { inventoryLocationId: q.inventoryLocationId } },
                    {
                      rentalOrderLinesViaOrderId: {
                        some: {
                          rentalUnitAssignmentsViaOrderLineId: {
                            some: {
                              equipmentUnit: {
                                OR: [
                                  { currentInventoryLocationId: q.inventoryLocationId },
                                  { currentInventoryLocationId: null, homeInventoryLocationId: q.inventoryLocationId },
                                ],
                              },
                            },
                          },
                        },
                      },
                    },
                    {
                      inventoryTaskViaOrderId: null,
                      rentalOrderLinesViaOrderId: {
                        none: {
                          rentalUnitAssignmentsViaOrderLineId: {
                            some: {
                              equipmentUnit: {
                                NOT: {
                                  OR: [
                                    { currentInventoryLocationId: q.inventoryLocationId },
                                    { currentInventoryLocationId: null, homeInventoryLocationId: q.inventoryLocationId },
                                  ],
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            }
          : {}),
      },
      select: { id: true, quantity: true, occupiedFrom: true, occupiedUntil: true },
    }),
  ]);

  const eligible = units.map((u) => {
    const pending = u.returnInspectionTasks.some((t) => t.status !== 'COMPLETED');
    const commitment = u.readinessCommitmentsViaUnitId.find(
      (c) =>
        c.status === 'VERIFIED' &&
        c.verifiedAt <= q.now &&
        c.readyBy <= q.occupiedFrom &&
        c.validUntil >= q.occupiedUntil &&
        c.verifiedBy &&
        c.evidenceRef.trim(),
    );
    const unitLoc = u.currentInventoryLocationId ?? u.homeInventoryLocationId;
    const isAtLocation = !q.inventoryLocationId || unitLoc === q.inventoryLocationId;
    return {
      id: u.id,
      ready:
        u.status === EquipmentUnitStatus.AVAILABLE &&
        !!u.currentInventoryLocationId &&
        isAtLocation &&
        !pending,
      verifiedReadyAt: pending || !isAtLocation ? null : commitment?.readyBy,
      verifiedUntil: pending || !isAtLocation ? null : commitment?.validUntil,
      verifiedBy: pending || !isAtLocation ? null : commitment?.verifiedBy,
      evidenceRef: pending || !isAtLocation ? null : commitment?.evidenceRef,
    };
  });

  return calculateSafeCapacity({
    from: q.occupiedFrom,
    until: q.occupiedUntil,
    units: eligible,
    reservations,
  });
}
