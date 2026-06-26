using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace Dse.Api.Authentication;

/// Loads signing keys from a raw JWKS endpoint. PingAccess hands out a JWKS URI rather than a full
/// OIDC discovery document, so the stock OpenIdConnectConfigurationRetriever can't be used directly.
internal sealed class JwksConfigurationRetriever : IConfigurationRetriever<OpenIdConnectConfiguration>
{
    public async Task<OpenIdConnectConfiguration> GetConfigurationAsync(
        string address,
        IDocumentRetriever retriever,
        CancellationToken cancel
    )
    {
        var json = await retriever.GetDocumentAsync(address, cancel);
        var config = new OpenIdConnectConfiguration { JwksUri = address, JsonWebKeySet = JsonWebKeySet.Create(json) };
        foreach (var key in config.JsonWebKeySet.GetSigningKeys())
        {
            config.SigningKeys.Add(key);
        }

        return config;
    }
}
