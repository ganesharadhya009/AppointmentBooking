const BASE_URLS = {
  directory: process.env.EXPO_PUBLIC_DIRECTORY_API_URL ?? 'http://localhost:5256',
  scheduling: process.env.EXPO_PUBLIC_SCHEDULING_API_URL ?? 'http://localhost:5098',
  clientRecords: process.env.EXPO_PUBLIC_CLIENT_RECORDS_API_URL ?? 'http://localhost:5084',
  billing: process.env.EXPO_PUBLIC_BILLING_API_URL ?? 'http://localhost:5320',
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

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
}

// The backend has no real auth/identity system yet -- every request just needs *a* valid tenant
// GUID. The admin console pins the same value (frontend/admin-app/.env.development.local) so
// whatever's configured there (branches, therapy catalog, therapists, consultants) is exactly
// what this app sees. Set via EXPO_PUBLIC_TENANT_ID in .env.local.
function getTenantId(): string {
  const tenantId = process.env.EXPO_PUBLIC_TENANT_ID;
  if (!tenantId) {
    throw new ApiError(
      0,
      'EXPO_PUBLIC_TENANT_ID is not set. Add it to frontend/mobile-app/.env.local (see the admin app\'s pinned dev tenant).'
    );
  }
  return tenantId;
}

async function request<T>(service: ServiceName, path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query } = options;

  const url = new URL(`${BASE_URLS[service]}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': getTenantId(),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ApiError(0, `Couldn't reach ${service} (${BASE_URLS[service]}). Is it running?`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await res.json() : undefined;

  if (!res.ok) {
    throw new ApiError(res.status, payload?.title ?? res.statusText, payload);
  }

  return payload as T;
}

function createServiceClient(service: ServiceName) {
  return {
    get: <T>(path: string, query?: RequestOptions['query']) => request<T>(service, path, { query }),
    post: <T>(path: string, body?: unknown) => request<T>(service, path, { method: 'POST', body }),
    put: <T>(path: string, body?: unknown) => request<T>(service, path, { method: 'PUT', body }),
    delete: <T>(path: string) => request<T>(service, path, { method: 'DELETE' }),
  };
}

export const directoryApi = createServiceClient('directory');
export const schedulingApi = createServiceClient('scheduling');
export const clientRecordsApi = createServiceClient('clientRecords');
export const billingApi = createServiceClient('billing');
