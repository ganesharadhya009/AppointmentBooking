# SchedulingApi Today Summary (Phase 6) — Design

**Status:** Approved for planning
**Date:** 2026-08-20
**Parent spec:** `docs/superpowers/specs/2026-08-18-phase6-staff-app-backend-design.md` — the entire phase's backend scope is this one endpoint (§1: "the only plausibly new backend surface"). Phase 5 is skipped for now — its parent-auth-vs-deferred-auth tension (§4 of that spec) is a genuine blocker, not something to route around, so this session moves to Phase 6/7 instead per user direction.

**Review mode:** single sonnet-tier reviewer, no separate final whole-branch review — per the 2026-08-20 cost checkpoint. Read-only aggregation, no new entity, no money, no concurrency.

## 1. Scope

One KPI aggregation endpoint for the staff (Doctor & Admin) app: today's upcoming, completed, and cancelled appointment counts (both therapist and doctor appointments), plus a count of staff on approved leave today.

## 2. Service Placement

`GET /appointments/today-summary` on `SchedulingApi` — it already owns `Appointment`/`DoctorAppointment`. The leave count requires a new small cross-service query to `DirectoryApi` (which owns `LeaveRequest`), via the existing `IDirectoryApiClient` pattern.

## 3. New Cross-Service Surface

**`DirectoryApi`:** `GET /leave-requests/active-count?date=` — returns `{ activeCount: int }`, counting `Approved` leave requests where `StartDate <= date <= EndDate`. Tenant-scoped via the existing query filter on `LeaveRequest`. This is a new endpoint because the existing `GET /leave-requests/is-on-leave` checks one specific therapist, and the existing `GET /leave-requests` list has no date-range filter — neither shape fits "how many staff, total, are on leave today."

**`IDirectoryApiClient`** (`SchedulingApi`) gains `GetActiveLeaveCountAsync(DateOnly date, Guid tenantId) : Task<int?>` — nullable, **fail-open on failure** (returns `null`, not an exception), matching the existing `IsBranchClosedAsync`/`IsTherapistOnLeaveAsync` pattern. This is informational-KPI-display data, not a booking gate, so a `DirectoryApi` outage degrading the summary to "0 on leave" (treating `null` as `0`) is an acceptable, documented simplification — nothing here blocks or approves a write.

## 4. Response Shape

```csharp
public class TodaySummaryResponse
{
    public int UpcomingCount { get; set; }
    public int CompletedCount { get; set; }
    public int CancelledCount { get; set; }
    public int OnLeaveCount { get; set; }
}
```

`UpcomingCount`/`CompletedCount`/`CancelledCount` each sum across both `Appointment` and `DoctorAppointment` for `AppointmentDate == today` — `Planned`/`Completed`/`Cancelled` respectively (the `AppointmentStatus` enum is already shared between both entities, per an earlier session decision). "Today" is `DateOnly.FromDateTime(DateTimeOffset.UtcNow.DateTime)` — server UTC, not tenant/branch-local time. No other endpoint on this platform does timezone-aware "today" calculation either; tracked as a known simplification in `DEFERRED-AND-TODO.md`, not solved here.

## 5. Error Handling & Testing

RFC 7807 not really implicated (no validation surface — the endpoint takes no required input). Per the standing 2026-08-19 test-deferral policy, no new `[Fact]` tests in this plan.
