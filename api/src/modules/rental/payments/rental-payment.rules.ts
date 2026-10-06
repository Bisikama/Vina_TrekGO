import { Prisma, RentalOrder, RentalOrderLine, PaymentAllocation } from '@prisma/client'
import { AppError, PAYMENT_ERROR_CODES as E } from '../../../shared/errors'

export function rentalComponents(order: RentalOrder, lines: RentalOrderLine[]) {
  const zero = new Prisma.Decimal(0)
  if (
    !lines.length ||
    order.currency !== 'VND' ||
    !order.totalAmount.gt(0) ||
    !order.totalAmount.isInteger() ||
    !order.totalAmount.equals(order.rentalFee.plus(order.totalDeposit)) ||
    !lines.reduce((n, l) => n.plus(l.lineRentalFee), zero).equals(order.rentalFee) ||
    !lines.reduce((n, l) => n.plus(l.lineDeposit), zero).equals(order.totalDeposit) ||
    lines.some(
      (l) =>
        l.orderId !== order.id ||
        l.quantity < 1 ||
        l.chargedDays < 1 ||
        !l.lineDeposit.equals(l.depositPerUnitSnapshot.mul(l.quantity)) ||
        !l.lineRentalFee.equals(l.dailyPriceSnapshot.mul(l.quantity).mul(l.chargedDays)) ||
        [l.lineDeposit, l.lineRentalFee].some((a) => a.isNegative() || !a.isInteger()),
    )
  )
    throw AppError.fromCode(E.PAYMENT_AMOUNT_MISMATCH)
  return lines
    .flatMap((line) => [
      { rentalOrderLineId: line.id, component: 'RENTAL_FEE' as const, amount: line.lineRentalFee },
      { rentalOrderLineId: line.id, component: 'RENTAL_DEPOSIT' as const, amount: line.lineDeposit },
    ])
    .filter((a) => a.amount.gt(0))
}

export function validateRentalAllocations(
  order: RentalOrder,
  lines: RentalOrderLine[],
  allocations: PaymentAllocation[],
) {
  const expected = rentalComponents(order, lines)
  if (
    expected.length !== allocations.length ||
    expected.some(
      (e) =>
        !allocations.some(
          (a) =>
            a.rentalOrderLineId === e.rentalOrderLineId && a.component === e.component && a.amount.equals(e.amount),
        ),
    )
  )
    throw AppError.fromCode(E.PAYMENT_AMOUNT_MISMATCH)
}
