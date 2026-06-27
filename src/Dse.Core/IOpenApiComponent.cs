// Copyright (c) PNC Financial Services. All rights reserved.

using System.Reflection;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace Dse;

public interface IOpenApiComponent;

public static class OpenApiComponentExtensions
{
    extension(OpenApiOptions options)
    {
        public void AddComponentsFromAssemblies(params Assembly[] assemblies) =>
            options.AddDocumentTransformer(
                async (document, context, cancellationToken) =>
                {
                    foreach (
                        Type type in assemblies
                            .SelectMany(a => a.GetTypes())
                            .Where(type =>
                                type is { IsAbstract: false, IsInterface: false }
                                && type.IsAssignableTo(typeof(IOpenApiComponent))
                            )
                    )
                    {
                        OpenApiSchema schema = await context.GetOrCreateSchemaAsync(
                            type,
                            parameterDescription: null,
                            cancellationToken
                        );
                        document.AddComponent(type.Name, schema);
                    }
                }
            );
    }
}
