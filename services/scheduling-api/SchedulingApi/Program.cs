using SchedulingApi.Data;
using SchedulingApi.Tenancy;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddDbContext<SchedulingDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("SchedulingDb"), sqlOptions => sqlOptions.EnableRetryOnFailure()));
builder.Services.AddScoped<TenantContext>();
builder.Services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContext>());

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<SchedulingDbContext>();
    if (!app.Environment.IsEnvironment("Testing"))
    {
        db.Database.Migrate();
    }
}

app.UseExceptionHandler();
app.UseStatusCodePages();

app.UseMiddleware<TenantIdMiddleware>();

app.MapGet("/health", () => Results.Ok(new { status = "Healthy", service = "SchedulingApi" }));

app.Run();

public partial class Program { }
