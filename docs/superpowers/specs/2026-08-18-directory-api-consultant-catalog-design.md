# Directory API — Consultant Catalog — Design

**Status:** Approved for planning
**Date:** 2026-08-18
**Parent spec:** `docs/superpowers/specs/2026-08-18-phase2-front-of-house-extensions-design.md` §2-3, resolved further per `appointmentbooking-project` memory's architecture decision (2026-08-18): catalog on `DirectoryApi`, doctor appointments as a separate entity on `SchedulingApi` (own sub-project, follow-up to this one). Grounded in `Requirments/BimBa-Pro-Functional-Requirements dashboard and mobile.html` §07 (REQ-CN-01 through 03).

## 1. Scope

A parallel, lighter-weight catalog for external consulting doctors operating out of partner clinics, modeled as three linked entities on `DirectoryApi`: `ConsultantService` (the specialty, e.g. Paediatry/ENT/Psychiatric Consultation), `ConsultantClinic` (the partner hospital/clinic), `ConsultantDoctor` (links one doctor to one service and one clinic). This sub-project covers the catalog only — booking (`DoctorAppointment` on `SchedulingApi`) is a separate, follow-up sub-project, matching how `TherapyType`/`Therapist` (catalog) preceded the Core Appointment Booking Engine.

## 2. Data Model

**`ConsultantService`** (tenant-scoped)
| Field | Type | Notes |
|---|---|---|
| Id | Guid (PK) | |
| TenantId | Guid | |
| Name | string, required, max 200 | e.g. "Paediatry" |
| PhotoUrl | string? | URL reference only, no upload logic — matches `Therapist.PhotoUrl`'s precedent |
| Status | enum: Active / Inactive | REQ-CN-01's "Active/Inactive toggle" — no `Deleted` tier, unlike `TherapyType`; nothing in the reference material shows a soft-delete-with-history need here, and no other entity references a `ConsultantService` by ID yet (that only starts with `ConsultantDoctor`, handled by validating the reference at creation, not by keeping deleted rows around) |

**`ConsultantClinic`** (tenant-scoped)
| Field | Type | Notes |
|---|---|---|
| Id | Guid (PK) | |
| TenantId | Guid | |
| Name | string, required, max 200 | |
| Address / City / State / Country | string? | mirrors `Branch`'s existing address fields |
| LeadContactName | string? | |
| LeadContactPhone | string? | |
| Status | enum: Active / Inactive | |

**`ConsultantDoctor`** (tenant-scoped)
| Field | Type | Notes |
|---|---|---|
| Id | Guid (PK) | |
| TenantId | Guid | |
| Name | string, required, max 200 | |
| ConsultantServiceId | Guid (FK) | must resolve to a same-tenant `ConsultantService` |
| ConsultantClinicId | Guid (FK) | must resolve to a same-tenant `ConsultantClinic` |
| ConsultationFee | decimal(10,2) | the reference material doesn't describe a windowed/multi-slot pricing model for doctors the way `TherapistSessionWindow` does for therapists — REQ-DAM's booking-flow detail describes doctor consultations as simpler single-visit bookings, so a single flat fee per doctor is the right level of complexity here, not a per-window schedule |
| Status | enum: Active / Inactive | |

## 3. API

Three independent resource groups, each mirroring the established CRUD shape (`TherapyType`'s pattern — full CRUD, `Active`/`Inactive` status, `PagedResult<T>` list):

| Method | Path | Notes |
|---|---|---|
| POST / GET / GET-by-id / PUT / DELETE | `/consultant-services` | `DELETE` sets `Status = Inactive` (soft, matching the reference's toggle framing — not a hard delete like `Holiday`, since a service could plausibly be referenced by an existing `ConsultantDoctor` and needs to stay resolvable for history) |
| POST / GET / GET-by-id / PUT / DELETE | `/consultant-clinics` | filterable by `state`/`city`/`status` per REQ-CN-02; same soft-delete reasoning |
| POST / GET / GET-by-id / PUT / DELETE | `/consultant-doctors` | filterable by `consultantServiceId`/`city`/`status` per REQ-CN-03 (`city` resolved via a join to `ConsultantClinic`, not a field on `ConsultantDoctor` itself); `POST`/`PUT` validate both FK references resolve same-tenant |

## 4. Deviations from BimBa-Pro

- **Two-tier status (Active/Inactive), not three-tier (Active/Inactive/Deleted)** — unlike `TherapyType`, nothing in this catalog is referenced with enough downstream weight yet to need a distinct "soft-deleted, keep for history" state beyond simple deactivation. This can be revisited if the follow-up `DoctorAppointment` sub-project's design surfaces a real need for it.
- **Flat `ConsultationFee`, not a windowed schedule** — a deliberate simplification given the reference material shows no multi-window pricing structure for doctors, unlike therapists' explicit 4-window model.

## 5. Error Handling & Testing

RFC 7807 throughout, matching every existing `DirectoryApi` endpoint. Tests: CRUD + tenant isolation on all three entities; `ConsultantDoctor`'s dual-FK validation rejecting a cross-tenant or nonexistent `ConsultantServiceId`/`ConsultantClinicId`; filter correctness on all three list endpoints.
