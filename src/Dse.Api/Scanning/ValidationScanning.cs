// Copyright (c) PNC Financial Services. All rights reserved.

using FluentValidation;
using ServiceScan.SourceGenerator;

namespace Dse.Api.Scanning;

public static partial class ValidationScanning
{
    [GenerateServiceRegistrations(
        AssignableTo = typeof(IValidator<>),
        Lifetime = ServiceLifetime.Scoped,
        AssemblyNameFilter = "Dse.*"
    )]
    public static partial IServiceCollection AddDseValidators(this IServiceCollection services);
}
