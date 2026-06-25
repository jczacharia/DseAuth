using System.Security.Claims;
using Dse.Api.Authentication;
using Dse.Api.Gateway;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;

var builder = WebApplication.CreateBuilder(args);

// Serve the Angular build output. Defaults to wwwroot; override with Spa:RootPath (the dist directory).
var spaRoot = builder.Configuration["Spa:RootPath"];
if (!string.IsNullOrWhiteSpace(spaRoot))
{
    builder.Environment.WebRootPath = Path.GetFullPath(spaRoot);
}

builder.Services.AddGatewayIntegration();
builder.Services.AddPingGateway(builder.Configuration);
builder.Services.AddOpenApi();

var app = builder.Build();

app.UseGatewayIntegration();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();
}

// Probes hit the pod directly (not through the gateway, so no token) — must bypass the validator.
// /api/live is self-only (always up unless the process is wedged) so a flaky dependency never restarts
// the pod; /api/ready runs registered checks so traffic is steered away from an unready pod.
app.MapHealthChecks("/api/live", new HealthCheckOptions { Predicate = _ => false }).AllowAnonymous();
app.MapHealthChecks("/api/ready").AllowAnonymous();

// SPA assets are public; the gateway already authenticated the user upstream (old Apache served these freely).
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

// API surface, validated against the gateway-issued Ping JWT (inherits the require-auth fallback policy).
var api = app.MapGroup("/api/v1");

api.MapGet("/me", (ClaimsPrincipal user) => TypedResults.Json(new
{
    name = user.Identity?.Name,
    claims = user.Claims.Select(c => new { c.Type, c.Value }),
}));

// Unknown API routes must 404, never the SPA shell — mirrors the rewrite.conf "!^/api/v1" exclusion.
api.MapFallback(() => Results.NotFound());

// Client-side routes fall back to the Angular shell. Public, like the static assets.
app.MapFallbackToFile("index.html").AllowAnonymous();

await app.RunAsync();
