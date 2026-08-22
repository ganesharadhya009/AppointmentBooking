using ClientRecordsApi.Data;
using ClientRecordsApi.Endpoints;
using ClientRecordsApi.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "ClientRecordsApi", Version = "v1" });
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
builder.Services.AddDbContext<ClientRecordsDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("ClientRecordsDb"), npgsqlOptions => npgsqlOptions.EnableRetryOnFailure()));
builder.Services.AddCors(options =>
{
    options.AddPolicy("LocalDev", policy => policy
        .WithOrigins("http://localhost:5173", "http://localhost:8081", "http://localhost:19006")
        .AllowAnyHeader()
        .AllowAnyMethod());
});
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
    var db = scope.ServiceProvider.GetRequiredService<ClientRecordsDbContext>();
    if (!app.Environment.IsEnvironment("Testing"))
    {
        db.Database.Migrate();
    }
}

app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.UseCors("LocalDev");
}

app.UseMiddleware<TenantIdMiddleware>();

app.MapGet("/health", () => Results.Ok(new { status = "Healthy", service = "ClientRecordsApi" }));
app.MapParentEndpoints();
app.MapChildEndpoints();
app.MapEnquiryEndpoints();

app.Run();

public partial class Program { }
