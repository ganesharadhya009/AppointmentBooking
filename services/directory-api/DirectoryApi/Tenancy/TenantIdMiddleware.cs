using Microsoft.AspNetCore.Http;

namespace DirectoryApi.Tenancy;

public class TenantIdMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, TenantContext tenantContext, IProblemDetailsService problemDetailsService)
    {
        if (context.Request.Path.StartsWithSegments("/health") ||
            context.Request.Path.StartsWithSegments("/tenants"))
        {
            await next(context);
            return;
        }

        if (!context.Request.Headers.TryGetValue("X-Tenant-Id", out var headerValue) ||
            !Guid.TryParse(headerValue, out var tenantId))
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await problemDetailsService.WriteAsync(new ProblemDetailsContext
            {
                HttpContext = context,
                ProblemDetails = new Microsoft.AspNetCore.Mvc.ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Missing or invalid X-Tenant-Id header",
                    Detail = "Every request except /health and /tenants must include a valid X-Tenant-Id header (a GUID)."
                }
            });
            return;
        }

        tenantContext.Set(tenantId);
        await next(context);
    }
}
