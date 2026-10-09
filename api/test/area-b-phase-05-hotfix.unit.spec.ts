import { Prisma, RentalOrder, RentalOrderLine, PaymentAllocation } from '@prisma/client'
import { rentalComponents, validateRentalAllocations } from '../src/modules/rental/payments/rental-payment.rules'
import { AppError } from '../src/shared/errors'

describe('Rental Payment Rules (Phase 05 Hotfix)', () => {
  const zero = new Prisma.Decimal(0)

  describe('rentalComponents', () => {
    it('should extract RENTAL_FEE and RENTAL_DEPOSIT for a single product', () => {
      const order = { id: 'order-1', currency: 'VND', totalAmount: new Prisma.Decimal(300), rentalFee: new Prisma.Decimal(100), totalDeposit: new Prisma.Decimal(200) } as RentalOrder
      const lines = [
        { id: 'line-1', orderId: 'order-1', quantity: 1, chargedDays: 1, depositPerUnitSnapshot: new Prisma.Decimal(200), dailyPriceSnapshot: new Prisma.Decimal(100), lineRentalFee: new Prisma.Decimal(100), lineDeposit: new Prisma.Decimal(200) } as RentalOrderLine
      ]
      const components = rentalComponents(order, lines)
      expect(components).toEqual([
        { rentalOrderLineId: 'line-1', component: 'RENTAL_FEE', amount: new Prisma.Decimal(100) },
        { rentalOrderLineId: 'line-1', component: 'RENTAL_DEPOSIT', amount: new Prisma.Decimal(200) }
      ])
    })

    it('should extract RENTAL_FEE and RENTAL_DEPOSIT for multiple products', () => {
      const order = { id: 'order-1', currency: 'VND', totalAmount: new Prisma.Decimal(750), rentalFee: new Prisma.Decimal(250), totalDeposit: new Prisma.Decimal(500) } as RentalOrder
      const lines = [
        { id: 'line-1', orderId: 'order-1', quantity: 1, chargedDays: 1, depositPerUnitSnapshot: new Prisma.Decimal(200), dailyPriceSnapshot: new Prisma.Decimal(100), lineRentalFee: new Prisma.Decimal(100), lineDeposit: new Prisma.Decimal(200) } as RentalOrderLine,
        { id: 'line-2', orderId: 'order-1', quantity: 1, chargedDays: 1, depositPerUnitSnapshot: new Prisma.Decimal(300), dailyPriceSnapshot: new Prisma.Decimal(150), lineRentalFee: new Prisma.Decimal(150), lineDeposit: new Prisma.Decimal(300) } as RentalOrderLine
      ]
      const components = rentalComponents(order, lines)
      expect(components).toEqual([
        { rentalOrderLineId: 'line-1', component: 'RENTAL_FEE', amount: new Prisma.Decimal(100) },
        { rentalOrderLineId: 'line-1', component: 'RENTAL_DEPOSIT', amount: new Prisma.Decimal(200) },
        { rentalOrderLineId: 'line-2', component: 'RENTAL_FEE', amount: new Prisma.Decimal(150) },
        { rentalOrderLineId: 'line-2', component: 'RENTAL_DEPOSIT', amount: new Prisma.Decimal(300) }
      ])
    })

    it('should throw PAYMENT_AMOUNT_MISMATCH if totalAmount does not match rentalFee + totalDeposit', () => {
      const order = { id: 'order-1', currency: 'VND', totalAmount: new Prisma.Decimal(400), rentalFee: new Prisma.Decimal(100), totalDeposit: new Prisma.Decimal(200) } as RentalOrder
      const lines = [
        { id: 'line-1', orderId: 'order-1', quantity: 1, chargedDays: 1, depositPerUnitSnapshot: new Prisma.Decimal(200), dailyPriceSnapshot: new Prisma.Decimal(100), lineRentalFee: new Prisma.Decimal(100), lineDeposit: new Prisma.Decimal(200) } as RentalOrderLine
      ]
      expect(() => rentalComponents(order, lines)).toThrow(AppError)
    })
  })

  describe('validateRentalAllocations', () => {
    it('should validate correctly for single product', () => {
      const order = { id: 'order-1', currency: 'VND', totalAmount: new Prisma.Decimal(300), rentalFee: new Prisma.Decimal(100), totalDeposit: new Prisma.Decimal(200) } as RentalOrder
      const lines = [
        { id: 'line-1', orderId: 'order-1', quantity: 1, chargedDays: 1, depositPerUnitSnapshot: new Prisma.Decimal(200), dailyPriceSnapshot: new Prisma.Decimal(100), lineRentalFee: new Prisma.Decimal(100), lineDeposit: new Prisma.Decimal(200) } as RentalOrderLine
      ]
      const allocations = [
        { rentalOrderLineId: 'line-1', component: 'RENTAL_FEE', amount: new Prisma.Decimal(100) },
        { rentalOrderLineId: 'line-1', component: 'RENTAL_DEPOSIT', amount: new Prisma.Decimal(200) }
      ] as any[]
      expect(() => validateRentalAllocations(order, lines, allocations)).not.toThrow()
    })

    it('should validate correctly for multiple products', () => {
      const order = { id: 'order-1', currency: 'VND', totalAmount: new Prisma.Decimal(750), rentalFee: new Prisma.Decimal(250), totalDeposit: new Prisma.Decimal(500) } as RentalOrder
      const lines = [
        { id: 'line-1', orderId: 'order-1', quantity: 1, chargedDays: 1, depositPerUnitSnapshot: new Prisma.Decimal(200), dailyPriceSnapshot: new Prisma.Decimal(100), lineRentalFee: new Prisma.Decimal(100), lineDeposit: new Prisma.Decimal(200) } as RentalOrderLine,
        { id: 'line-2', orderId: 'order-1', quantity: 1, chargedDays: 1, depositPerUnitSnapshot: new Prisma.Decimal(300), dailyPriceSnapshot: new Prisma.Decimal(150), lineRentalFee: new Prisma.Decimal(150), lineDeposit: new Prisma.Decimal(300) } as RentalOrderLine
      ]
      const allocations = [
        { rentalOrderLineId: 'line-1', component: 'RENTAL_FEE', amount: new Prisma.Decimal(100) },
        { rentalOrderLineId: 'line-1', component: 'RENTAL_DEPOSIT', amount: new Prisma.Decimal(200) },
        { rentalOrderLineId: 'line-2', component: 'RENTAL_FEE', amount: new Prisma.Decimal(150) },
        { rentalOrderLineId: 'line-2', component: 'RENTAL_DEPOSIT', amount: new Prisma.Decimal(300) }
      ] as any[]
      expect(() => validateRentalAllocations(order, lines, allocations)).not.toThrow()
    })

    it('should throw PAYMENT_AMOUNT_MISMATCH if an allocation is missing', () => {
      const order = { id: 'order-1', currency: 'VND', totalAmount: new Prisma.Decimal(300), rentalFee: new Prisma.Decimal(100), totalDeposit: new Prisma.Decimal(200) } as RentalOrder
      const lines = [
        { id: 'line-1', orderId: 'order-1', quantity: 1, chargedDays: 1, depositPerUnitSnapshot: new Prisma.Decimal(200), dailyPriceSnapshot: new Prisma.Decimal(100), lineRentalFee: new Prisma.Decimal(100), lineDeposit: new Prisma.Decimal(200) } as RentalOrderLine
      ]
      const allocations = [
        { rentalOrderLineId: 'line-1', component: 'RENTAL_FEE', amount: new Prisma.Decimal(100) },
      ] as any[]
      expect(() => validateRentalAllocations(order, lines, allocations)).toThrow(AppError)
    })
  })
})
