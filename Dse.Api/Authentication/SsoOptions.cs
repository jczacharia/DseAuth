namespace Dse.Api.Authentication;

/// Bound from the "Sso" configuration section.
public sealed class SsoOptions
{
    public SsoProvider AzureAd { get; init; } = new();
    public SsoProvider Ping { get; init; } = new();

    /// Optional corporate proxy for the backchannel (metadata/JWKS), e.g. "http://proxy.pncbank.com:8080".
    /// Leave unset for local dev with direct internet access.
    public string? ProxyAddress { get; init; }
}

/// One OIDC provider, used for both interactive (web) sign-in and bearer (API) validation.
public sealed class SsoProvider
{
    public string Authority { get; init; } = "";
    public string ClientId { get; init; } = "";

    /// Web sign-in only; supplied via user-secrets, never committed config.
    public string? ClientSecret { get; init; }

    /// API token validation; defaults to ClientId when unset.
    public string? Audience { get; init; }

    /// Must be registered as a redirect URI with the identity provider.
    public string CallbackPath { get; init; } = "/signin-oidc";

    /// Claim to surface as User.Identity.Name (e.g. "userid" for Ping, "preferred_username" for Azure).
    public string? NameClaimType { get; init; }
}
