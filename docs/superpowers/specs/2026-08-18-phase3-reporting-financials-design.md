# Phase 3: Reporting & Financials — Design

**Status:** Approved for planning
**Date:** 2026-08-18
**Parent spec:** `docs/superpowers/specs/2026-08-15-phase1-foundation-core-ops-design.md` §2 (roadmap), §4 (architecture rule of thumb for new services). Grounded in `Requirments/BimBa-Pro-Functional-Requirements dashboard and mobile.html` §10 (Operational Reports), §11 (Appointment Reports), §12 (Cancellation Reports), and the payment-flow detail in §18 (REQ-DAM-14 through REQ-DAM-18).

## 1. Scope

Two distinct pieces:

- **Reporting** (ref §10-12) — six read-only, date-ranged, exportable ledgers: branch appointment list, wallet transaction list, OTP audit, payment-gateway transaction list, appointment swap/reschedule log, therapist progress report, plus split appointment views (therapist/doctor/unified) and cancellation views (branch-scoped, parent-card summary).
- **Financials** — a real money domain BimBa doesn't currently expose to this product's design: parent wallet balance, payment gateway integration, and the transaction ledger backing both.

## 2. Service Placement

- **Reports → new endpoints on the services that already own the data, not a new service.** Appointment/cancellation/swap reports are read-shaped queries over `SchedulingApi`'s existing `Appointment` table; the therapist progress report is the same data joined against `DirectoryApi`'s `Therapist`. Standing up a separate "Reporting API" to re-derive data two other services already own would be duplication with no resale/isolation justification per the architecture rule of thumb (§4 of the Phase 1 doc). Each report becomes a new `GET` endpoint on its natural owning service.
- **Financials → a new service, `BillingApi`.** Wallet balances and payment-gateway transactions are (a) materially more sensitive than the platform's other data (financial, PCI-adjacent) and (b) a plausible standalone resale/compliance boundary — both tests from the Phase 1 architecture rule of thumb say split it out, the same reasoning that justified `ClientRecordsApi`'s existence for PII. `BillingApi` gets its own Azure SQL database, following the established per-service pattern.

## 3. Data Model Summary

**`BillingApi`** (new service)
- `Wallet` — TenantId, ParentId, Balance
- `WalletTransaction` — TenantId, WalletId, Type (Credit/Debit), Amount, RelatedAppointmentId (nullable), CreatedAt
- `PaymentGatewayTransaction` — TenantId, OrderId, MerchantReference, Amount, Status, Rail (Card/Netbanking/Wallet/UPI/NEFT-RTGS), RawGatewayPayload

**Reports** — no new persisted entities; new query endpoints on `SchedulingApi` (`GET /appointments/reports/...` shape, exact routes TBD at implementation-planning time) and `DirectoryApi`.

## 4. Deviations from BimBa-Pro

- **Payment gateway integration sits behind an abstraction (`IPaymentGatewayClient`), not a hard dependency on BimBa's specific provider (CCAvenue).** This platform should stay provider-agnostic — the actual gateway choice (CCAvenue, Razorpay, Stripe, PayU) is an implementation-planning decision for `BillingApi`'s own sub-project, not fixed here.
- **Money-movement operations reuse the execution-strategy-safe-transaction pattern already established in `DirectoryApi`/`SchedulingApi`** (`CreateExecutionStrategy().ExecuteAsync(...)`, `ChangeTracker.Clear()` inside retried delegates) — doubly important here since a duplicate wallet credit/debit is a real financial correctness bug, not just a data-quality one. Idempotency-key requirements (already a platform-wide Global Constraint for write endpoints) apply with extra weight to every `BillingApi` write.
- **This platform closes Phase 2's refund-approval loop here.** A `RefundRequest` approved in Phase 2 (`DirectoryApi` or wherever it lands) triggers an actual `WalletTransaction` credit once `BillingApi` exists — the cross-service call direction and exact trigger mechanism (event, direct call, or a manual reconciliation step) is an open question for that sub-project.

## 5. Open Questions

- **PCI/compliance scope.** The reference material's payment flow always hands off to a hosted checkout page (never collects raw card data in-app) — if this platform does the same, PCI scope stays minimal. Worth confirming explicitly as a design decision before `BillingApi`'s implementation, not assumed.
- **Payment gateway provider choice** — deferred to that sub-project's brainstorm.
- **Refund-approval-to-wallet-credit trigger mechanism** — deferred to that sub-project's brainstorm, once both `RefundRequest` (Phase 2) and `Wallet` (this phase) exist to connect.
