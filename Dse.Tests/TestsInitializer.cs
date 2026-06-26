// Copyright (c) PNC Financial Services. All rights reserved.

using System.Diagnostics;
using System.Runtime.CompilerServices;
using Dse.Api;
using Microsoft.Playwright;

namespace Dse.Tests;

internal static class TestsInitializer
{
    [ModuleInitializer]
    internal static void Initialize()
    {
        ApiInitializer.Initialize();

        if (
            Environment.GetEnvironmentVariable("CI")?.Equals("true", StringComparison.InvariantCulture) is true
            && Microsoft.Playwright.Program.Main(["install", "chromium"]) is var exitCode and not 0
        )
        {
            Console.Error.WriteLine($"Playwright install failed with exit code {exitCode}.");
        }

        if (Debugger.IsAttached)
        {
            Environment.SetEnvironmentVariable("PWDEBUG", "1");
        }

        Assertions.SetDefaultExpectTimeout(10_000);

        Environment.SetEnvironmentVariable("DOTNET_HOSTBUILDER__RELOADCONFIGONCHANGE", "false");
    }
}
