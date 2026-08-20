using DirectoryApi.Data;
using DirectoryApi.Endpoints;
using DirectoryApi.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "DirectoryApi", Version = "v1" });
    options.AddSecurityDefinition("X-Tenant-Id", new OpenApiSecurityScheme
    {
        Name = "X-Tenant-Id",
        Type = SecuritySchemeType.ApiKey,
        In = ParameterLocation.Header,
        Description = "Tenant identifier (GUID) -- required on every endpoint except /health."
    });
    options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
    {
        [new OpenApiSecuritySchemeReference("X-Tenant-Id", document)] = []
    });
});
builder.Services.AddDbContext<DirectoryDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DirectoryDb"), sqlOptions => sqlOptions.EnableRetryOnFailure()));
builder.Services.AddScoped<TenantContext>();
builder.Services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContext>());

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<DirectoryDbContext>();
    if (!app.Environment.IsEnvironment("Testing"))
    {
        db.Database.Migrate();
    }
}

app.UseExceptionHandler();
app.UseStatusCodePages();

app.UseMiddleware<TenantIdMiddleware>();

app.MapGet("/health", () => Results.Ok(new { status = "Healthy", service = "DirectoryApi" }));

app.MapTenantEndpoints();
app.MapBranchEndpoints();
app.MapTherapyTypeEndpoints();
app.MapTherapistEndpoints();
app.MapHolidayEndpoints();
app.MapConsultantServiceEndpoints();
app.MapConsultantClinicEndpoints();
app.MapConsultantDoctorEndpoints();
app.MapLeaveRequestEndpoints();
app.MapSupportTicketEndpoints();
app.MapBannerEndpoints();
app.MapPosterEndpoints();
app.MapAppVersionEndpoints();
app.MapTenantSubscriptionEndpoints();
app.MapStaffMemberEndpoints();

app.Run();

public partial class Program { }
