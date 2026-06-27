// Copyright (c) PNC Financial Services. All rights reserved.

using System.Security.Claims;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Dse.Endpoints;

public sealed class MeEndpoint : IEndpoint
{
    public static void MapEndpoint(IEndpointRouteBuilder builder) =>
        builder.MapGet(
            "/me",
            (ClaimsPrincipal user) =>
                TypedResults.Json(new { name = user.Identity?.Name, claims = user.Claims.Select(c => new { c.Type, c.Value }) })
        );
}
