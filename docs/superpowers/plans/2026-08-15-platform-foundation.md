# Platform Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the empty, buildable, CI-tested skeleton for every Phase 1 subsystem — three .NET services, one Python service, one React SPA, CI pipelines, and IaC for the Azure/Auth0 resources they'll run on — so every later Phase 1 plan (Directory API, Client Records API, Scheduling API, AI Service, Admin SPA) starts from working scaffolding instead of an empty repo.

**Architecture:** A monorepo with one folder per service under `services/` and the frontend under `frontend/`, each independently buildable and independently covered by its own GitHub Actions workflow. Shared infrastructure (Azure resources, Auth0 tenant config) is declared as code under `infra/` but not applied in this plan — applying it requires real cloud/Auth0 credentials this session does not have, so those steps are handed off to the user as documented manual commands.

**Tech Stack:** .NET 9 (ASP.NET Core minimal APIs, xUnit), Python 3.11 (FastAPI, pytest), React 18 + TypeScript (Vite, Vitest, Testing Library), Bicep (Azure IaC), Auth0 Deploy CLI (Auth0 IaC), GitHub Actions.

## Global Constraints

- .NET services target .NET 9 (confirmed installed: `dotnet --version` → 9.0.307).
- Python services target Python 3.11 (confirmed installed as `python`, not `python3`, on this Windows environment).
- Frontend targets Node 22 / npm 10 (confirmed installed).
- Every service exposes a `GET /health` endpoint returning JSON `{"status": "Healthy", "service": "<ServiceName>"}` — this plan's tests check that exact shape; later plans must not change it without updating these tests.
- Every .NET service and test project lives under `services/<service-folder>/<ProjectName>/` and `services/<service-folder>/<ProjectName>.Tests/` respectively, and both are registered in the root `AppointmentBooking.sln`.
- Azure SQL, Postgres, Auth0 tenant creation, and Azure resource deployment are **not** performed by this plan — no live cloud/Auth0 credentials are available in this environment. Tasks 8 and 9 produce reviewed, locally-validated IaC/config files plus documented manual apply commands for the user to run with their own credentials.

---

### Task 1: Repo scaffolding

**Files:**
- Create: `.gitignore`
- Create: `.editorconfig`
- Create: `README.md`

**Interfaces:**
- Consumes: nothing
- Produces: baseline repo hygiene files every later task relies on (`.gitignore` must already exclude `bin/`, `obj/`, `node_modules/`, `.venv/` before Tasks 2–6 generate those directories)

- [ ] **Step 1: Create `.gitignore`**

```gitignore
# .NET
bin/
obj/
*.user

# Python
.venv/
__pycache__/
*.pyc

# Node / React
node_modules/
dist/
.vite/

# IDE / OS
.vs/
.idea/
.DS_Store
Thumbs.db
```

- [ ] **Step 2: Create `.editorconfig`**

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space

[*.cs]
indent_size = 4

[*.{ts,tsx,py,json,yml,yaml,bicep}]
indent_size = 2
```

- [ ] **Step 3: Create `README.md`**

```markdown
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
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore .editorconfig README.md
git commit -m "chore: add repo scaffolding (.gitignore, .editorconfig, README)"
```

---

### Task 2: Directory API skeleton (.NET)

**Files:**
- Create: `AppointmentBooking.sln`
- Create: `services/directory-api/DirectoryApi/DirectoryApi.csproj`
- Create: `services/directory-api/DirectoryApi/Program.cs`
- Create: `services/directory-api/DirectoryApi.Tests/DirectoryApi.Tests.csproj`
- Create: `services/directory-api/DirectoryApi.Tests/HealthEndpointTests.cs`

**Interfaces:**
- Consumes: nothing
- Produces: a running ASP.NET Core app exposing `GET /health` → `{"status":"Healthy","service":"DirectoryApi"}`, and a `public partial class Program` type that later Directory API plans reference from their own test projects via `WebApplicationFactory<Program>`

- [ ] **Step 1: Create the solution file**

```bash
dotnet new sln -n AppointmentBooking
```

- [ ] **Step 2: Scaffold the empty ASP.NET Core project**

```bash
dotnet new web -n DirectoryApi -o services/directory-api/DirectoryApi
```

- [ ] **Step 3: Replace the generated `Program.cs` with the health endpoint**

Replace the full contents of `services/directory-api/DirectoryApi/Program.cs`:

```csharp
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/health", () => Results.Ok(new { status = "Healthy", service = "DirectoryApi" }));

app.Run();

public partial class Program { }
```

- [ ] **Step 4: Scaffold the test project**

```bash
dotnet new xunit -n DirectoryApi.Tests -o services/directory-api/DirectoryApi.Tests
dotnet add services/directory-api/DirectoryApi.Tests/DirectoryApi.Tests.csproj reference services/directory-api/DirectoryApi/DirectoryApi.csproj
dotnet add services/directory-api/DirectoryApi.Tests/DirectoryApi.Tests.csproj package Microsoft.AspNetCore.Mvc.Testing
```

- [ ] **Step 5: Write the failing test**

Replace the generated test file with `services/directory-api/DirectoryApi.Tests/HealthEndpointTests.cs`:

```csharp
using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

namespace DirectoryApi.Tests;

public class HealthEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public HealthEndpointTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Health_ReturnsOkWithServiceName()
    {
        var response = await _client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("Healthy", body);
        Assert.Contains("DirectoryApi", body);
    }
}
```

Delete the default `services/directory-api/DirectoryApi.Tests/UnitTest1.cs` if `dotnet new xunit` generated one.

- [ ] **Step 6: Add both projects to the solution**

```bash
dotnet sln AppointmentBooking.sln add services/directory-api/DirectoryApi/DirectoryApi.csproj services/directory-api/DirectoryApi.Tests/DirectoryApi.Tests.csproj
```

- [ ] **Step 7: Run the test and verify it passes**

Run: `dotnet test services/directory-api/DirectoryApi.Tests/DirectoryApi.Tests.csproj`
Expected: `Passed! - Failed: 0, Passed: 1`

- [ ] **Step 8: Commit**

```bash
git add AppointmentBooking.sln services/directory-api
git commit -m "feat(directory-api): scaffold empty service with health endpoint"
```

---

### Task 3: Scheduling API skeleton (.NET)

**Files:**
- Create: `services/scheduling-api/SchedulingApi/SchedulingApi.csproj`
- Create: `services/scheduling-api/SchedulingApi/Program.cs`
- Create: `services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj`
- Create: `services/scheduling-api/SchedulingApi.Tests/HealthEndpointTests.cs`
- Modify: `AppointmentBooking.sln`

**Interfaces:**
- Consumes: nothing
- Produces: `GET /health` → `{"status":"Healthy","service":"SchedulingApi"}`

- [ ] **Step 1: Scaffold the empty ASP.NET Core project**

```bash
dotnet new web -n SchedulingApi -o services/scheduling-api/SchedulingApi
```

- [ ] **Step 2: Replace `Program.cs`**

Replace the full contents of `services/scheduling-api/SchedulingApi/Program.cs`:

```csharp
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/health", () => Results.Ok(new { status = "Healthy", service = "SchedulingApi" }));

app.Run();

public partial class Program { }
```

- [ ] **Step 3: Scaffold the test project**

```bash
dotnet new xunit -n SchedulingApi.Tests -o services/scheduling-api/SchedulingApi.Tests
dotnet add services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj reference services/scheduling-api/SchedulingApi/SchedulingApi.csproj
dotnet add services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj package Microsoft.AspNetCore.Mvc.Testing
```

- [ ] **Step 4: Write the failing test**

Replace the generated test file with `services/scheduling-api/SchedulingApi.Tests/HealthEndpointTests.cs`:

```csharp
using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

namespace SchedulingApi.Tests;

public class HealthEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public HealthEndpointTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Health_ReturnsOkWithServiceName()
    {
        var response = await _client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("Healthy", body);
        Assert.Contains("SchedulingApi", body);
    }
}
```

Delete the default `UnitTest1.cs` if generated.

- [ ] **Step 5: Add both projects to the solution**

```bash
dotnet sln AppointmentBooking.sln add services/scheduling-api/SchedulingApi/SchedulingApi.csproj services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj
```

- [ ] **Step 6: Run the test and verify it passes**

Run: `dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj`
Expected: `Passed! - Failed: 0, Passed: 1`

- [ ] **Step 7: Commit**

```bash
git add AppointmentBooking.sln services/scheduling-api
git commit -m "feat(scheduling-api): scaffold empty service with health endpoint"
```

---

### Task 4: Client Records API skeleton (.NET)

**Files:**
- Create: `services/client-records-api/ClientRecordsApi/ClientRecordsApi.csproj`
- Create: `services/client-records-api/ClientRecordsApi/Program.cs`
- Create: `services/client-records-api/ClientRecordsApi.Tests/ClientRecordsApi.Tests.csproj`
- Create: `services/client-records-api/ClientRecordsApi.Tests/HealthEndpointTests.cs`
- Modify: `AppointmentBooking.sln`

**Interfaces:**
- Consumes: nothing
- Produces: `GET /health` → `{"status":"Healthy","service":"ClientRecordsApi"}`

- [ ] **Step 1: Scaffold the empty ASP.NET Core project**

```bash
dotnet new web -n ClientRecordsApi -o services/client-records-api/ClientRecordsApi
```

- [ ] **Step 2: Replace `Program.cs`**

Replace the full contents of `services/client-records-api/ClientRecordsApi/Program.cs`:

```csharp
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/health", () => Results.Ok(new { status = "Healthy", service = "ClientRecordsApi" }));

app.Run();

public partial class Program { }
```

- [ ] **Step 3: Scaffold the test project**

```bash
dotnet new xunit -n ClientRecordsApi.Tests -o services/client-records-api/ClientRecordsApi.Tests
dotnet add services/client-records-api/ClientRecordsApi.Tests/ClientRecordsApi.Tests.csproj reference services/client-records-api/ClientRecordsApi/ClientRecordsApi.csproj
dotnet add services/client-records-api/ClientRecordsApi.Tests/ClientRecordsApi.Tests.csproj package Microsoft.AspNetCore.Mvc.Testing
```

- [ ] **Step 4: Write the failing test**

Replace the generated test file with `services/client-records-api/ClientRecordsApi.Tests/HealthEndpointTests.cs`:

```csharp
using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

namespace ClientRecordsApi.Tests;

public class HealthEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public HealthEndpointTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Health_ReturnsOkWithServiceName()
    {
        var response = await _client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("Healthy", body);
        Assert.Contains("ClientRecordsApi", body);
    }
}
```

Delete the default `UnitTest1.cs` if generated.

- [ ] **Step 5: Add both projects to the solution**

```bash
dotnet sln AppointmentBooking.sln add services/client-records-api/ClientRecordsApi/ClientRecordsApi.csproj services/client-records-api/ClientRecordsApi.Tests/ClientRecordsApi.Tests.csproj
```

- [ ] **Step 6: Run the test and verify it passes**

Run: `dotnet test services/client-records-api/ClientRecordsApi.Tests/ClientRecordsApi.Tests.csproj`
Expected: `Passed! - Failed: 0, Passed: 1`

- [ ] **Step 7: Commit**

```bash
git add AppointmentBooking.sln services/client-records-api
git commit -m "feat(client-records-api): scaffold empty service with health endpoint"
```

---

### Task 5: AI Service skeleton (Python/FastAPI)

**Files:**
- Create: `services/ai-service/requirements.txt`
- Create: `services/ai-service/pyproject.toml`
- Create: `services/ai-service/app/__init__.py`
- Create: `services/ai-service/app/main.py`
- Create: `services/ai-service/tests/test_health.py`

**Interfaces:**
- Consumes: nothing
- Produces: `GET /health` → `{"status":"Healthy","service":"AiService"}`, importable as `app.main:app` for later AI Service plan tasks

- [ ] **Step 1: Create `requirements.txt`**

```
fastapi
uvicorn[standard]
pytest
httpx
```

- [ ] **Step 2: Create `pyproject.toml`** (makes `app` importable from `tests/` regardless of working directory)

```toml
[tool.pytest.ini_options]
pythonpath = ["."]
```

- [ ] **Step 3: Create the empty package marker**

```bash
touch services/ai-service/app/__init__.py
```

- [ ] **Step 4: Create `app/main.py`**

```python
from fastapi import FastAPI

app = FastAPI(title="AI Service")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "Healthy", "service": "AiService"}
```

- [ ] **Step 5: Write the failing test**

`services/ai-service/tests/test_health.py`:

```python
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok_with_service_name() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "Healthy"
    assert body["service"] == "AiService"
```

- [ ] **Step 6: Create a virtual environment and install dependencies**

```bash
cd services/ai-service
python -m venv .venv
source .venv/Scripts/activate
pip install -r requirements.txt
```

- [ ] **Step 7: Run the test and verify it passes**

Run (from `services/ai-service`, with `.venv` activated): `pytest -v`
Expected: `1 passed`

- [ ] **Step 8: Commit**

```bash
cd ../..
git add services/ai-service
git commit -m "feat(ai-service): scaffold empty FastAPI service with health endpoint"
```

---

### Task 6: Admin SPA skeleton (React + TypeScript)

**Files:**
- Create: `frontend/admin-spa/` (via Vite scaffold)
- Modify: `frontend/admin-spa/src/App.tsx`
- Create: `frontend/admin-spa/src/App.test.tsx`
- Create: `frontend/admin-spa/src/setupTests.ts`
- Modify: `frontend/admin-spa/vite.config.ts`
- Modify: `frontend/admin-spa/package.json`

**Interfaces:**
- Consumes: nothing
- Produces: a landing page rendering an "AppointmentBooking Admin" heading; later Admin SPA plan tasks build real screens inside this scaffold

- [ ] **Step 1: Scaffold the Vite React+TS project**

```bash
mkdir -p frontend
cd frontend
npm create vite@latest admin-spa -- --template react-ts
cd admin-spa
npm install
```

- [ ] **Step 2: Install test dependencies**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Replace `src/App.tsx`**

```tsx
function App() {
  return (
    <main>
      <h1>AppointmentBooking Admin</h1>
      <p>Platform foundation scaffold — service integration coming in later plans.</p>
    </main>
  );
}

export default App;
```

- [ ] **Step 4: Write the failing test**

`frontend/admin-spa/src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the admin console heading', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /AppointmentBooking Admin/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Add the test setup file**

`frontend/admin-spa/src/setupTests.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 6: Configure Vitest in `vite.config.ts`**

Replace the full contents of `frontend/admin-spa/vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
  },
})
```

- [ ] **Step 7: Add a `test` script to `package.json`**

In the `"scripts"` block of `frontend/admin-spa/package.json`, add:

```json
"test": "vitest run"
```

- [ ] **Step 8: Run the test and verify it passes**

Run (from `frontend/admin-spa`): `npm test`
Expected: `1 passed`

- [ ] **Step 9: Verify the production build still succeeds**

Run: `npm run build`
Expected: exits 0, produces `dist/`

- [ ] **Step 10: Commit**

```bash
cd ../..
git add frontend/admin-spa
git commit -m "feat(admin-spa): scaffold React+TS landing page with Vitest"
```

---

### Task 7: CI workflows (GitHub Actions)

**Files:**
- Create: `.github/workflows/directory-api.yml`
- Create: `.github/workflows/scheduling-api.yml`
- Create: `.github/workflows/client-records-api.yml`
- Create: `.github/workflows/ai-service.yml`
- Create: `.github/workflows/admin-spa.yml`

**Interfaces:**
- Consumes: the five service skeletons from Tasks 2–6
- Produces: independent CI runs per service, so a later change to one service never blocks or hides failures in another

- [ ] **Step 1: Create `.github/workflows/directory-api.yml`**

```yaml
name: directory-api

on:
  push:
    branches: [main]
    paths:
      - 'services/directory-api/**'
      - '.github/workflows/directory-api.yml'
  pull_request:
    paths:
      - 'services/directory-api/**'
      - '.github/workflows/directory-api.yml'

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '9.0.x'
      - name: Restore
        run: dotnet restore services/directory-api/DirectoryApi/DirectoryApi.csproj
      - name: Build
        run: dotnet build services/directory-api/DirectoryApi/DirectoryApi.csproj --no-restore
      - name: Test
        run: dotnet test services/directory-api/DirectoryApi.Tests/DirectoryApi.Tests.csproj
```

- [ ] **Step 2: Create `.github/workflows/scheduling-api.yml`** (same shape, `scheduling-api` / `SchedulingApi`)

```yaml
name: scheduling-api

on:
  push:
    branches: [main]
    paths:
      - 'services/scheduling-api/**'
      - '.github/workflows/scheduling-api.yml'
  pull_request:
    paths:
      - 'services/scheduling-api/**'
      - '.github/workflows/scheduling-api.yml'

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '9.0.x'
      - name: Restore
        run: dotnet restore services/scheduling-api/SchedulingApi/SchedulingApi.csproj
      - name: Build
        run: dotnet build services/scheduling-api/SchedulingApi/SchedulingApi.csproj --no-restore
      - name: Test
        run: dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj
```

- [ ] **Step 3: Create `.github/workflows/client-records-api.yml`** (same shape, `client-records-api` / `ClientRecordsApi`)

```yaml
name: client-records-api

on:
  push:
    branches: [main]
    paths:
      - 'services/client-records-api/**'
      - '.github/workflows/client-records-api.yml'
  pull_request:
    paths:
      - 'services/client-records-api/**'
      - '.github/workflows/client-records-api.yml'

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '9.0.x'
      - name: Restore
        run: dotnet restore services/client-records-api/ClientRecordsApi/ClientRecordsApi.csproj
      - name: Build
        run: dotnet build services/client-records-api/ClientRecordsApi/ClientRecordsApi.csproj --no-restore
      - name: Test
        run: dotnet test services/client-records-api/ClientRecordsApi.Tests/ClientRecordsApi.Tests.csproj
```

- [ ] **Step 4: Create `.github/workflows/ai-service.yml`**

```yaml
name: ai-service

on:
  push:
    branches: [main]
    paths:
      - 'services/ai-service/**'
      - '.github/workflows/ai-service.yml'
  pull_request:
    paths:
      - 'services/ai-service/**'
      - '.github/workflows/ai-service.yml'

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: services/ai-service
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: pip install -r requirements.txt
      - name: Test
        run: pytest -v
```

- [ ] **Step 5: Create `.github/workflows/admin-spa.yml`**

```yaml
name: admin-spa

on:
  push:
    branches: [main]
    paths:
      - 'frontend/admin-spa/**'
      - '.github/workflows/admin-spa.yml'
  pull_request:
    paths:
      - 'frontend/admin-spa/**'
      - '.github/workflows/admin-spa.yml'

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend/admin-spa
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Install dependencies
        run: npm ci
      - name: Test
        run: npm test
      - name: Build
        run: npm run build
```

- [ ] **Step 6: Validate YAML syntax locally** (no GitHub runner in this environment, so this is the available substitute for "run it")

```bash
python -m pip install --user pyyaml
python -c "import yaml, glob; [yaml.safe_load(open(f, encoding='utf-8')) for f in glob.glob('.github/workflows/*.yml')]; print('All workflow YAML valid')"
```

Expected: `All workflow YAML valid`

- [ ] **Step 7: Commit**

```bash
git add .github/workflows
git commit -m "ci: add per-service GitHub Actions build-and-test workflows"
```

---

### Task 8: Azure infrastructure as code (Bicep)

**Files:**
- Create: `infra/bicep/main.bicep`
- Create: `infra/bicep/README.md`

**Interfaces:**
- Consumes: nothing (declares resources; does not deploy them)
- Produces: a syntactically valid Bicep template declaring every Azure resource named in the design spec (§4, §11): API Management gateway, 3 Azure SQL databases, Postgres Flexible Server, Container Apps environment, Static Web App, Key Vault, Application Insights/Log Analytics

- [ ] **Step 1: Create `infra/bicep/main.bicep`**

This content has already been verified to compile with `az bicep build` (exit code 0, no errors) before being placed in this plan:

```bicep
@description('Short environment name, e.g. dev, staging, prod.')
param environmentName string = 'dev'

@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('Administrator login for the Azure SQL logical server.')
param sqlAdminLogin string

@description('Administrator password for the Azure SQL logical server.')
@secure()
param sqlAdminPassword string

@description('Administrator login for the Postgres Flexible Server.')
param postgresAdminLogin string

@description('Administrator password for the Postgres Flexible Server.')
@secure()
param postgresAdminPassword string

var namePrefix = 'appt-${environmentName}'

// ---------- Observability ----------

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${namePrefix}-logs'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${namePrefix}-appinsights'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

// ---------- Secrets ----------

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${namePrefix}-kv'
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
  }
}

// ---------- Azure SQL (Directory API, Scheduling API, Client Records API) ----------

resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' = {
  name: '${namePrefix}-sql'
  location: location
  properties: {
    administratorLogin: sqlAdminLogin
    administratorLoginPassword: sqlAdminPassword
    minimalTlsVersion: '1.2'
  }
}

resource directoryDb 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sqlServer
  name: 'directory-api'
  location: location
  sku: {
    name: 'GP_S_Gen5_1'
    tier: 'GeneralPurpose'
  }
}

resource schedulingDb 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sqlServer
  name: 'scheduling-api'
  location: location
  sku: {
    name: 'GP_S_Gen5_1'
    tier: 'GeneralPurpose'
  }
}

resource clientRecordsDb 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sqlServer
  name: 'client-records-api'
  location: location
  sku: {
    name: 'GP_S_Gen5_1'
    tier: 'GeneralPurpose'
  }
}

// ---------- Postgres (AI Service) ----------

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: '${namePrefix}-ai-pg'
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    version: '16'
    storage: {
      storageSizeGB: 32
    }
  }
}

// ---------- Compute (Container Apps for .NET + Python services) ----------

resource containerAppsEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${namePrefix}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// ---------- Frontend (React Admin SPA) ----------

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: '${namePrefix}-admin-spa'
  location: location
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {}
}

// ---------- Gateway ----------

resource apiManagement 'Microsoft.ApiManagement/service@2023-05-01-preview' = {
  name: '${namePrefix}-apim'
  location: location
  sku: {
    name: 'Developer'
    capacity: 1
  }
  properties: {
    publisherEmail: 'platform@appointmentbooking.example'
    publisherName: 'AppointmentBooking Platform Team'
  }
}

output logAnalyticsWorkspaceId string = logAnalytics.id
output appInsightsConnectionString string = appInsights.properties.ConnectionString
output containerAppsEnvironmentId string = containerAppsEnv.id
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output postgresFqdn string = postgres.properties.fullyQualifiedDomainName
output staticWebAppDefaultHostname string = staticWebApp.properties.defaultHostname
output apiManagementGatewayUrl string = apiManagement.properties.gatewayUrl
```

- [ ] **Step 2: Install the Bicep CLI if not already present**

```bash
az bicep install
```

- [ ] **Step 3: Compile the template to verify syntax**

Run: `az bicep build --file infra/bicep/main.bicep --stdout`
Expected: exits 0, prints the compiled ARM JSON, no errors on stderr

- [ ] **Step 4: Create `infra/bicep/README.md`** documenting the deployment this plan does not perform

```markdown
# Azure infrastructure

`main.bicep` declares the Phase 1 Azure resources. It is validated with
`az bicep build` in CI/CD but is **not deployed automatically** — deployment
requires an authenticated Azure subscription and real admin credentials for
SQL/Postgres, which must be supplied by whoever runs this.

## Manual deploy (run by a human with subscription access)

```bash
az login
az group create --name appt-dev-rg --location <your-region>
az deployment group create \
  --resource-group appt-dev-rg \
  --template-file infra/bicep/main.bicep \
  --parameters environmentName=dev sqlAdminLogin=<login> sqlAdminPassword=<password> postgresAdminLogin=<login> postgresAdminPassword=<password>
```

Store `sqlAdminPassword` and `postgresAdminPassword` in a secrets manager
(e.g. `az keyvault secret set`) rather than passing them on the command line
in a real deployment — the command above is illustrative.
```

- [ ] **Step 5: Commit**

```bash
git add infra/bicep
git commit -m "infra: add Bicep template for Phase 1 Azure resources"
```

---

### Task 9: Auth0 tenant configuration as code

**Files:**
- Create: `infra/auth0/tenant.yaml`
- Create: `infra/auth0/README.md`

**Interfaces:**
- Consumes: nothing (declares desired Auth0 tenant state; does not apply it)
- Produces: an Auth0 Deploy CLI-format config declaring Organizations (multi-tenant login), the four Phase 1 roles, and a placeholder M2M application for future B2B consumers of the Scheduling API

- [ ] **Step 1: Create `infra/auth0/tenant.yaml`**

```yaml
# Auth0 Deploy CLI format — see infra/auth0/README.md for how this is applied.

tenant:
  enabled_locales:
    - en
  flags:
    enable_client_connections: false

roles:
  - name: Super Admin
    description: Highest-privilege back-office role; not self-selectable at login.
  - name: Admin
    description: Primary back-office operator role.
  - name: Therapist
    description: Therapist's own login role (distinct from Therapist records in Directory API).
  - name: Auditor
    description: Read/oversight-oriented role.

clients:
  - name: admin-spa
    app_type: spa
    description: React admin console — Authorization Code + PKCE flow.

  - name: scheduling-api-b2b-placeholder
    app_type: non_interactive
    description: >
      Placeholder M2M (client-credentials) application for future external
      B2B consumers of the Scheduling API. Not granted any API access yet —
      see design spec §4/§12: every real M2M credential must be minted
      per-tenant with a single non-overridable TenantId claim before the
      Scheduling API is opened externally.
```

- [ ] **Step 2: Validate YAML syntax locally**

```bash
python -c "import yaml; yaml.safe_load(open('infra/auth0/tenant.yaml', encoding='utf-8')); print('tenant.yaml is valid YAML')"
```

Expected: `tenant.yaml is valid YAML`

- [ ] **Step 3: Create `infra/auth0/README.md`** documenting the manual apply step this plan does not perform

```markdown
# Auth0 tenant configuration

`tenant.yaml` declares the desired Auth0 tenant state (roles, client
applications) using the [Auth0 Deploy
CLI](https://github.com/auth0/auth0-deploy-cli) format. It is **not applied
automatically** — applying it requires a real Auth0 tenant and Deploy CLI
credentials (`AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET` for a
Deploy CLI application), which must be supplied by whoever runs this.

## Manual apply (run by a human with Auth0 tenant access)

```bash
npx auth0-deploy-cli import --input_file infra/auth0/tenant.yaml
```

## Organizations

Multi-tenant login uses [Auth0
Organizations](https://auth0.com/docs/manage-users/organizations), one
Organization per `Tenant` (Directory API entity). Organization creation is
per-customer and happens at tenant-onboarding time, not here — this file
only declares the tenant-wide roles and client applications shared across
all Organizations.
```

- [ ] **Step 4: Commit**

```bash
git add infra/auth0
git commit -m "infra: add Auth0 tenant configuration as code"
```

---

## Definition of done for this plan

- [ ] `dotnet test` passes for all three .NET service test projects
- [ ] `pytest` passes for the AI service
- [ ] `npm test` and `npm run build` pass for the Admin SPA
- [ ] All 5 GitHub Actions workflow files parse as valid YAML
- [ ] `az bicep build` compiles `infra/bicep/main.bicep` with no errors
- [ ] `infra/auth0/tenant.yaml` parses as valid YAML
- [ ] Every task's commit is present in `git log`
