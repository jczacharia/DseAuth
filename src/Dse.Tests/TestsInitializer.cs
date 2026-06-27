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

        // Browser provisioning is handled by the InstallPlaywright MSBuild target (proxy-aware, Node
        // runner). Nothing to install here.
        if (Debugger.IsAttached)
        {
            Environment.SetEnvironmentVariable("PWDEBUG", "1");
        }

        Assertions.SetDefaultExpectTimeout(10_000);

        Environment.SetEnvironmentVariable("DOTNET_HOSTBUILDER__RELOADCONFIGONCHANGE", "false");
    }
}
