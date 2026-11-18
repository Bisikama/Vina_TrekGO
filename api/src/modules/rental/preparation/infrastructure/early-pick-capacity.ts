import type { Prisma } from '@prisma/client'
import { AppError } from 'src/shared/errors/app-error'
import { PREPARATION_ERROR_CODES as PR } from 'src/shared/errors/codes/preparation.error-codes'
import { getAvailableCountWithTx } from '../../ordering/infrastructure/adapters/prisma-rental-availability-tx.helper'

/**
 * An order only reserves stock from its `occupiedStartAt` (handover − 12h). Picking before that takes a unit
 * off the shelf outside the reserved slot, so another order that is due earlier could be left short.
 *
 * Returns true when the pick is early. In that case it locks the order's product rows (sorted, like
 * createOrder) so no new order can take the spare stock between the check and the pick.
 * Must be called before any equipment unit is locked.
 */
export async function lockProductsForEarlyPick(
  tx: Prisma.TransactionClient,
  occupiedStartAt: Date,
  now: Date,
  productIds: string[],
): Promise<boolean> {
  if (now.getTime() >= occupiedStartAt.getTime()) return false
  for (const productId of [...new Set(productIds)].sort()) {
    await tx.$queryRaw`SELECT id FROM rental_products WHERE id = ${productId}::uuid FOR UPDATE`
  }
  return true
}

/**
 * Early pick is allowed only if the stock left over by other orders' peak demand in
 * [now, occupiedStartAt) covers the units being picked. This order's own reservation starts at
 * occupiedStartAt, so it does not overlap that window (half-open intervals); its reservations are also
 * excluded explicitly, since the units being picked are what serve them.
 */
export async function assertEarlyPickKeepsCapacity(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string
    occupiedStartAt: Date
    inventoryLocationId: string
    now: Date
    requestedByProduct: Map<string, number>
  },
): Promise<void> {
  if (input.now.getTime() >= input.occupiedStartAt.getTime()) return
  const ownReservations = await tx.rentalQuantityReservation.findMany({
    where: { orderLine: { orderId: input.orderId } },
    select: { id: true },
  })
  const excludeReservationIds = ownReservations.map((r) => r.id)
  for (const productId of [...input.requestedByProduct.keys()].sort()) {
    const requestedQuantity = input.requestedByProduct.get(productId) ?? 0
    if (requestedQuantity <= 0) continue
    const availableCount = await getAvailableCountWithTx(tx, {
      productId,
      inventoryLocationId: input.inventoryLocationId,
      occupiedFrom: input.now,
      occupiedUntil: input.occupiedStartAt,
      now: input.now,
      excludeReservationIds,
    })
    if (requestedQuantity > availableCount) {
      throw AppError.fromCode(PR.PREPARATION_PICK_TOO_EARLY, {
        details: {
          productId,
          requestedQuantity,
          availableCount,
          pickableFrom: input.occupiedStartAt.toISOString(),
        },
      })
    }
  }
}
