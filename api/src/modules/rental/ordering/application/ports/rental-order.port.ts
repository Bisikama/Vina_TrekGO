export interface CreateRentalOrderCommand {
  userId: string
  quoteId: string
  idempotencyKey: string
  now: Date
}

export interface ListRentalOrdersQuery {
  userId: string
  tripId?: string
  bookingId?: string
  status?: string
  page: number
  pageSize: number
}

export interface GetRentalOrderQuery {
  actorUserId: string
  actorRole: string
  orderId: string
}

export interface GetRentalPaymentQuery {
  userId: string
  orderId: string
}

export interface PreviewRentalCancellationQuery {
  userId: string
  orderId: string
  now: Date
}

export interface CancelRentalOrderCommand {
  userId: string
  orderId: string
  reason: string
  previewVersion: string
  expectedVersion: number
  now: Date
}

export interface RentalPaymentEventCommand {
  eventId: string
  paymentRef: string
  status: 'SUCCEEDED' | 'FAILED'
  amount: string
  currency: string
  providerRef?: string | null
  payload?: Record<string, unknown>
  occurredAt?: Date
}

export interface RentalOrderSummary {
  id: string
  quoteId: string
  bookingId: string | null
  tripId: string
  status: string
  exceptionStatus: string
  financialStatus: string
  rentalFee: number
  totalDeposit: number
  totalAmount: number
  currency: string
  paymentExpiresAt: string
  dueAt: string
  version: number
  createdAt: string
}

export interface QuantityReservationSummary {
  id: string
  orderLineId: string
  productId: string
  quantity: number
  occupiedFrom: string
  occupiedUntil: string
  status: string
  holdExpiresAt: string | null
}

export interface CreateRentalOrderResult {
  order: RentalOrderSummary
  quantityReservations: QuantityReservationSummary[]
}

export interface PaginatedRentalOrdersResult {
  items: RentalOrderSummary[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
}

export interface RentalPaymentResult {
  paymentRef: string
  status: string
  nextAction: { type: string } | null
  expiresAt: string | null
  amount: number
  refundedAmount?: number
  paidAt?: string | null
  invoiceStatus?: string | null
  applicationStatus?: string | null
  applicationReasonCode?: string | null
  reconciliationStatus?: string | null
  reconciliationRequired?: boolean
  gateway?: string | null
  providerEnvironment?: string | null
  paymentMethod?: string | null
  orderStatus?: string
  financialStatus?: string
}

export interface RentalCancellationPreviewResult {
  canCancel: boolean
  feeRefund: number
  depositRefund: number
  reason: string
  previewVersion: string
}

export interface CancelRentalOrderResult {
  order: RentalOrderSummary
  refund: null | {
    refundRef: string
    amount: number
    status: string
  }
  quantityReleaseStatus: string
}

export const RENTAL_ORDER_PORT = Symbol('RENTAL_ORDER_PORT')

export interface RentalOrderPort {
  createOrder(command: CreateRentalOrderCommand): Promise<CreateRentalOrderResult>
  listOrders(query: ListRentalOrdersQuery): Promise<PaginatedRentalOrdersResult>
  getOrder(query: GetRentalOrderQuery): Promise<Record<string, unknown>>
  getPayment(query: GetRentalPaymentQuery): Promise<RentalPaymentResult>
  previewCancellation(query: PreviewRentalCancellationQuery): Promise<RentalCancellationPreviewResult>
  cancelOrder(command: CancelRentalOrderCommand): Promise<CancelRentalOrderResult>
  processPaymentEvent(command: RentalPaymentEventCommand): Promise<void>
  expirePendingOrders(now: Date): Promise<number>
}
