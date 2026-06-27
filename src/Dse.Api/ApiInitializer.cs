// Copyright (c) PNC Financial Services. All rights reserved.

using System.Runtime.CompilerServices;

namespace Dse.Api;

internal static class ApiInitializer
{
    [ModuleInitializer]
    internal static void Initialize()
    {
        if (Environment.GetEnvironmentVariable("AGENT_PROXYURL") is { } proxyUrl)
        {
            Environment.SetEnvironmentVariable("CI", "true");
            Environment.SetEnvironmentVariable("HTTPS_PROXY", proxyUrl);
        }
    }
}
