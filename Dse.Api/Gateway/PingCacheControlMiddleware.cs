namespace Dse.Api.Gateway;

/// Translates the Apache `pingheader.conf` directive. Authenticated documents must not be cached so that,
/// after a Ping logout, the browser can't redisplay them from cache. Applied to HTML and API responses;
/// fingerprinted static assets keep their normal long-lived caching.
public sealed class PingCacheControlMiddleware(RequestDelegate next)
{
    private const string NoStore =
        "max-age=0, no-cache, no-store, must-revalidate, private, proxy-revalidate, no-transform";

    public Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(static state =>
        {
            var ctx = (HttpContext)state;
            bool isApi = ctx.Request.Path.StartsWithSegments("/api");
            bool isHtml = ctx.Response.ContentType?.Contains("text/html", StringComparison.OrdinalIgnoreCase) == true;
            if (isApi || isHtml)
            {
                ctx.Response.Headers.CacheControl = NoStore;
            }

            return Task.CompletedTask;
        }, context);

        return next(context);
    }
}
