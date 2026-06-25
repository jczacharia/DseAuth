using System.Security.Claims;
using Dse.Api.Authentication;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCompanySso(builder.Configuration);
builder.Services.AddAuthorization();
builder.Services.AddOpenApi();

var app = builder.Build();

app.MapOpenApi();

app.UseAuthentication();
app.UseAuthorization();

// Provider chooser: a browser hits /login, then follows one of these to sign in.
app.MapGet("/login", () => Results.Ok(new { azure = "/login/azure", ping = "/login/ping" }));

app.MapGet("/login/azure",
    (string? returnUrl) => Results.Challenge(new() { RedirectUri = returnUrl ?? "/me" }, [SsoSchemes.AzureAdOidc]));

app.MapGet("/login/ping",
    (string? returnUrl) => Results.Challenge(new() { RedirectUri = returnUrl ?? "/me" }, [SsoSchemes.PingOidc]));

app.MapPost("/logout", () => Results.SignOut(new() { RedirectUri = "/" }, [SsoSchemes.Cookie]));

// Who is this employee? Works for both cookie (browser) and bearer (API) callers.
app.MapGet("/me", (ClaimsPrincipal user) => TypedResults.Json(new
    {
        name = user.Identity?.Name,
        claims = user.Claims.Select(c => new { c.Type, c.Value }),
    }))
    .RequireAuthorization();

app.MapGet("/auth-test", () => TypedResults.Json(new { works = true })).RequireAuthorization();

await app.RunAsync();
