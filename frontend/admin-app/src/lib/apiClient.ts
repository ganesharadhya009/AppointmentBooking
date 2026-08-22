const BASE_URLS = {
  directory: import.meta.env.VITE_DIRECTORY_API_URL ?? "http://localhost:5256",
  scheduling: import.meta.env.VITE_SCHEDULING_API_URL ?? "http://localhost:5098",
  clientRecords: import.meta.env.VITE_CLIENT_RECORDS_API_URL ?? "http://localhost:5084",
  billing: import.meta.env.VITE_BILLING_API_URL ?? "http://localhost:5320",
} as const;

type ServiceName = keyof typeof BASE_URLS;

export class ApiError extends Error {
  status: number;
  detail?: unknown;

  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

// The backend has no auth/identity system yet (see services/directory-api's TenantEndpoints.cs)
// -- every request just needs *a* valid tenant GUID, standing in for the tenant a logged-in admin
// would belong to once real auth lands. VITE_DEV_TENANT_ID (see .env.development.local) pins every
// browser to the one tenant that's actually seeded in your local Postgres. Without it, each browser
// profile would bootstrap its own brand-new, unseeded tenant on first use -- fine for isolated
// automated tests, but not what you want when opening the app by hand.
const TENANT_ID_STORAGE_KEY = "bimba.tenantId";
let tenantIdPromise: Promise<string> | null = null;

async function createDevTenant(): Promise<string> {
  const res = await fetch(`${BASE_URLS.directory}/tenants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Local Dev Tenant" }),
  });
  if (!res.ok) {
    throw new ApiError(res.status, "Failed to bootstrap a local dev tenant");
  }
  const tenant = await res.json();
  return tenant.id as string;
}

export async function getTenantId(): Promise<string> {
  const pinned = import.meta.env.VITE_DEV_TENANT_ID;
  if (pinned) return pinned;

  const cached = localStorage.getItem(TENANT_ID_STORAGE_KEY);
  if (cached) return cached;

  tenantIdPromise ??= createDevTenant().then((id) => {
    localStorage.setItem(TENANT_ID_STORAGE_KEY, id);
    return id;
  });
  return tenantIdPromise;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
}

async function request<T>(service: ServiceName, path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query } = options;

  const url = new URL(`${BASE_URLS[service]}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Id": await getTenantId(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await res.json() : undefined;

  if (!res.ok) {
    throw new ApiError(res.status, payload?.title ?? res.statusText, payload);
  }

  return payload as T;
}

function createServiceClient(service: ServiceName) {
  return {
    get: <T>(path: string, query?: RequestOptions["query"]) => request<T>(service, path, { query }),
    post: <T>(path: string, body?: unknown) => request<T>(service, path, { method: "POST", body }),
    put: <T>(path: string, body?: unknown) => request<T>(service, path, { method: "PUT", body }),
    delete: <T>(path: string) => request<T>(service, path, { method: "DELETE" }),
  };
}

export const directoryApi = createServiceClient("directory");
export const schedulingApi = createServiceClient("scheduling");
export const clientRecordsApi = createServiceClient("clientRecords");
export const billingApi = createServiceClient("billing");

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}
