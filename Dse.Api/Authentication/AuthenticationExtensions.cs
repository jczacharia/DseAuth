using System.Net;
using Microsoft.AspNetCore.Authentication;
using Microsoft.IdentityModel.JsonWebTokens;

namespace Dse.Api.Authentication;

public static class AuthenticationExtensions
{
    public static IServiceCollection AddCompanySso(this IServiceCollection services, IConfiguration configuration)
    {
        var sso = configuration.GetSection("Sso").Get<SsoOptions>() ?? new SsoOptions();

        var auth = services.AddAuthentication(options => options.DefaultScheme = SsoSchemes.Smart);

        // Browser requests use the cookie session; requests bearing a token use bearer validation.
        auth.AddPolicyScheme(SsoSchemes.Smart, "Smart", options =>
        {
            options.ForwardDefaultSelector = context =>
                HasBearerToken(context.Request) ? SsoSchemes.Bearer : SsoSchemes.Cookie;
        });

        // Route a bearer token to the validator matching its issuer.
        auth.AddPolicyScheme(SsoSchemes.Bearer, "Bearer",
            options => { options.ForwardDefaultSelector = context => SelectBearerByIssuer(context.Request, sso); });

        auth.AddCookie(SsoSchemes.Cookie, options =>
        {
            options.LoginPath = "/login";
            options.Cookie.Name = "Dse.Sso";
            options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
        });

        AddOidc(auth, SsoSchemes.AzureAdOidc, sso.AzureAd, sso.ProxyAddress);
        AddOidc(auth, SsoSchemes.PingOidc, sso.Ping, sso.ProxyAddress);

        AddBearer(auth, SsoSchemes.AzureAdBearer, sso.AzureAd, sso.ProxyAddress);
        AddBearer(auth, SsoSchemes.PingBearer, sso.Ping, sso.ProxyAddress);

        return services;
    }

    private static void AddOidc(AuthenticationBuilder auth, string scheme, SsoProvider p, string? proxy)
    {
        auth.AddOpenIdConnect(scheme, options =>
        {
            options.Authority = p.Authority;
            options.ClientId = p.ClientId;
            options.ClientSecret = p.ClientSecret;
            options.CallbackPath = p.CallbackPath;
            options.SignInScheme = SsoSchemes.Cookie;
            options.ResponseType = "code";
            options.UsePkce = true;
            options.SaveTokens = true;
            options.GetClaimsFromUserInfoEndpoint = true;

            options.Scope.Clear();
            options.Scope.Add("openid");
            options.Scope.Add("profile");
            options.Scope.Add("email");

            if (p.NameClaimType is { } name)
            {
                options.TokenValidationParameters.NameClaimType = name;
            }

            if (BackchannelHandler(proxy) is { } handler)
            {
                options.BackchannelHttpHandler = handler;
            }
        });
    }

    private static void AddBearer(AuthenticationBuilder auth, string scheme, SsoProvider p, string? proxy)
    {
        auth.AddJwtBearer(scheme, options =>
        {
            options.Authority = p.Authority;
            options.Audience = p.Audience ?? p.ClientId;
            options.TokenValidationParameters.ValidateIssuer = true;

            if (p.NameClaimType is { } name)
            {
                options.TokenValidationParameters.NameClaimType = name;
            }

            if (BackchannelHandler(proxy) is { } handler)
            {
                options.BackchannelHttpHandler = handler;
            }
        });
    }

    private static bool HasBearerToken(HttpRequest request)
    {
        return ((string?)request.Headers.Authorization)?.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
               == true;
    }

    private static string SelectBearerByIssuer(HttpRequest request, SsoOptions sso)
    {
        try
        {
            var token = ((string)request.Headers.Authorization!)["Bearer ".Length..].Trim();
            var issuer = new JsonWebTokenHandler().ReadJsonWebToken(token).Issuer;
            return IssuerMatches(issuer, sso.Ping.Authority) ? SsoSchemes.PingBearer : SsoSchemes.AzureAdBearer;
        }
        catch
        {
            return SsoSchemes.AzureAdBearer;
        }
    }

    private static bool IssuerMatches(string issuer, string authority)
    {
        return Uri.TryCreate(issuer, UriKind.Absolute, out var i)
               && Uri.TryCreate(authority, UriKind.Absolute, out var a)
               && string.Equals(i.Host, a.Host, StringComparison.OrdinalIgnoreCase);
    }

    private static HttpClientHandler? BackchannelHandler(string? proxy)
    {
        return string.IsNullOrWhiteSpace(proxy)
            ? null
            : new HttpClientHandler { Proxy = new WebProxy(proxy), UseProxy = true };
    }
}
