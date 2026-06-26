// Copyright (c) PNC Financial Services. All rights reserved.

using System.ComponentModel.DataAnnotations;

namespace Dse.Api.Authentication;

public sealed class PingGatewayOptions
{
    [Required]
    public string CookieName { get; set; } = "PA.APP_DSE";

    public string? JwksUri { get; set; }

    public string? Authority { get; set; }

    public string? Issuer { get; set; }

    public string? Audience { get; set; }

    public string? NameClaimType { get; set; } = "sub";

    public bool RequireHttpsMetadata { get; set; } = true;

    public string? ProxyAddress { get; set; }
}
