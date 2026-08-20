using BillingApi.Clients;
using BillingApi.Data;
using BillingApi.Endpoints;
using BillingApi.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "BillingApi", Version = "v1" });
    options.AddSecurityDefinition("X-Tenant-Id", new OpenApiSecurityScheme
    {
        Name = "X-Tenant-Id",
        Type = SecuritySchemeType.ApiKey,
        In = ParameterLocation.Header,
        Description = "Tenant identifier (GUID) -- required on every endpoint except /health."
    });
    options.AddSecurityDefinition("X-Gateway-Webhook-Secret", new OpenApiSecurityScheme
    {
        Name = "X-Gateway-Webhook-Secret",
        Type = SecuritySchemeType.ApiKey,
        In = ParameterLocation.Header,
        Description = "Required only on POST /payment-checkouts/{id}/callback -- the configured PaymentGateway:WebhookSecret value."
    });
    options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
    {
        [new OpenApiSecuritySchemeReference("X-Tenant-Id", document)] = [],
        [new OpenApiSecuritySchemeReference("X-Gateway-Webhook-Secret", document)] = []
    });
});
builder.Services.AddDbContext<BillingDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("BillingDb"), sqlOptions => sqlOptions.EnableRetryOnFailure()));
builder.Services.AddScoped<TenantContext>();
builder.Services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContext>());
builder.Services.AddScoped<BillingApi.Services.WalletCreditService>();
builder.Services.AddSingleton<IPaymentGatewayClient, StubPaymentGatewayClient>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<BillingDbContext>();
    if (!app.Environment.IsEnvironment("Testing"))
    {
        db.Database.Migrate();
    }
}

app.UseExceptionHandler();
app.UseStatusCodePages();

app.UseMiddleware<TenantIdMiddleware>();

app.MapGet("/health", () => Results.Ok(new { status = "Healthy", service = "BillingApi" }));
app.MapWalletEndpoints();
app.MapPaymentCheckoutEndpoints();

app.Run();

public partial class Program { }
