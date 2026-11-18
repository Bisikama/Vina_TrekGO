import { AppError } from 'src/shared/errors/app-error'
import { getAvailableCountWithTx } from '../../ordering/infrastructure/adapters/prisma-rental-availability-tx.helper'
import { assertEarlyPickKeepsCapacity, lockProductsForEarlyPick } from './early-pick-capacity'

jest.mock('../../ordering/infrastructure/adapters/prisma-rental-availability-tx.helper', () => ({
  getAvailableCountWithTx: jest.fn(),
}))

const availableCount = getAvailableCountWithTx as jest.MockedFunction<typeof getAvailableCountWithTx>

const occupiedStartAt = new Date('2026-11-29T13:00:00.000Z') // 20:00 29/11 VN
const early = new Date('2026-11-18T03:00:00.000Z')
const TENT = '00000000-0000-4000-8000-0000000000a1'
const PACK = '00000000-0000-4000-8000-0000000000b2'

function makeTx() {
  return {
    $queryRaw: jest.fn().mockResolvedValue([]),
    rentalQuantityReservation: { findMany: jest.fn().mockResolvedValue([{ id: 'own-res-1' }]) },
  } as any
}

describe('early pick capacity', () => {
  beforeEach(() => availableCount.mockReset())

  it('does nothing once the order is inside its reserved window', async () => {
    const tx = makeTx()
    expect(await lockProductsForEarlyPick(tx, occupiedStartAt, occupiedStartAt, [TENT])).toBe(false)
    await assertEarlyPickKeepsCapacity(tx, {
      orderId: 'order-a',
      occupiedStartAt,
      inventoryLocationId: 'loc',
      now: occupiedStartAt,
      requestedByProduct: new Map([[TENT, 5]]),
    })
    expect(tx.$queryRaw).not.toHaveBeenCalled()
    expect(availableCount).not.toHaveBeenCalled()
  })

  it('locks each product once, in sorted order, for an early pick', async () => {
    const tx = makeTx()
    expect(await lockProductsForEarlyPick(tx, occupiedStartAt, early, [PACK, TENT, PACK])).toBe(true)
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2)
    expect(tx.$queryRaw.mock.calls.map((c: unknown[]) => c[1])).toEqual([TENT, PACK])
  })

  it('allows an early pick when other orders leave enough spare stock before the reserved window', async () => {
    availableCount.mockResolvedValue(2)
    await expect(
      assertEarlyPickKeepsCapacity(makeTx(), {
        orderId: 'order-a',
        occupiedStartAt,
        inventoryLocationId: 'loc',
        now: early,
        requestedByProduct: new Map([[TENT, 2]]),
      }),
    ).resolves.toBeUndefined()
    expect(availableCount).toHaveBeenCalledWith(expect.anything(), {
      productId: TENT,
      inventoryLocationId: 'loc',
      occupiedFrom: early,
      occupiedUntil: occupiedStartAt,
      now: early,
      excludeReservationIds: ['own-res-1'],
    })
  })

  it('rejects an early pick that would leave another order short', async () => {
    availableCount.mockResolvedValue(0)
    const error = await assertEarlyPickKeepsCapacity(makeTx(), {
      orderId: 'order-a',
      occupiedStartAt,
      inventoryLocationId: 'loc',
      now: early,
      requestedByProduct: new Map([[TENT, 1]]),
    }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AppError)
    expect(error).toMatchObject({
      code: 'PREPARATION_PICK_TOO_EARLY',
      details: {
        productId: TENT,
        requestedQuantity: 1,
        availableCount: 0,
        pickableFrom: occupiedStartAt.toISOString(),
      },
    })
  })
})
