using Microsoft.AspNetCore.Http;

namespace DirectoryApi.Tenancy;

public class TenantIdMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, TenantContext tenantContext, IProblemDetailsService problemDetailsService)
    {
        var path = context.Request.Path;
        var isHealthCheck = path.Equals("/health", StringComparison.OrdinalIgnoreCase);
        var isTenantsRoute = path.StartsWithSegments("/tenants", out var remaining) &&
            (remaining == PathString.Empty || remaining.Value!.Count(c => c == '/') <= 1);

        if (isHealthCheck || isTenantsRoute)
        {
            await next(context);
            return;
        }

        if (!context.Request.Headers.TryGetValue("X-Tenant-Id", out var headerValue) ||
            !Guid.TryParse(headerValue, out var tenantId) ||
            tenantId == Guid.Empty)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await problemDetailsService.WriteAsync(new ProblemDetailsContext
            {
                HttpContext = context,
                ProblemDetails = new Microsoft.AspNetCore.Mvc.ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Missing or invalid X-Tenant-Id header",
                    Detail = "Every request except /health and /tenants must include a valid, non-empty X-Tenant-Id header (a GUID)."
                }
            });
            return;
        }

        tenantContext.Set(tenantId);
        await next(context);
    }
}
