# BillingApi Payment Gateway Integration — Design

**Status:** Approved for planning
**Date:** 2026-08-20
**Parent spec:** `docs/superpowers/specs/2026-08-18-phase3-reporting-financials-design.md` §1-5 (resolves the "payment gateway provider choice" open question). `docs/superpowers/specs/2026-08-19-billing-api-wallet-foundation-design.md` (this sub-project builds directly on `BillingApi`'s already-shipped `Wallet`/`WalletTransaction`). Grounded in `Requirments/BimBa-Pro-Functional-Requirements dashboard and mobile.html` §18 (REQ-DAM-14 through REQ-DAM-18 — hosted-checkout payment flow, multiple rails).

**Review mode for this sub-project:** per the 2026-08-20 cost checkpoint (see `[[always-subagent-driven]]`), this gets single sonnet-tier review per task, no opus, no separate final whole-branch review — it reuses the already-hardened wallet-credit path rather than introducing new money-movement logic from scratch, and the gateway itself is a stub (no real external dependency/API keys), so it isn't a new risk surface the way `BillingApi`'s original wallet foundation was.

## 1. Scope

A parent-initiated wallet top-up flow: `POST /payment-checkouts` starts a hosted-checkout-style payment, `POST /payment-checkouts/{id}/callback` simulates the gateway's webhook completing it, and on success the parent's wallet is credited — reusing the exact atomic credit logic already built and reviewed in the Wallet Foundation sub-project, not reimplemented.

**Deliberately out of scope (YAGNI, not needed to close this loop):**
- A real payment gateway provider (Razorpay/Stripe/CCAvenue/etc.) — `IPaymentGatewayClient` is the abstraction point; a real implementation is a future swap-in, not part of this sub-project.
- Direct appointment payment without a wallet — BimBa's flow always tops up a wallet first (REQ-DAM framing); paying an appointment fee directly from a card is not modeled here.
- Refunding a payment gateway transaction back to the original payment method — money only ever flows into the platform's wallet in this design; refunds already have their own path (`RefundRequest` → wallet credit, built in the prior sub-project).

## 2. Service Placement

`BillingApi` — same service as `Wallet`/`WalletTransaction`. Payment gateway transactions are the same sensitivity class (financial, PCI-adjacent) and directly produce wallet credits, so splitting them into a separate service would just add a network hop with no isolation benefit.

## 3. PCI Scope (resolved — carried over from the parent spec's open question)

**Confirmed: hosted checkout only, this platform never touches raw card/bank data.** `IPaymentGatewayClient.InitiateCheckoutAsync` returns a `CheckoutUrl` the caller (eventually the Admin SPA / parent-facing app) redirects the browser to — a real gateway's own hosted page collects payment details there, never inside this platform's request/response bodies. `PaymentGatewayTransaction.RawGatewayPayload` stores only the gateway's own status/reference payload (opaque JSON), never raw payment instrument data. This keeps PCI scope minimal by construction, not by convention — there is no field anywhere in this design that a card number could be put into.

## 4. Data Model

**`PaymentGatewayTransaction`** (BillingApi, tenant-scoped)
| Field | Type | Notes |
|---|---|---|
| Id | Guid (PK) | |
| TenantId | Guid | |
| ParentId | Guid | not FK-validated, same reasoning as `Wallet.ParentId` |
| Amount | decimal(10,2) | `[Range(0.01, 99999999.99)]`, matching `Wallet`'s existing money-field convention |
| Rail | enum: Card / Netbanking / Wallet / Upi / NeftRtgs | matches REQ-DAM's listed payment methods; informational — which method the parent picked at checkout-initiation time |
| Status | enum: Initiated / Success / Failed | starts `Initiated`; the callback is the only thing that ever moves it, and only ever from `Initiated` |
| MerchantReference | string, required | the gateway's own reference for this checkout session, returned by `IPaymentGatewayClient.InitiateCheckoutAsync` |
| RawGatewayPayload | string? | opaque JSON the callback receives from the "gateway" (in the stub's case, whatever the caller sends); never contains raw payment-instrument data (§3) |
| CreatedAt | DateTimeOffset | |
| CompletedAt | DateTimeOffset? | set when the callback moves `Status` out of `Initiated` |

**Append-only in the same sense as `WalletTransaction`**: no generic `PUT`. The one state transition (`Initiated` → `Success`/`Failed`) happens exclusively through the callback endpoint, and only once — see §6.

## 5. Gateway Abstraction

```csharp
public interface IPaymentGatewayClient
{
    Task<GatewayCheckoutSession> InitiateCheckoutAsync(Guid transactionId, decimal amount, PaymentRail rail, CancellationToken cancellationToken = default);
}

public class GatewayCheckoutSession
{
    public required string MerchantReference { get; set; }
    public required string CheckoutUrl { get; set; }
}
```

**`StubPaymentGatewayClient`** is the only implementation for now — generates a fake `MerchantReference` and a clearly-fake `CheckoutUrl` (`https://stub-gateway.local/checkout/{merchantReference}`), entirely in-process, no real HTTP call anywhere. This mirrors the platform's established pattern of shipping a working, swappable stub for a not-yet-chosen external dependency (the AI service's rule-based ranking stood in the same relationship to a future real ranking model). Swapping in a real provider later means implementing this one interface and changing one DI registration line in `Program.cs` — nothing else in this design depends on which implementation is active.

## 6. API

| Method | Path | Notes |
|---|---|---|
| POST | `/payment-checkouts` | body: `{ parentId, amount, rail }` — creates the transaction (`Status = Initiated`), calls `IPaymentGatewayClient.InitiateCheckoutAsync`, stores the returned `MerchantReference`, returns `{ id, checkoutUrl, merchantReference, status }` |
| GET | `/payment-checkouts/{id}` | status lookup |
| GET | `/payment-checkouts` | paginated, filterable by `status`/`parentId` |
| POST | `/payment-checkouts/{id}/callback` | body: `{ status: Success \| Failed, rawPayload }` — simulates the gateway's webhook |

**Callback idempotency — no header needed, the transaction's own state is the guard.** Unlike the refund-approval flow (which calls *out* to another service and needs a client-supplied `Idempotency-Key` to make retries safe), this endpoint is itself the inbound target of a webhook a real gateway may legitimately redeliver. The fix is simpler here: if the transaction is already in a terminal state (`Success` or `Failed`) when the callback arrives, return the current state as a no-op `200` without reprocessing — never re-run the credit logic for an already-`Success` transaction. Only a transaction still `Initiated` gets processed.

**On `Success`:** within one local database transaction (same service, same database — no cross-service call, unlike refund approval, so none of the non-fail-open machinery from that sub-project is needed here): update `PaymentGatewayTransaction.Status = Success` + `CompletedAt` + `RawGatewayPayload`, and call the shared wallet-credit logic (§7) with an idempotency key derived from this transaction's own identity: `$"payment-checkout:{transaction.Id}"`. Both writes commit together or neither does.

**On `Failed`:** update `Status = Failed` + `CompletedAt` + `RawGatewayPayload`. No wallet credit.

## 7. Reused Wallet-Credit Logic (extraction, not reimplementation)

`WalletEndpoints.cs`'s `POST /{parentId}/credit` handler already contains carefully-reviewed atomic credit logic (single-statement `ExecuteUpdateAsync` balance update to avoid the lost-update race found in the Wallet Foundation review, execution-strategy-safe transaction wrapping, idempotency-key replay-with-match-checking, the wallet-creation-race retry). This sub-project's implementation plan extracts that logic into a shared internal method (e.g. a `WalletCreditService` class) that both the existing `POST /credit` endpoint and the new payment-checkout callback call — **not** a second copy of the same money-movement logic. This is the concrete reason this sub-project doesn't need the same review depth as the original: the risky code isn't being written again, it's being reused.

## 8. Error Handling & Testing

RFC 7807 throughout. Per the standing 2026-08-19 test-deferral policy, no new `[Fact]` tests in this plan — same acceptance bar as every sub-project since (builds clean, existing suite passes unchanged). Tracked in `DEFERRED-AND-TODO.md`'s 🔴 tier alongside the rest of `BillingApi`.
