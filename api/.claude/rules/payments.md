---
paths:
  - "src/modules/payments/**"
  - "src/modules/rental/payments/**"
  - "src/modules/bookings/**payment*"
  - "test/cf02*"
  - "test/*payment*"
  - "api/src/modules/payments/**"
  - "api/src/modules/rental/payments/**"
  - "api/src/modules/bookings/**payment*"
  - "api/test/cf02*"
  - "api/test/*payment*"
---

# Payments (`payments`), shared by booking, trail access, rental and extension

- An `Invoice` (`BOOKING | TRAIL_ACCESS | RENTAL`) has many `Payment` attempts. Each successful payment has one `PaymentApplication` (`PENDING → APPLIED | REJECTED`), and `Refund` rows carry a `RefundPurpose`.
- **Checkout:** `PaymentsService.createCheckout` is idempotent per key. It refuses a second payment while one is `PENDING/PROCESSING` or after one has `SUCCEEDED`. It calls the provider through `PaymentProviderRouter`: mock, MoMo, or VNPay, chosen by `PAYMENT_PROVIDER` and `PAYMENT_PROVIDER_ENVIRONMENT`. Mock checkouts are confirmed with `POST payments/:paymentId/mock-confirm`.
- **Webhook inbox:**
  - `POST payments/webhooks/{momo,mock}` and `GET payments/webhooks/vnpay` (IPN) verify the signature using `rawBody`, then store a `payment_webhook_events` row.
  - `PaymentEventsWorker` (1s) calls `PaymentWebhooksService.process`, which locks invoice and payment, sets the payment `SUCCEEDED`, creates the `PaymentApplication(PENDING)`, and writes `PAYMENT_SUCCEEDED`.
  - The same worker routes that event by invoice type: `BookingPaymentConsumer`, `RentalPaymentConsumer`, or `ApplyTrailPaymentUseCase`.
  - After 7 failed attempts a row becomes `NEEDS_REVIEW`.
- **Recovery & reversal:**
  - `PaymentRecoveryService` (2s) re-queries the provider for stale payments and refunds. Admins can trigger `admin/payments/:id/reconcile` and `admin/refunds/:id/reconcile`.
  - `TechnicalReversalWorker` refunds payments whose application was `REJECTED`.
  - `RefundsService.requestRefund` reserves the refund amount and calls the provider. Refund webhooks come back through the same inbox.
  - The sandbox refund simulation (`PAYMENT_SANDBOX_REFUND_SIMULATION_*`) is for demos only.
- `user/transactions` and `PaymentHistoryService` provide the user-facing payment history.
