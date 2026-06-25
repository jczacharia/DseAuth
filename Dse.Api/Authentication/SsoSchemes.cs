namespace Dse.Api.Authentication;

/// Authentication scheme names. Two selector schemes sit in front of the real handlers:
/// Smart routes browser (cookie) vs API (bearer); Bearer routes by token issuer.
public static class SsoSchemes
{
    public const string Smart = "Smart";
    public const string Bearer = "Bearer";

    public const string Cookie = "Cookie";

    public const string AzureAdOidc = "AzureAd";
    public const string PingOidc = "Ping";

    public const string AzureAdBearer = "AzureAdBearer";
    public const string PingBearer = "PingBearer";
}
