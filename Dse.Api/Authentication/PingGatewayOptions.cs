namespace Dse.Api.Authentication;

/// Bound from the "PingGateway" configuration section. The Ping Gateway (PingAccess) authenticates the user
/// upstream and forwards a signed JWT; this app only validates it. Env-var equivalents from dse-deploy shown.
public sealed class PingGatewayOptions
{
    /// Cookie carrying the gateway-issued JWT (dse-deploy: PING_TOKEN_NAME, e.g. "PA.APP_DSE").
    public string CookieName { get; init; } = "PA.APP_DSE";

    /// Optional header fallback (some gateways inject a header instead of/alongside the cookie, e.g. "ifs_jwt").
    public string? HeaderName { get; init; }

    /// Direct JWKS endpoint (dse-deploy: PING_JWKS_ENDPOINT, e.g. ".../ext/JwtSigning"); preferred over Authority.
    public string? JwksUri { get; init; }

    /// OIDC authority for key discovery, used only when JwksUri is unset.
    public string? Authority { get; init; }

    public string? Issuer { get; init; }

    /// Expected token audience (dse-deploy: PINGIDENTITY_AUDIENCE, e.g. "wf-rnd").
    public string? Audience { get; init; }

    /// Claim surfaced as User.Identity.Name. Verify against a real token (often "sub" or a custom user-id claim).
    public string? NameClaimType { get; init; } = "sub";

    public bool RequireHttpsMetadata { get; init; } = true;

    /// Optional corporate proxy for fetching JWKS. Internal Ping hosts normally bypass it via NO_PROXY.
    public string? ProxyAddress { get; init; }
}
