// Copyright (c) PNC Financial Services. All rights reserved.

namespace Dse;

[AttributeUsage(AttributeTargets.Class)]
public class OptionsAttribute : Attribute
{
    public string? Name { get; init; }
    public string? Path { get; init; }
}
