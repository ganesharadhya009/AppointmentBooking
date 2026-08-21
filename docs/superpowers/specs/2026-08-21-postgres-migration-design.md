# Platform-Wide PostgreSQL Migration — Design

**Status:** Approved for planning
**Date:** 2026-08-21
**Trigger:** User provisioned a real Aiven-hosted PostgreSQL instance and asked to migrate the platform's database layer to it.

**Review mode:** full rigor (not the recent leaner cost-checkpoint mode) — this is genuinely new risk: the platform's first real external/cloud database, real live credentials, and a change to load-bearing exception-handling patterns used by money-movement and booking-slot correctness code across three services.

## 1. Scope

Swap every .NET service's EF Core provider from SQL Server to PostgreSQL (via `Npgsql.EntityFrameworkCore.PostgreSQL`), fix every SQL-Server-specific code pattern this exposes, regenerate all migrations fresh against the new provider, and point local dev + test infrastructure at real Postgres instances (local Postgres for fast/free tests, the real Aiven instance for the actual dev/"production-shaped" environment).

**Explicitly not in scope:** `ai-service` — it's already Postgres-native (`postgresql+asyncpg://...` in `app/config.py`, SQLAlchemy, no SQL Server anywhere). Nothing to migrate there. This also isn't a data-migration exercise — there is no real data in any environment yet (every prior sub-project's LocalDB databases were ephemeral, test-only). This is a schema/provider migration, not a data-preservation one.

## 2. Every SQL-Server-Specific Site (audited, not assumed)

Confirmed via `grep -rln "Microsoft.Data.SqlClient\|UseSqlServer\|Microsoft.EntityFrameworkCore.SqlServer" services/`:

**Package + DI registration (1 site per service × 4):** each service's `.csproj` (`Microsoft.EntityFrameworkCore.SqlServer` → `Npgsql.EntityFrameworkCore.PostgreSQL`) and `Program.cs` (`options.UseSqlServer(cs, sqlOptions => sqlOptions.EnableRetryOnFailure())` → `options.UseNpgsql(cs, npgsqlOptions => npgsqlOptions.EnableRetryOnFailure())` — Npgsql's provider exposes the identical `EnableRetryOnFailure()` resiliency extension, so this pattern carries over 1:1, not a redesign).

**Unique-violation exception detection (5 sites, all load-bearing for correctness):**
- `services/directory-api/DirectoryApi/Endpoints/HolidayEndpoints.cs`
- `services/directory-api/DirectoryApi/Endpoints/TenantSubscriptionEndpoints.cs`
- `services/scheduling-api/SchedulingApi/Endpoints/AppointmentEndpoints.cs`
- `services/scheduling-api/SchedulingApi/Endpoints/DoctorAppointmentEndpoints.cs`
- `services/billing-api/BillingApi/Services/WalletTransactionHelpers.cs` (the one that matters most — this backstops the wallet-credit idempotency/race-safety logic reviewed extensively in the BillingApi Wallet Foundation sub-project)

Every one of these currently reads:
```csharp
ex.InnerException is Microsoft.Data.SqlClient.SqlException { Number: 2601 or 2627 }
```
which must become:
```csharp
ex.InnerException is Npgsql.PostgresException { SqlState: Npgsql.PostgresErrorCodes.UniqueViolation }
```
(`Npgsql.PostgresErrorCodes.UniqueViolation` is the constant `"23505"` — Postgres has one unique-violation SQL state, unlike SQL Server's two error numbers for the same condition, so this is actually a slight simplification, not a like-for-like risk.)

## 3. Migrations — regenerated fresh, not ported

EF Core migration files are provider-specific (the emitted C#/SQL is SQL-Server-shaped today). The correct way to handle a provider swap is **not** to try to replay 8 (DirectoryApi), 4 (SchedulingApi), 2 (ClientRecordsApi), 2 (BillingApi) historical SQL-Server migrations against Postgres — it's to delete each service's `Migrations/` folder contents and generate one fresh `InitialCreate` migration against the Npgsql provider, capturing today's model as of now. This is standard practice for a provider swap and is safe here specifically because there is no real data anywhere to preserve (§1).

## 4. Connection Strings — local dev vs. the real Aiven instance

**Local dev (`appsettings.Development.json`, committed as always):** points at a local Postgres instance — confirmed reachable in this environment (`localhost:5432`). Npgsql format: `Host=localhost;Port=5432;Database=<service>_dev;Username=postgres;Password=postgres`. This mirrors exactly the role `Server=(localdb)\MSSQLLocalDB;...` played before — fast, free, local, safe to commit (no real secret, `postgres/postgres` is a placeholder-grade local default, not a real credential).

**The real Aiven instance — deliberately NOT committed anywhere.** The connection string the user pasted contains a live password. Committing it to `appsettings.*.json` (even a "just for local testing" file) puts a real credential in git history permanently — recoverable even after a later `git rm`. Instead:
- The Aiven connection string is supplied only via the standard ASP.NET Core environment-variable override (`ConnectionStrings__<ServiceName>Db`, the double-underscore-for-nesting convention `IConfiguration` already understands with zero code changes) — set in the shell for this session's own verification step, never written to a file this repo tracks.
- **The user should rotate the Aiven password after this migration**, since it was pasted in plaintext into this conversation regardless of what does or doesn't end up in git — flagged once here, not a code change.
- One new database per service is created *on* the same Aiven Postgres instance (`directory_api`, `scheduling_api`, `client_records_api`, `billing_api` — analogous to today's per-service-database convention, just Postgres-hosted instead of LocalDB-hosted) rather than cramming all four services into the single pre-existing `defaultdb`. EF Core's `Database.Migrate()` auto-creates the target database if it doesn't exist yet (the same behavior already relied on for LocalDB all session) — no manual `CREATE DATABASE` step needed, `avnadmin` already has the privilege.

## 5. Test Infrastructure — local Postgres, not the real Aiven instance

Every `LocalDbTestFixture.cs` (one per `.Tests` project) currently builds a `Server=(localdb)\MSSQLLocalDB;Database={service}Test_{guid};...` connection string per test run. These become `Host=localhost;Port=5432;Database={service_lowercase}test_{guid};Username=postgres;Password=postgres` — same per-run-unique-database, ephemeral-database lifecycle (`MigrateAsync()` on init, `EnsureDeletedAsync()` on dispose), just against local Postgres instead of local SQL Server. **Never the real Aiven instance for tests** — creating/dropping a database per test class over the network against a real paid service is both slow and bad practice; local Postgres gives the identical fast/free/isolated properties LocalDB provided.

## 6. Error Handling & Testing

Per the standing 2026-08-19 test-deferral policy, no new `[Fact]` tests are written — but the *existing* test suites become the primary verification mechanism for this migration (their regression-check role gets more load-bearing than usual here, since they'll be the thing proving the provider swap didn't silently break query translation for any entity). Every existing suite must pass against local Postgres before this migration is considered done.
