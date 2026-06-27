// Copyright (c) PNC Financial Services. All rights reserved.

using System.Net;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace Dse.Api.Authentication;

public static class PingGatewayExtensions
{
    private static void Configure(JwtBearerOptions jwt, PingGatewayOptions options)
    {
        HttpClientHandler? handler = BackchannelHandler(options.ProxyAddress);
        if (handler is not null)
        {
            jwt.BackchannelHttpHandler = handler;
        }

        jwt.RequireHttpsMetadata = options.RequireHttpsMetadata;

        if (!string.IsNullOrWhiteSpace(options.JwksUri))
        {
            HttpClient http = handler is null ? new() : new HttpClient(handler);
            jwt.ConfigurationManager = new ConfigurationManager<OpenIdConnectConfiguration>(
                options.JwksUri,
                new JwksConfigurationRetriever(),
                new HttpDocumentRetriever(http) { RequireHttps = options.RequireHttpsMetadata }
            );
        }
        else if (!string.IsNullOrWhiteSpace(options.Authority))
        {
            jwt.Authority = options.Authority;
        }

        TokenValidationParameters validation = jwt.TokenValidationParameters;
        validation.ValidateIssuer = !string.IsNullOrWhiteSpace(options.Issuer);
        if (validation.ValidateIssuer)
        {
            validation.ValidIssuer = options.Issuer;
        }

        validation.ValidateAudience = !string.IsNullOrWhiteSpace(options.Audience);
        if (validation.ValidateAudience)
        {
            validation.ValidAudience = options.Audience;
        }

        if (!string.IsNullOrWhiteSpace(options.NameClaimType))
        {
            validation.NameClaimType = options.NameClaimType;
        }

        jwt.Events = new()
        {
            // The gateway delivers the JWT in the PA.* cookie; fall back to a header if one is configured.
            OnMessageReceived = context =>
            {
                if (context.Request.Cookies.TryGetValue(options.CookieName, out string? cookie) && !string.IsNullOrEmpty(cookie))
                {
                    context.Token = cookie;
                }
                else if (context.HttpContext.Request.Headers.Authorization.FirstOrDefault() is { } raw)
                {
                    context.Token = raw.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
                        ? raw["Bearer ".Length..].Trim()
                        : raw;
                }

                return Task.CompletedTask;
            },

            // Expired/invalid token -> clean 401 the SPA can detect, so it can drive a top-level re-auth
            // through the gateway (which silently refreshes against the still-valid SSO session). No HTML.
            OnChallenge = context =>
            {
                context.Response.Headers[options.ReAuthHeader] = "true";
                return Task.CompletedTask;
            },
        };
    }

    private static HttpClientHandler? BackchannelHandler(string? proxy) =>
        string.IsNullOrWhiteSpace(proxy) ? null : new HttpClientHandler { Proxy = new WebProxy(proxy), UseProxy = true };

    extension(IServiceCollection services)
    {
        public void AddPingGateway(IConfiguration configuration)
        {
            // Validate configuration at startup (fail fast) per the options pattern.
            services
                .AddOptions<PingGatewayOptions>()
                .BindConfiguration(PingGatewayDefaults.ConfigSection)
                .ValidateDataAnnotations()
                .Validate(
                    o => !string.IsNullOrWhiteSpace(o.JwksUri) || !string.IsNullOrWhiteSpace(o.Authority),
                    "PingGateway: either JwksUri or Authority must be set to resolve signing keys."
                )
                .ValidateOnStart();

            // The JwtBearer handler is configured at startup, so read the bound values directly here.
            PingGatewayOptions options =
                configuration.GetSection(PingGatewayDefaults.ConfigSection).Get<PingGatewayOptions>() ?? new PingGatewayOptions();

            services
                .AddAuthentication(PingGatewayDefaults.AuthenticationScheme)
                .AddJwtBearer(PingGatewayDefaults.AuthenticationScheme, jwt => Configure(jwt, options));
        }
    }
}
