// Copyright (c) PNC Financial Services. All rights reserved.

using System.Security.Claims;
using Dse;
using Dse.Api.Authentication;
using Dse.Api.Gateway;
using Dse.Core;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddGatewayIntegration();
builder.Services.AddPingGateway(builder.Configuration);
builder.Services.AddOpenApi();

if (DseEnvironment.IsDocumentGenerationBuild)
{
    // Don't validate when generating OpenAPI documents; else with throw
    builder.Services.RemoveAll<IStartupValidator>();
}

WebApplication app = builder.Build();

app.UseGatewayIntegration();

app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();
}

// Probes hit the pod directly (not through the gateway, so no token) — must bypass the validator.
// /api/live is self-only (no dependencies) so a flaky dependency never restarts the pod; /api/ready
// runs the "ready"-tagged checks so traffic is steered away from an unready pod.
app.MapHealthChecks("/api/live", new() { Predicate = c => c.Tags.Contains("live") }).AllowAnonymous();
app.MapHealthChecks("/api/ready", new() { Predicate = c => c.Tags.Contains("ready") }).AllowAnonymous();

// SPA assets are public; the gateway already authenticated the user upstream (old Apache served these freely).
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

// API surface, validated against the gateway-issued Ping JWT (inherits the require-auth fallback policy).
RouteGroupBuilder api = app.MapGroup("/api").RequireAuthorization();

api.MapGet(
    "/me",
    (ClaimsPrincipal user) =>
        TypedResults.Json(new { name = user.Identity?.Name, claims = user.Claims.Select(c => new { c.Type, c.Value }) })
);

foreach (WebAppExtender reg in app.Services.GetServices<WebAppExtender>())
{
    reg.Register(app);
}

// Unknown API routes must 404, never the SPA shell — mirrors the rewrite.conf "!^/api/v1" exclusion.
api.MapFallback(TypedResults.NotFound);

// Client-side routes fall back to the Angular shell. Public, like the static assets.
app.MapFallbackToFile("index.html").AllowAnonymous();

await app.RunAsync();
