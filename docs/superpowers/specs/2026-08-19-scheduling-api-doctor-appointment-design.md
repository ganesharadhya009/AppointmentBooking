# Scheduling API — Doctor Appointment Booking — Design

**Status:** Approved for planning
**Date:** 2026-08-19
**Parent spec:** `docs/superpowers/specs/2026-08-18-directory-api-consultant-catalog-design.md` (the catalog this booking flow validates against), `docs/superpowers/specs/2026-08-18-phase2-front-of-house-extensions-design.md`. Grounded in `Requirments/BimBa-Pro-Functional-Requirements dashboard and mobile.html` §07 (REQ-CN), §11 (REQ-APR-02 Doctor Appointment List), §18/REQ-DAM-11 through 18 ("Book Appointment opens a simpler month-calendar-plus-flat-time-grid picker for a single visit" — the doctor-consultation booking shape, distinct from therapy's windowed package booking).

## 1. Scope

A second, parallel booking flow on `SchedulingApi`: `DoctorAppointment`, distinct from the existing `Appointment` entity (which stays therapist/session-window-only, per the architecture decision already made — see `appointmentbooking-project` memory). Booking a doctor consultation is simpler than booking therapy: no session windows, just a staff-chosen date+time against a flat per-doctor conflict check.

## 2. Data Model

**`DoctorAppointment`** (SchedulingApi, tenant-scoped, own table — not merged with `Appointment`)

| Field | Type | Notes |
|---|---|---|
| Id | Guid (PK) | |
| TenantId | Guid | |
| ConsultantDoctorId | Guid | no live FK possible (different service/database), validated via cross-service call |
| ConsultantClinicId | Guid | denormalized from the doctor's record at booking time (a doctor is linked to exactly one clinic per `ConsultantDoctor`'s design) |
| ConsultantServiceId | Guid | denormalized the same way |
| ChildId | Guid | validated via the existing `IClientRecordsApiClient` |
| AppointmentDate | DateOnly | |
| AppointmentTime | TimeOnly | a single time, not a named window — matches REQ-DAM-13's "simpler...flat-time-grid picker for a single visit" |
| ConsultationFee | decimal(10,2) | denormalized from `ConsultantDoctor.ConsultationFee` at booking time, same reasoning as `Appointment.PricePerSession` — a later fee change shouldn't retroactively alter an already-booked appointment |
| Status | enum: Planned / Completed / Cancelled | same three-state shape as `Appointment.Status` |
| IdempotencyKey | string, unique per tenant | Global Constraint from the Phase 1 parent spec applies to every Scheduling API write endpoint, this one included |
| BookedBy | string | hardcoded `"system"`, matching the rest of the platform |
| CreatedAt | DateTimeOffset | |

## 3. Cross-Service Validation

`IDirectoryApiClient` (already used for `Appointment`'s `Therapist`/`Branch` lookups) gains `GetConsultantDoctorAsync(Guid doctorId, Guid tenantId)`, calling `DirectoryApi`'s existing `GET /consultant-doctors/{id}`. Booking validates: the doctor exists and is `Active`, and (implicitly, since the response carries them) captures `ConsultantClinicId`/`ConsultantServiceId`/`ConsultationFee` for denormalization — no separate clinic/service lookups needed, since `ConsultantDoctor`'s own response already includes both IDs and the fee.

No availability/windows endpoint exists for doctors, unlike `Appointment`'s `GET /availability` — there's no per-doctor schedule calendar in the reference material's data model (§07's "schedule...shortcuts per doctor" is UI-only, not a data structure this platform's design has built). Booking conflict is checked directly: one `DoctorAppointment` per `ConsultantDoctorId` + `AppointmentDate` + `AppointmentTime` (non-cancelled), the same shape as `Appointment`'s slot-conflict check but without the window dimension.

## 4. API

| Method | Path | Notes |
|---|---|---|
| POST | `/doctor-appointments` | requires `Idempotency-Key` header, same contract as `POST /appointments` |
| GET | `/doctor-appointments/{id}` | |
| GET | `/doctor-appointments` | paginated, `{items, page, pageSize, totalCount}` |
| PUT | `/doctor-appointments/{id}` | reschedule (new date/time); re-validates the doctor is still `Active` and re-checks the conflict |
| DELETE | `/doctor-appointments/{id}` | cancels — `Status = Cancelled` |

## 5. Error Handling & Idempotency

RFC 7807 throughout, matching `Appointment`'s existing conventions exactly: idempotency replay via a compound `(TenantId, IdempotencyKey)` unique index plus a `DbUpdateException`-unique-violation catch (the same pattern `Appointment` uses, including the narrow `SqlException { Number: 2601 or 2627 }` classification learned from that sub-project's final review), and a `(TenantId, ConsultantDoctorId, AppointmentDate, AppointmentTime)` filtered unique index (excluding `Cancelled` rows) as the DB-level backstop for the booking-slot invariant — applying the Scheduling final review's lesson proactively this time, rather than needing a follow-up fix wave to add it.

## 6. Testing

Mirrors `Appointment`'s existing test shape: fake-client-based tests for downstream validation failures (doctor not found/inactive, child not found/inactive) returning `ValidationProblem`; idempotency replay; slot-conflict `409`; tenant isolation by-ID and by-list; reschedule re-validating both the doctor's active status and the new slot's availability; cancel making the slot bookable again.
