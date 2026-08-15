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

## Building and testing

| Service | Command |
|---|---|
| `directory-api` | `dotnet test services/directory-api/DirectoryApi.Tests/DirectoryApi.Tests.csproj` |
| `scheduling-api` | `dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj` |
| `client-records-api` | `dotnet test services/client-records-api/ClientRecordsApi.Tests/ClientRecordsApi.Tests.csproj` |
| `ai-service` | see below |
| `admin-spa` | `npm test` (from `frontend/admin-spa`) |

### ai-service (Python)

```bash
cd services/ai-service
python -m venv .venv          # first time only
source .venv/Scripts/activate # Windows Git Bash; use .venv/bin/activate on macOS/Linux
pip install -r requirements.txt -r requirements-dev.txt
pytest -v
```
