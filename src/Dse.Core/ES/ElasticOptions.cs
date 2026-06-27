// Copyright (c) PNC Financial Services. All rights reserved.

using FluentValidation;

namespace Dse.ES;

[Options(Path = "Elastic")]
public sealed class ElasticOptions
{
    public string BaseAddress { get; set; } = null!;
    public string? ApiKey { get; set; }
    public string? Username { get; set; }
    public string? Password { get; set; }
}

public sealed class ElasticOptionsValidator : AbstractValidator<ElasticOptions>
{
    public ElasticOptionsValidator()
    {
        RuleFor(x => x.BaseAddress)
            .Must(url => Uri.IsWellFormedUriString(url, UriKind.Absolute))
            .WithMessage("BaseAddress must be a valid absolute URL.");
    }
}
