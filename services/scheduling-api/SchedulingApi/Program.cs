using SchedulingApi.Clients;
using SchedulingApi.Data;
using SchedulingApi.Endpoints;
using SchedulingApi.Tenancy;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddDbContext<SchedulingDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("SchedulingDb"), sqlOptions => sqlOptions.EnableRetryOnFailure()));
builder.Services.AddHttpClient<IDirectoryApiClient, DirectoryApiClient>(client =>
{
    client.BaseAddress = new Uri(builder.Configuration["Services:DirectoryApiBaseUrl"]!);
});
builder.Services.AddHttpClient<IClientRecordsApiClient, ClientRecordsApiClient>(client =>
{
    client.BaseAddress = new Uri(builder.Configuration["Services:ClientRecordsApiBaseUrl"]!);
});
builder.Services.AddHttpClient<IBillingApiClient, BillingApiClient>(client =>
{
    client.BaseAddress = new Uri(builder.Configuration["Services:BillingApiBaseUrl"]!);
});
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
app.MapAppointmentEndpoints();
app.MapDoctorAppointmentEndpoints();
app.MapRefundRequestEndpoints();
app.MapAppointmentReportEndpoints();

app.Run();

public partial class Program { }
