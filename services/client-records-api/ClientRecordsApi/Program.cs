using ClientRecordsApi.Data;
using ClientRecordsApi.Endpoints;
using ClientRecordsApi.Tenancy;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddDbContext<ClientRecordsDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("ClientRecordsDb"), sqlOptions => sqlOptions.EnableRetryOnFailure()));
builder.Services.AddScoped<TenantContext>();
builder.Services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContext>());

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ClientRecordsDbContext>();
    if (!app.Environment.IsEnvironment("Testing"))
    {
        db.Database.Migrate();
    }
}

app.UseExceptionHandler();
app.UseStatusCodePages();

app.UseMiddleware<TenantIdMiddleware>();

app.MapGet("/health", () => Results.Ok(new { status = "Healthy", service = "ClientRecordsApi" }));
app.MapParentEndpoints();
app.MapChildEndpoints();
app.MapEnquiryEndpoints();

app.Run();

public partial class Program { }
