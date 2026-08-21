# Platform-Wide PostgreSQL Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap all four .NET services from SQL Server to PostgreSQL. Based on `docs/superpowers/specs/2026-08-21-postgres-migration-design.md`.

**Architecture:** Task 1 swaps the EF Core provider and fixes every SQL-Server-specific exception-handling site. Task 2 regenerates migrations fresh and repoints local dev/test connection strings at local Postgres. A controller-performed verification step (not a dispatched task) then confirms the migration works against both local Postgres and the real Aiven instance, without ever committing the Aiven credential to any file.

**Tech Stack:** .NET 9, EF Core 9.0.19, `Npgsql.EntityFrameworkCore.PostgreSQL` (new dependency, replacing `Microsoft.EntityFrameworkCore.SqlServer`).

## Global Constraints

- **Full review rigor** (not the recent leaner cost-checkpoint mode) — this is genuinely new risk: the platform's first real external database, and changes to money-movement/booking-slot-correctness exception handling.
- **Never write the real Aiven connection string (or its password) into any file this repo tracks.** Local dev and test connection strings use local Postgres (`localhost:5432`, `postgres`/`postgres`) — a placeholder-grade local default, not a real secret, safe to commit exactly like the LocalDB strings it replaces.
- Every `Microsoft.Data.SqlClient.SqlException { Number: 2601 or 2627 }` check becomes `Npgsql.PostgresException { SqlState: Npgsql.PostgresErrorCodes.UniqueViolation }` — no other logic in those five call sites changes.
- Old SQL-Server-era migration files are deleted and regenerated fresh against Npgsql, not edited in place or ported.
- **Unit/integration test-writing is deferred to a later consolidated pass** (standing project policy) — no new `[Fact]` tests. The *existing* suites, run against local Postgres, are this plan's actual verification mechanism.

---

### Task 1: Provider swap + exception-handling fixes (all four services)

**Files:**
- Modify: `services/directory-api/DirectoryApi/DirectoryApi.csproj`, `Program.cs`, `Endpoints/HolidayEndpoints.cs`, `Endpoints/TenantSubscriptionEndpoints.cs`
- Modify: `services/scheduling-api/SchedulingApi/SchedulingApi.csproj`, `Program.cs`, `Endpoints/AppointmentEndpoints.cs`, `Endpoints/DoctorAppointmentEndpoints.cs`
- Modify: `services/client-records-api/ClientRecordsApi/ClientRecordsApi.csproj`, `Program.cs`
- Modify: `services/billing-api/BillingApi/BillingApi.csproj`, `Program.cs`, `Services/WalletTransactionHelpers.cs`

- [ ] **Step 1: Swap the package on all four projects**

```bash
for proj in services/directory-api/DirectoryApi/DirectoryApi.csproj services/scheduling-api/SchedulingApi/SchedulingApi.csproj services/client-records-api/ClientRecordsApi/ClientRecordsApi.csproj services/billing-api/BillingApi/BillingApi.csproj; do
  dir=$(dirname "$proj")
  (cd "$dir" && dotnet remove package Microsoft.EntityFrameworkCore.SqlServer && dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL)
done
```

Let NuGet resolve the current stable version compatible with EF Core 9.0.19 — do not hand-pin a version number.

- [ ] **Step 2: Update `Program.cs` on all four services**

In each of the four `Program.cs` files, replace:

```csharp
    options.UseSqlServer(builder.Configuration.GetConnectionString("<ConnStringKey>"), sqlOptions => sqlOptions.EnableRetryOnFailure()));
```

with:

```csharp
    options.UseNpgsql(builder.Configuration.GetConnectionString("<ConnStringKey>"), npgsqlOptions => npgsqlOptions.EnableRetryOnFailure()));
```

(`<ConnStringKey>` is `DirectoryDb`/`SchedulingDb`/`ClientRecordsDb`/`BillingDb` respectively — keep each service's existing key name unchanged, only the method call changes.)

- [ ] **Step 3: Fix the unique-violation detection in `DirectoryApi`**

In `services/directory-api/DirectoryApi/Endpoints/HolidayEndpoints.cs` and `services/directory-api/DirectoryApi/Endpoints/TenantSubscriptionEndpoints.cs`, replace:

```csharp
    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is Microsoft.Data.SqlClient.SqlException { Number: 2601 or 2627 };
```

with:

```csharp
    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is Npgsql.PostgresException { SqlState: Npgsql.PostgresErrorCodes.UniqueViolation };
```

- [ ] **Step 4: Fix the unique-violation detection in `SchedulingApi`**

In `services/scheduling-api/SchedulingApi/Endpoints/AppointmentEndpoints.cs` and `services/scheduling-api/SchedulingApi/Endpoints/DoctorAppointmentEndpoints.cs`, apply the identical replacement from Step 3.

- [ ] **Step 5: Fix the unique-violation detection in `BillingApi`**

In `services/billing-api/BillingApi/Services/WalletTransactionHelpers.cs`, apply the identical replacement from Step 3. **This is the most important of the five sites** — it backstops the wallet-credit idempotency logic reviewed extensively in the BillingApi Wallet Foundation sub-project. Double-check this one specifically: read the surrounding `CreditAsync`/debit-handler code in `WalletCreditService.cs` and `WalletEndpoints.cs` afterward to confirm they still call `WalletTransactionHelpers.IsUniqueViolation(ex)` (they should — only the helper's body changes, not its callers).

- [ ] **Step 6: Build all four services**

```bash
dotnet build services/directory-api/DirectoryApi/DirectoryApi.csproj
dotnet build services/scheduling-api/SchedulingApi/SchedulingApi.csproj
dotnet build services/client-records-api/ClientRecordsApi/ClientRecordsApi.csproj
dotnet build services/billing-api/BillingApi/BillingApi.csproj
```

Expected: 0 errors on all four. **Do not expect the existing tests to pass yet** — they still point at LocalDB connection strings via `LocalDbTestFixture.cs`, which Task 2 fixes. A build-only check is this task's bar; do not run `dotnet test` yet and do not be alarmed if it fails right now.

- [ ] **Step 7: Commit**

```bash
git add services/directory-api/DirectoryApi/DirectoryApi.csproj services/directory-api/DirectoryApi/Program.cs services/directory-api/DirectoryApi/Endpoints/HolidayEndpoints.cs services/directory-api/DirectoryApi/Endpoints/TenantSubscriptionEndpoints.cs services/scheduling-api/SchedulingApi/SchedulingApi.csproj services/scheduling-api/SchedulingApi/Program.cs services/scheduling-api/SchedulingApi/Endpoints/AppointmentEndpoints.cs services/scheduling-api/SchedulingApi/Endpoints/DoctorAppointmentEndpoints.cs services/client-records-api/ClientRecordsApi/ClientRecordsApi.csproj services/client-records-api/ClientRecordsApi/Program.cs services/billing-api/BillingApi/BillingApi.csproj services/billing-api/BillingApi/Program.cs services/billing-api/BillingApi/Services/WalletTransactionHelpers.cs
git commit -m "feat: swap EF Core provider from SQL Server to PostgreSQL (Npgsql) across all four .NET services"
```

---

### Task 2: Fresh migrations + local Postgres connection strings (dev and test)

**Files:**
- Delete: contents of `services/directory-api/DirectoryApi/Migrations/`, `services/scheduling-api/SchedulingApi/Migrations/`, `services/client-records-api/ClientRecordsApi/Migrations/`, `services/billing-api/BillingApi/Migrations/`
- Modify: all four `appsettings.Development.json`
- Modify: all four `services/*/*.Tests/Fixtures/LocalDbTestFixture.cs`

- [ ] **Step 1: Delete the old SQL-Server-era migrations**

```bash
rm services/directory-api/DirectoryApi/Migrations/*.cs
rm services/scheduling-api/SchedulingApi/Migrations/*.cs
rm services/client-records-api/ClientRecordsApi/Migrations/*.cs
rm services/billing-api/BillingApi/Migrations/*.cs
```

(This removes every `*.cs`, `*.Designer.cs`, and the `*DbContextModelSnapshot.cs` in each folder — all of them are provider-specific and none carry forward to Npgsql.)

- [ ] **Step 2: Generate a fresh `InitialCreate` migration for each service, against Npgsql**

```bash
cd services/directory-api/DirectoryApi && dotnet ef migrations add InitialCreate --output-dir Migrations && cd ../../..
cd services/scheduling-api/SchedulingApi && dotnet ef migrations add InitialCreate --output-dir Migrations && cd ../../..
cd services/client-records-api/ClientRecordsApi && dotnet ef migrations add InitialCreate --output-dir Migrations && cd ../../..
cd services/billing-api/BillingApi && dotnet ef migrations add InitialCreate --output-dir Migrations && cd ../../..
```

If `dotnet ef` complains it can't find a design-time `DbContext` because the connection string doesn't point anywhere valid yet, that's expected — Step 3 fixes the connection strings. If migration generation itself fails for that reason, do Step 3 first, then come back to this step.

- [ ] **Step 3: Update all four `appsettings.Development.json` to local Postgres**

Replace each service's `ConnectionStrings` value:

`services/directory-api/DirectoryApi/appsettings.Development.json`:
```json
    "DirectoryDb": "Host=localhost;Port=5432;Database=directory_api_dev;Username=postgres;Password=postgres"
```

`services/scheduling-api/SchedulingApi/appsettings.Development.json`:
```json
    "SchedulingDb": "Host=localhost;Port=5432;Database=scheduling_api_dev;Username=postgres;Password=postgres"
```

`services/client-records-api/ClientRecordsApi/appsettings.Development.json`:
```json
    "ClientRecordsDb": "Host=localhost;Port=5432;Database=client_records_api_dev;Username=postgres;Password=postgres"
```

`services/billing-api/BillingApi/appsettings.Development.json`:
```json
    "BillingDb": "Host=localhost;Port=5432;Database=billing_api_dev;Username=postgres;Password=postgres"
```

Keep every other key in each file (`Logging`, `Services`, `PaymentGateway`) exactly as-is — only the `ConnectionStrings` value changes.

**If `postgres`/`postgres` isn't the actual local Postgres username/password on this machine**, the build/test steps later in this task will fail with an authentication error — if that happens, stop and report back rather than guessing at alternative credentials; this is a live environment detail the controller needs to confirm, not something to iterate on blindly.

- [ ] **Step 4: Update all four `LocalDbTestFixture.cs` files**

In each of the four fixture files (`services/directory-api/DirectoryApi.Tests/Fixtures/LocalDbTestFixture.cs`, `services/scheduling-api/SchedulingApi.Tests/Fixtures/LocalDbTestFixture.cs`, `services/client-records-api/ClientRecordsApi.Tests/Fixtures/LocalDbTestFixture.cs`, `services/billing-api/BillingApi.Tests/Fixtures/LocalDbTestFixture.cs`), replace both the `_databaseName` field and the `ConnectionString` property. For example, in `DirectoryApi.Tests`'s fixture, replace:

```csharp
    private readonly string _databaseName = $"DirectoryApiTest_{Guid.NewGuid():N}";

    public string ConnectionString =>
        $"Server=(localdb)\\MSSQLLocalDB;Database={_databaseName};Trusted_Connection=True;TrustServerCertificate=True;";
```

with:

```csharp
    private readonly string _databaseName = $"directoryapitest_{Guid.NewGuid():N}";

    public string ConnectionString =>
        $"Host=localhost;Port=5432;Database={_databaseName};Username=postgres;Password=postgres";
```

Apply the equivalent change in the other three fixtures (`schedulingapitest_`, `clientrecordsapitest_`, `billingapitest_` as the lowercase prefixes — match each service's existing prefix, just lowercased, since Postgres identifiers are conventionally lowercase). Do not change anything else in these files (the `InitializeAsync`/`DisposeAsync`/`ConfigureWebHost` bodies, and `SchedulingApi.Tests`'s fake-client registrations, stay exactly as they are).

- [ ] **Step 5: Build and run every existing test suite against local Postgres**

```bash
dotnet build services/directory-api/DirectoryApi/DirectoryApi.csproj
dotnet build services/scheduling-api/SchedulingApi/SchedulingApi.csproj
dotnet build services/client-records-api/ClientRecordsApi/ClientRecordsApi.csproj
dotnet build services/billing-api/BillingApi/BillingApi.csproj
dotnet test services/directory-api/DirectoryApi.Tests/DirectoryApi.Tests.csproj
dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj
dotnet test services/client-records-api/ClientRecordsApi.Tests/ClientRecordsApi.Tests.csproj
dotnet test services/billing-api/BillingApi.Tests/BillingApi.Tests.csproj
```

Expected: 0 build errors on all four; **71/71** (DirectoryApi), **49/49** (SchedulingApi), **30/30** (ClientRecordsApi) tests passing against local Postgres, and BillingApi.Tests builds/reports 0 tests (it currently has no test methods — that's expected, not a failure). This is the real proof the provider swap didn't silently break query translation for any entity across four services' worth of accumulated schema.

**If any test fails, do not just re-run it hoping for a fluke — read the actual failure.** A provider swap can surface real differences (e.g. a query pattern EF Core translates differently on Postgres, a column-type mapping edge case). Report the specific failure(s) rather than working around them by skipping/deleting the failing test.

- [ ] **Step 6: Commit**

```bash
git add services/directory-api/DirectoryApi/Migrations services/directory-api/DirectoryApi/appsettings.Development.json services/directory-api/DirectoryApi.Tests/Fixtures/LocalDbTestFixture.cs services/scheduling-api/SchedulingApi/Migrations services/scheduling-api/SchedulingApi/appsettings.Development.json services/scheduling-api/SchedulingApi.Tests/Fixtures/LocalDbTestFixture.cs services/client-records-api/ClientRecordsApi/Migrations services/client-records-api/ClientRecordsApi/appsettings.Development.json services/client-records-api/ClientRecordsApi.Tests/Fixtures/LocalDbTestFixture.cs services/billing-api/BillingApi/Migrations services/billing-api/BillingApi/appsettings.Development.json services/billing-api/BillingApi.Tests/Fixtures/LocalDbTestFixture.cs
git commit -m "feat: regenerate migrations for PostgreSQL and point local dev/test at local Postgres"
```

---

## Definition of done for this plan

- [ ] All four services build with 0 errors against the Npgsql provider
- [ ] All four existing test suites pass against local Postgres (71/71, 49/49, 30/30, BillingApi 0 tests but green)
- [ ] All five unique-violation detection sites correctly use `Npgsql.PostgresException`/`PostgresErrorCodes.UniqueViolation`
- [ ] No real Aiven credential appears in any committed file
- [ ] Both task commits are present in `git log`
- [ ] **After this plan lands, the controller (not a dispatched subagent) verifies connectivity against the real Aiven instance via an environment-variable-supplied connection string, confirms `Database.Migrate()` successfully creates and migrates each service's Aiven database, and reports the result** — this step is deliberately not a plan task, since it requires live credential handling and adaptive troubleshooting rather than a fixed script.
