using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;

namespace Dse.Api.Gateway;

/// Everything needed for the app to live correctly behind the Ping Gateway + OpenShift router.
public static class GatewayExtensions
{
    public static IServiceCollection AddGatewayIntegration(this IServiceCollection services)
    {
        // The gateway and router terminate TLS and rewrite host/IP; trust their X-Forwarded-* headers so
        // Request.Scheme/Host/RemoteIp reflect the original client (correct redirects, secure cookies, logging).
        services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor
                                       | ForwardedHeaders.XForwardedProto
                                       | ForwardedHeaders.XForwardedHost;
            options.ForwardLimit = null;     // gateway -> router is more than one hop
            options.KnownIPNetworks.Clear(); // only in-cluster infrastructure can reach the pod
            options.KnownProxies.Clear();
        });

        services.AddHealthChecks();

        // Secure by default: every endpoint requires a gateway-validated token unless it explicitly opts out
        // (health probes, the SPA shell, static assets). Mirrors "rest all should go through your validator".
        services.AddAuthorizationBuilder()
            .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());

        return services;
    }

    public static WebApplication UseGatewayIntegration(this WebApplication app)
    {
        app.UseForwardedHeaders(); // must run before anything that reads scheme/host
        app.UseMiddleware<PingCacheControlMiddleware>();
        return app;
    }
}
