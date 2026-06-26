using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Dse.Api.Gateway;

/// Everything needed for the app to live correctly behind the Ping Gateway + OpenShift router.
public static class GatewayExtensions
{
    private const string NoStore = "max-age=0, no-cache, no-store, must-revalidate, private, proxy-revalidate, no-transform";

    extension(IServiceCollection services)
    {
        public void AddGatewayIntegration()
        {
            // The gateway and router terminate TLS and rewrite host/IP; trust their X-Forwarded-* headers so
            // Request.Scheme/Host/RemoteIp reflect the original client (correct redirects, secure cookies, logging).
            services.Configure<ForwardedHeadersOptions>(options =>
            {
                options.ForwardedHeaders =
                    ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost;
                options.ForwardLimit = null; // gateway -> router is more than one hop
                options.KnownIPNetworks.Clear(); // only in-cluster infrastructure can reach the pod
                options.KnownProxies.Clear();
            });

            // "self" (liveness) has no dependencies; readiness checks get the "ready" tag as they're added.
            services.AddHealthChecks().AddCheck("self", () => HealthCheckResult.Healthy(), ["live"]);

            // Secure by default: every endpoint requires a gateway-validated token unless it explicitly opts out
            // (health probes, the SPA shell, static assets). Mirrors "rest all should go through your validator".
            services
                .AddAuthorizationBuilder()
                .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());
        }
    }

    extension(IApplicationBuilder app)
    {
        public void UseGatewayIntegration()
        {
            // must run before anything that reads scheme/host
            app.UseForwardedHeaders();

            // Authenticated requests must not be cached so that, after a Ping logout, the browser can't redisplay them from cache.
            app.Use(
                (context, next) =>
                {
                    context.Response.OnStarting(
                        static state =>
                        {
                            if (state is not HttpContext ctx)
                            {
                                return Task.CompletedTask;
                            }

                            if (
                                ctx.Request.Path.StartsWithSegments("/api")
                                || ctx.Response.ContentType?.Contains("text/html", StringComparison.OrdinalIgnoreCase) is true
                            )
                            {
                                ctx.Response.Headers.CacheControl = NoStore;
                            }

                            return Task.CompletedTask;
                        },
                        context
                    );

                    return next(context);
                }
            );
        }
    }
}
