# AppointmentBooking

Multi-tenant SaaS platform for child-development-therapy clinic networks. See
[`docs/superpowers/specs/2026-08-15-phase1-foundation-core-ops-design.md`](docs/superpowers/specs/2026-08-15-phase1-foundation-core-ops-design.md)
for the Phase 1 design.

## Layout

- `services/directory-api` — .NET: tenants, branches, therapy catalog, therapists
- `services/scheduling-api` — .NET: appointment booking engine
- `services/client-records-api` — .NET: parents, children
- `services/ai-service` — Python/FastAPI: advisory slot-suggestion endpoint
- `frontend/admin-spa` — React + TypeScript admin console
- `infra/bicep` — Azure infrastructure as code
- `infra/auth0` — Auth0 tenant configuration as code
- `docs/superpowers/` — specs and implementation plans
