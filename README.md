# AppointmentBooking

Multi-tenant SaaS platform for child-development-therapy clinic networks. See
[`docs/superpowers/specs/2026-08-15-phase1-foundation-core-ops-design.md`](docs/superpowers/specs/2026-08-15-phase1-foundation-core-ops-design.md)
for the Phase 1 design.

## Layout

- `services/directory-api` — .NET: tenants, branches, therapy catalog, therapists
- `services/scheduling-api` — .NET: appointment booking engine
- `services/client-records-api` — .NET: parents, children
- `services/billing-api` — .NET: parent wallets, payment gateway checkout
- `services/ai-service` — Python/FastAPI: advisory slot-suggestion and enquiry-triage endpoints
- `frontend/admin-spa` — React + TypeScript admin console
- `infra/bicep` — Azure infrastructure as code
- `infra/auth0` — Auth0 tenant configuration as code
- `docs/superpowers/` — specs and implementation plans

## Local database setup (all four .NET services)

Every .NET service uses PostgreSQL via EF Core (`Npgsql.EntityFrameworkCore.PostgreSQL`) — a local Postgres instance must be running on `localhost:5432` for `dotnet run`/`dotnet test` to work.

- **`appsettings.Development.json`** (used by `dotnet run`) ships with a placeholder connection string (`Username=postgres;Password=postgres`) — override the password for your actual local instance via the standard ASP.NET Core environment-variable convention, e.g. `ConnectionStrings__DirectoryDb="Host=localhost;Port=5432;Database=directory_api_dev;Username=postgres;Password=<your-real-password>"`. Never edit the real password into the committed file.
- **Test suites** (`LocalDbTestFixture.cs`, one per `.Tests` project) read the password from the `LOCAL_POSTGRES_PASSWORD` environment variable, falling back to the `postgres` placeholder if unset. Set it once per shell session before running `dotnet test`, e.g. (PowerShell) `$env:LOCAL_POSTGRES_PASSWORD = "<your-real-password>"`.
- Each service auto-creates and migrates its own database on startup/first test run (`directory_api_dev`, `scheduling_api_dev`, `client_records_api_dev`, `billing_api_dev` for dev; a fresh `<service>test_<guid>`-named database per test class, dropped after) — no manual `CREATE DATABASE`/migration step needed, as long as the `postgres` role has `CREATEDB` privilege (the default for a local install's superuser).

## Building and testing

| Service | Command |
|---|---|
| `directory-api` | `dotnet test services/directory-api/DirectoryApi.Tests/DirectoryApi.Tests.csproj` |
| `scheduling-api` | `dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj` |
| `client-records-api` | `dotnet test services/client-records-api/ClientRecordsApi.Tests/ClientRecordsApi.Tests.csproj` |
| `billing-api` | `dotnet test services/billing-api/BillingApi.Tests/BillingApi.Tests.csproj` |
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
