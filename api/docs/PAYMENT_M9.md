# M9 — MoMo sandbox adapter

## Status

Implemented the sandbox adapter and automated wire-contract/real-PostgreSQL integration tests. **Live MoMo acceptance is pending**: this workspace has no configured MoMo sandbox credentials or public callback URL. Stubbed HTTPS tests are not evidence of a successful transaction on MoMo. No production gateway is enabled; no M9 schema migration is required.

## Integration

- Select `PAYMENT_PROVIDER=mock` (default) or `momo`. Unknown values fail startup. Mock remains available for local development and automated tests.
- MoMo requires `PAYMENT_PROVIDER_ENVIRONMENT=SANDBOX`; its HTTPS endpoint is pinned to `test-payment.momo.vn`. Credentials use `MOMO_SANDBOX_*`. Merchant scope is the actual partner code, preventing accidental merging of different merchants under a reused alias.
- Create uses `captureWallet`, automatic capture, stable order/request identity and signed server-side amounts. A successful create only supplies checkout data; it does not confirm an invoice, booking, access grant or rental.
- Internal `payment:<uuid>` / `refund:<uuid>` references map to `payment-<uuid>` / `refund-<uuid>`. Query calls use fresh request IDs. Financial retries keep the original reference. Configuration affecting request bodies (URLs, partner, order text) must stay stable while attempts are open.
- Refund looks up the scoped persisted refund/payment, uses the original successful provider transaction and validates the reserved amount. Refund query selects exactly the matching refund order, not the aggregate result of unrelated refund entries.
- Payment IPN: `POST /api/v1/payments/webhooks/momo`. HMAC-SHA256 is checked with constant-time comparison; partner, request and order are validated. ACK is **204 with no body only after durable inbox intake**. Invalid signatures receive the shared 401 error envelope; storage failure receives 503 so MoMo can retry. Mock and MoMo routes reject the wrong active provider.
- MoMo does not supply a standalone event ID here. The fallback hashes order, transaction, result code and response time. Normalized payload hashing tolerates JSON whitespace/key order while preserving financial-payload conflict detection. Delayed authentic IPNs remain eligible for the existing late-payment/reversal rules.
- Inbox processing accepts verified provider-scoped events. Existing Booking/Trail/Rental consumers and financial exposure constraints remain unchanged. The only Rental checkout adjustment makes the mock production guard conditional on a MOCK scope.
- Only code 0 proves collection/refund success. Pending/authorization codes remain processing; unknown, authentication and transport errors remain UNKNOWN. This conservative handling requires a later confirmed result before domain application. Redirect-return parameters never establish financial truth.

## Configure and run

1. Fill the private `api/.env` using `momo-sandbox.env.example`. Do not put real credentials in committed files or chat. Obtain sandbox credentials and a MoMo Test account through the merchant portal.
2. Point the IPN URL to this API's public HTTPS route. Configure the redirect URL to the application's return page; that page should load the authenticated payment/source status from the API. M9 does not add a frontend return page.
3. Restart the API. Missing credentials, non-HTTPS URLs, production environment or unsafe timeout/lease settings fail startup.
4. Create a Booking/Trail/Rental checkout through the existing authenticated endpoint using an idempotency key. Use a whole-VND amount supported by the provider. Pay with MoMo Test and verify the persisted SANDBOX-scoped result.
5. Keep each deployment on one provider/merchant. Before changing provider or partner, drain open attempts/refunds or keep the old deployment/credentials and callback route available for reconciliation. Do not relabel existing rows. Domain outbox processing may finish previously verified events regardless of the currently selected provider.

MoMo transport timeout is 30 seconds; the shared call budget defaults to 35 seconds and recovery lease to 120 seconds when MoMo is selected. The lease must exceed three call budgets plus five seconds because recovery may query, resubmit, then query again. Existing retry interval/max attempts default to 30 seconds/eight; unresolved work becomes NEEDS_REVIEW. These are operator settings, not a guarantee of completion within that interval.

The adapter uses a conservative 30-day window for NOT_FOUND resubmission and refund submission. Older records stay unresolved for review rather than risking a second financial operation after provider idempotency retention. Supported wallet payment/refund range is 1,000–50,000,000 VND. Out-of-range amounts remain unresolved for operator review; do not round, split, mark paid/refunded or silently write off such amounts. BNPL/card-specific refund groups are outside this adapter.

## Reporting isolation

Always filter/group by gateway, environment **and** merchant account. Never include SANDBOX or MOCK in production revenue. Example read-only report (separate aggregates avoid multiplying payment totals by refund joins):

```sql
SELECT payment_gateway, provider_environment, merchant_account_key,
       'COLLECTION' AS kind, status::text, currency, count(*) AS attempts, sum(amount) AS amount
FROM payments
WHERE provider_environment = 'SANDBOX' AND payment_gateway = 'momo'
GROUP BY payment_gateway, provider_environment, merchant_account_key, status, currency
UNION ALL
SELECT payment_gateway, provider_environment, merchant_account_key,
       'REFUND', status::text, currency, count(*), sum(amount)
FROM refunds
WHERE provider_environment = 'SANDBOX' AND payment_gateway = 'momo'
GROUP BY payment_gateway, provider_environment, merchant_account_key, status, currency;
```

## Acceptance still requiring the sandbox account

- Create a real sandbox checkout; retain its order/payment ID and verify its QR/redirect with MoMo Test.
- Confirm an authenticated IPN reaches the public URL and receives 204, then verify one financial result and one domain application after replay.
- Suppress/delay IPN in a controlled sandbox deployment and use the existing admin reconcile endpoint; verify query recovers the same payment without a second collection.
- Request a supported approved refund through the existing source decision, run recovery, then verify refund/query and one REFUND_SUCCEEDED event. Repeat with an interrupted response; confirm no second refund order.
- Record actual PSP IDs, test date and observed result in the release evidence, without credentials. Do not mark M9 live acceptance complete before these pass.

## Automated verification

Verified on 2026-10-06: **82/82 tests passed** (71 PostgreSQL integration tests including the two M9 flows, plus 11 MoMo wire-contract tests). API build and `git diff --check` passed. Provider HTTPS was stubbed; no live MoMo transaction was executed.

`npm run test:payments` includes MoMo signing, pending/error mapping, tampering, scope/amount restrictions, idempotency-window and refund-query matching tests. With `PAYMENT_TEST_DATABASE_URL` set to an isolated localhost `payment_test_*` database, it also runs all M1–M8 regressions and M9 HTTP/inbox/reconcile/refund flows against PostgreSQL, stubbing only provider HTTPS. Test databases must already have the project migrations.

## Official references

- [Wallet create and IPN signature](https://developers.momo.vn/v3/docs/payment/api/wallet/onetime/)
- [Query](https://developers.momo.vn/v3/docs/payment/api/payment-api/query/)
- [Refund and refund query](https://developers.momo.vn/v3/docs/payment/api/payment-api/refund/)
- [IPN acknowledgment](https://developers.momo.vn/v3/docs/payment/api/result-handling/notification/)
- [Idempotency](https://developers.momo.vn/v3/docs/payment/api/result-handling/idempotency/)
- [Result codes](https://developers.momo.vn/v3/docs/payment/api/result-handling/resultcode/)
