# BillingApi Wallet Foundation — Design

**Status:** Approved for planning
**Date:** 2026-08-19
**Parent spec:** `docs/superpowers/specs/2026-08-18-phase3-reporting-financials-design.md` §2-3, §5 (resolves the "refund-approval-to-wallet-credit trigger mechanism" open question). Grounded in `Requirments/BimBa-Pro-Functional-Requirements dashboard and mobile.html` §18 (REQ-DAM-14 through REQ-DAM-18).

## 1. Scope

The first of three Phase 3 sub-projects (split for the same YAGNI/focus reasons Activity Desk Remainder was split into three plans):

1. **This sub-project — Wallet Foundation:** stand up `BillingApi` as a new service, with `Wallet` (balance per parent) and `WalletTransaction` (the ledger), plus the cross-service wiring that closes Phase 2's refund-approval loop — approving a `RefundRequest` on `SchedulingApi` now actually credits the parent's wallet.
2. **Deferred to its own sub-project — Payment Gateway Integration:** `PaymentGatewayTransaction`, `IPaymentGatewayClient` abstraction, checkout-initiate/callback endpoints. Not needed to close the refund loop, and the gateway-provider choice is a real design decision (Phase 3 spec §5) that deserves its own focused brainstorm rather than being rushed here.
3. **Deferred to its own sub-project — Reports:** the six read-only ledgers (Phase 3 spec §1). Pure read-shaped endpoints on already-existing services, no new entities, lowest risk — sequenced last.

## 2. Service Placement (confirmed from parent spec)

`BillingApi` is a new service with its own Azure SQL database, following the established per-service pattern (`DirectoryApi`, `SchedulingApi`, `ClientRecordsApi`). Financial data is materially more sensitive than the rest of the platform's data and is a plausible standalone resale/compliance boundary — the same two tests that justified `ClientRecordsApi`'s existence.

## 3. Data Model

**`Wallet`** (BillingApi, tenant-scoped)
| Field | Type | Notes |
|---|---|---|
| Id | Guid (PK) | |
| TenantId | Guid | |
| ParentId | Guid | **not FK-validated** — `Parent` lives in `ClientRecordsApi`, a different service/database, same reasoning as `SupportTicket.RequesterId` in Phase 2 |
| Balance | decimal(10,2) | denormalized running balance, kept in sync with `WalletTransaction` inserts inside the same transaction — never computed ad hoc from the ledger, to keep balance reads cheap |
| CreatedAt | DateTimeOffset | |

Unique index on `(TenantId, ParentId)` — one wallet per parent per tenant. A wallet is created lazily: the first credit/debit against a `ParentId` that has no wallet yet creates one with a zero starting balance, rather than requiring a separate explicit "open a wallet" step BimBa-Pro doesn't call out either.

**`WalletTransaction`** (BillingApi, tenant-scoped)
| Field | Type | Notes |
|---|---|---|
| Id | Guid (PK) | |
| TenantId | Guid | |
| WalletId | Guid (FK, same-service) | |
| Type | enum: Credit / Debit | |
| Amount | decimal(10,2) | always positive; `Type` carries the sign |
| RelatedAppointmentId | Guid? | nullable — set when a transaction originates from a specific appointment/refund; null for a manual adjustment |
| Reason | string, required | free-text audit note (e.g. `"Refund approved for appointment {id}"`, `"Manual credit by staff"`) |
| CreatedAt | DateTimeOffset | |

The ledger is **append-only** — no `PUT`/`DELETE` on `WalletTransaction`. Correcting a mistaken transaction means posting an offsetting entry, not editing history — standard ledger practice, and consistent with this platform's existing preference for explicit state transitions over silent mutation (e.g. refund/leave-request approval flows never edit a decided record, they only allow acting on `Pending` ones).

## 4. API

**`BillingApi`** (new service)
| Method | Path | Notes |
|---|---|---|
| GET | `/wallets/{parentId}` | returns balance; `404` if no wallet exists yet for that `ParentId` (nothing to lazily create on a pure read) |
| GET | `/wallets/{parentId}/transactions` | paginated ledger for one parent, filterable by `type` |
| POST | `/wallets/{parentId}/credit` | body: `{ amount, reason, relatedAppointmentId? }` — lazily creates the wallet if absent, inserts a `Credit` transaction, increments `Balance`, all in one transaction |
| POST | `/wallets/{parentId}/debit` | body: `{ amount, reason, relatedAppointmentId? }` — `409` if `Balance < Amount` (no negative balances); lazily creates the wallet if absent (a debit against a nonexistent wallet is a `409` too, since a zero-balance wallet can't cover any positive debit) |

Every write endpoint requires the platform-wide `Idempotency-Key` header (Global Constraint, carried over from `SchedulingApi`'s established pattern) — money movement makes a duplicate-request bug materially worse than anywhere else on the platform.

**`SchedulingApi` change:** `POST /refund-requests/{id}/approve` now calls `BillingApi`'s `POST /wallets/{parentId}/credit` as part of approval. This requires `SchedulingApi` to know the refund's `ParentId` — `RefundRequest` currently only stores `AppointmentId`/`AppointmentType`, so the approve handler resolves `ParentId` by loading the underlying `Appointment`/`DoctorAppointment` (both already store `ChildId`, and `Child` has a `ParentId` — the approve handler needs `IClientRecordsApiClient` to resolve `Child → ParentId`, extending the client interface already established in the original booking-engine sub-project).

**Cross-service failure semantics — deliberately NOT fail-open.** Every other cross-service check on this platform (`IsBranchClosedAsync`, `IsTherapistOnLeaveAsync`) fails open: a downstream outage lets the write through, because the check is advisory (worst case, a booking wasn't blocked that should have been). Money movement is the opposite: if the `BillingApi` credit call fails or times out, `POST /refund-requests/{id}/approve` must **not** flip `Status` to `Approved` — it returns `502 Bad Gateway` and leaves the refund request `Pending`, so staff can retry the approval. Silently marking a refund "Approved" while the wallet credit never happened would be a real financial-integrity bug, not a minor UX gap. This is a new, explicit exception to the platform's established fail-open convention — documented here so it isn't "corrected" back to fail-open by pattern-matching against the other cross-service calls later.

**Idempotency across the two calls — UPDATED during implementation (2026-08-19 review fix round), superseding the paragraph originally here.** The `Idempotency-Key` header on `POST /refund-requests/{id}/approve` is still required and validated (presence, ≤200 chars) — but it is **not** forwarded downstream. Instead, `SchedulingApi` derives the key it sends to `BillingApi` from the refund's own identity: `$"refund-approve:{refundRequest.Id}"`. The original forward-the-client-key design was found during review to allow two real money-safety bugs: (1) **split-brain** — a client that ever reused one key across two different refund approvals (same parent/amount is a realistic collision, e.g. two identical cancelled sessions) would get `BillingApi`'s replay match on the *old* transaction for the *second, unrelated* refund, which `SchedulingApi` would then mark `Approved` with zero actual credit; (2) **double-credit** — two concurrent `POST /approve` calls for the *same* refund, using two different client-supplied keys, would each get a real, distinct credit. Deriving the key from `refundRequest.Id` instead makes "at most one real credit per refund approval" structural: every call (retry or concurrent) for the same refund now always hits the identical downstream key, so `BillingApi`'s own uniqueness index and idempotency-replay-with-match-checking collapse them into exactly one credit. `SchedulingApi`'s own `Status`-flip is additionally guarded to only succeed from `Pending` (an atomic conditional update), closing the harmless-but-sloppy race of two concurrent approvals both writing `Approved`. The client-supplied `Idempotency-Key` on the approve endpoint itself is currently vestigial (validated but not used for anything functional) — left in place rather than removed, since requiring it costs nothing and it may become useful again if a future design needs per-client-request tracking independent of the refund's own identity.

**Known residual gap, deliberately not closed in this sub-project (flagged in `DEFERRED-AND-TODO.md`):** if a credit call times out from `SchedulingApi`'s perspective but actually committed on `BillingApi`'s side, the refund correctly stays `Pending` and a *retry of the same approve call* is safe (idempotent replay, no double-credit). But nothing currently stops a human operator from instead **rejecting** the still-`Pending` refund and creating a **new** refund request for the same appointment (the create-endpoint's duplicate-guard treats `Rejected` as free-to-recreate) — that new refund has a different `Id`, hence a different derived key, hence a genuine second credit on approval. Closing this properly needs either an `AttemptedCredit`/`CreditConfirmedAt` field on `RefundRequest` that the reject/create-duplicate-guard endpoints can check, or a reconciliation flow — real design work, deliberately deferred rather than rushed into a review fix wave.

## 5. New-Service Scaffolding

`BillingApi` mirrors `ClientRecordsApi`'s original scaffolding exactly: ASP.NET Core 9 Minimal API project at `services/billing-api/BillingApi/`, own `BillingDbContext` + Azure SQL/LocalDB database, `TenantIdMiddleware` reading the same `X-Tenant-Id` stub header (real auth still deferred to the project's last phase — no change to that standing decision here), RFC 7807 `ProblemDetails` throughout, `DataAnnotationsValidator`, `PagedResult<T>`, `db.Database.Migrate()` on startup (matching every other service's current — already-flagged-as-🟡 — approach). Test project `services/billing-api/BillingApi.Tests/` using the same `LocalDbTestFixture` pattern, with a `FakeClientRecordsApiClient` mirroring the fakes already used in `SchedulingApi.Tests`.

## 6. Error Handling & Testing

RFC 7807 throughout. `Balance` never goes negative (enforced at the debit endpoint, not just trusted from the caller). Per the 2026-08-19 test-writing-deferral policy, this plan's implementation phase does not write new `[Fact]`s — but because this is genuinely risky/architectural work (new service, first real money movement, non-fail-open cross-service semantics), it gets full un-batched SDD rigor at the *implementation* level (task-by-task review, no hybrid batching) even without new tests, and is the top candidate for the eventual consolidated test-writing pass to cover first.

## 7. Open Questions Carried Forward (not resolved here, by design)

- Payment gateway provider choice and `PaymentGatewayTransaction` — next sub-project.
- Reports — sub-project after that.
