// Copyright (c) PNC Financial Services. All rights reserved.

using System.Reflection;
using Dse;
using Dse;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi;

namespace Dse.Api;

/// <summary>Aggregated health of the service: overall status, total evaluation time, and a per-check breakdown.</summary>
/// <param name="Status">Overall status — <c>Healthy</c>, <c>Degraded</c>, or <c>Unhealthy</c>.</param>
/// <param name="TotalDuration">Wall-clock time taken to evaluate every check.</param>
/// <param name="Checks">One entry per registered health check.</param>
public sealed record DseHealthReport(string Status, string TotalDuration, IEnumerable<HealthReportEntry> Checks);

/// <summary>The result of a single registered health check.</summary>
/// <param name="Name">The check's registration name (e.g. <c>elastic</c>, <c>self</c>).</param>
/// <param name="Status">This check's status.</param>
/// <param name="Duration">How long this check took.</param>
/// <param name="Description">Human-readable detail the check chose to report, if any.</param>
/// <param name="Exception">The failure message when the check threw, if any.</param>
/// <param name="Data">Free-form diagnostic data the check attached.</param>
public sealed record HealthReportEntry(
    string Name,
    string Status,
    string Duration,
    string? Description,
    string? Exception,
    IReadOnlyDictionary<string, object> Data
);

public static class HealthCheckEndpoints
{
    // MapHealthChecks maps a raw RequestDelegate pipeline, so its endpoints carry neither a MethodInfo nor an
    // IHttpMethodMetadata — the two pieces EndpointMetadataApiDescriptionProvider requires before it will emit an
    // ApiDescription. Without a description the OpenAPI generator never visits the endpoint, so the operation
    // transformer below never runs. We supply both: GET (the only verb a probe needs) and a no-result marker whose
    // ApiDescription the transformer fully overwrites.
    private static readonly MethodInfo s_healthEndpointMarker =
#pragma warning disable S3011
    typeof(HealthCheckEndpoints).GetMethod(nameof(DescribeHealthEndpoint), BindingFlags.NonPublic | BindingFlags.Static)!;
#pragma warning restore S3011

    private static async Task WriteHealthReport(HttpContext context, HealthReport report)
    {
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(
            new DseHealthReport(
                report.Status.ToString("G"),
                report.TotalDuration.ToString("g"),
                report.Entries.Select(e => new HealthReportEntry(
                    e.Key,
                    e.Value.Status.ToString("G"),
                    e.Value.Duration.ToString("g"),
                    e.Value.Description,
                    e.Value.Exception?.Message,
                    e.Value.Data
                ))
            ),
            JsonDefaults.Pretty
        );
    }

    private static Task DescribeHealthEndpoint() => Task.CompletedTask;

    extension(IEndpointRouteBuilder endpoints)
    {
        public void MapDseHealthChecks()
        {
            RouteGroupBuilder group = endpoints.MapGroup("health").WithTags("Health");

            group
                .MapHealthChecks("", new() { ResponseWriter = WriteHealthReport })
                .ApplyDefaults("Full health report", "Every registered check.");

            group
                .MapHealthChecks(
                    "startup",
                    new() { Predicate = static r => r.Tags.Contains("startup"), ResponseWriter = WriteHealthReport }
                )
                .ApplyDefaults("Full health report", "Every registered check.");

            group
                .MapHealthChecks(
                    "live",
                    new() { Predicate = static r => r.Tags.Contains("live"), ResponseWriter = WriteHealthReport }
                )
                .ApplyDefaults("Liveness probe", "Process is up — no dependency checks run.");

            group
                .MapHealthChecks(
                    "ready",
                    new() { Predicate = static r => r.Tags.Contains("ready"), ResponseWriter = WriteHealthReport }
                )
                .ApplyDefaults("Readiness probe", "Process and its ready-tagged dependencies are reachable.");

            foreach (
                string name in endpoints
                    .ServiceProvider.GetRequiredService<IOptions<HealthCheckServiceOptions>>()
                    .Value.Registrations.Select(r => r.Name)
            )
            {
                group
                    .MapHealthChecks($"{name}", new() { Predicate = r => r.Name == name, ResponseWriter = WriteHealthReport })
                    .ApplyDefaults($"Health: {name}", $"The '{name}' check in isolation.");
            }
        }
    }

    extension(IEndpointConventionBuilder builder)
    {
        private void ApplyDefaults(string summary, string description) =>
            builder
                .WithMetadata(new HttpMethodMetadata(["GET"]), s_healthEndpointMarker)
                .AddOpenApiOperationTransformer(
                    async (operation, ctx, ct) =>
                    {
                        operation.Summary = summary;
                        operation.Description = description;

                        ctx.Document!.AddComponent(
                            nameof(DseHealthReport),
                            await ctx.GetOrCreateSchemaAsync(typeof(DseHealthReport), parameterDescription: null, ct)
                        );
                        var schemaRef = new OpenApiSchemaReference(nameof(DseHealthReport), ctx.Document);

                        operation.Responses ??= [];
                        operation.Responses["200"] = new OpenApiResponse
                        {
                            Description =
                                "The service is serving traffic — overall status is Healthy or Degraded (see the body's status field).",
                            Content = new Dictionary<string, OpenApiMediaType>
                            {
                                ["application/json"] = new() { Schema = schemaRef },
                            },
                        };
                        operation.Responses["503"] = new OpenApiResponse
                        {
                            Description = "The service or an upstream dependency is unhealthy.",
                            Content = new Dictionary<string, OpenApiMediaType>
                            {
                                ["application/json"] = new() { Schema = schemaRef },
                            },
                        };
                    }
                );
    }
}
