// Copyright (c) PNC Financial Services. All rights reserved.

using Dse;
using Dse.Api;
using Dse.Api.Authentication;
using Dse.Api.Gateway;
using Dse.Api.Scanning;
using Dse.Extensions;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi;
using Scalar.AspNetCore;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

if (builder.Environment.IsLocalBuild())
{
    builder.Configuration.AddUserSecrets("dse");
}

builder.Services.AddDseOptions();
builder.Services.AddDseValidators();

builder.Services.AddGatewayIntegration();
builder.Services.AddPingGateway(builder.Configuration);

builder.Services.AddProblemDetails(static s => s.ApplyCoreCustomization());
builder.Services.AddScoped<ProblemDetailsFactory, DefaultProblemDetailsFactory>();
builder.Services.ConfigureHttpClientDefaults(static o => o.RemoveAllLoggers());
builder.Services.AddMemoryCache();
builder.Services.AddHttpContextAccessor();
builder.RemoveWindowsEventLogProvider();

builder.Host.UseDefaultServiceProvider(static options =>
{
    options.ValidateScopes = true;
    options.ValidateOnBuild = true;
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi(opts =>
{
    opts.OpenApiVersion = OpenApiSpecVersion.OpenApi3_1;
    opts.MapVogenTypesInDse();
    opts.AddComponentsFromAssemblies(AppDomain.CurrentDomain.GetAssemblies());
    opts.AddDocumentTransformer(
        static (doc, _, _) =>
        {
            doc.Info.Title = "DSE";
            doc.Info.Description = "Enterprise Search";
            return Task.CompletedTask;
        }
    );
});

if (CoreEnvironment.IsDocumentGenerationBuild)
{
    // Don't validate when generating OpenAPI documents; else with throw
    builder.Services.RemoveAll<IStartupValidator>();
}

WebApplication app = builder.Build();

app.UseGatewayIntegration();

app.UseExceptionHandler();
app.UseStatusCodePages();

RouteGroupBuilder api = app.MapGroup("/api").WithTags("Api");
api.MapOpenApi();
api.MapScalarApiReference();

// SPA assets are public; the gateway already authenticated the user upstream (old Apache served these freely).
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

foreach (WebAppExtender reg in app.Services.GetServices<WebAppExtender>())
{
    reg.Register(app);
}

// Unknown API routes must 404, never the SPA shell — mirrors the rewrite.conf "!^/api/v1" exclusion.
api.MapFallback(TypedResults.NotFound);

// Client-side routes fall back to the Angular shell. Public, like the static assets.
app.MapFallbackToFile("index.html").AllowAnonymous();

await app.RunAsync();
