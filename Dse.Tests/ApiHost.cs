// Copyright (c) PNC Financial Services. All rights reserved.

using Dse.Core;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration.EnvironmentVariables;
using Microsoft.Extensions.Logging;

[assembly: CaptureConsole(CaptureError = false, CaptureOut = false)]

namespace Dse.Tests;

public sealed class ApiHost(ITestOutputHelper outputHelper, Action<IWebHostBuilder>? configure = null)
    : WebApplicationFactory<Program>
{
    public string BaseAddress => ClientOptions.BaseAddress.ToString().TrimEnd('/');

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        UseKestrel(0);
        builder.UseEnvironment("Test");
        builder.ConfigureAppConfiguration(sources =>
        {
            for (int i = sources.Sources.Count - 1; i >= 0; i--)
            {
                if (sources.Sources[i] is EnvironmentVariablesConfigurationSource)
                {
                    sources.Sources.RemoveAt(i);
                }
            }
        });
        builder.ConfigureLogging(logging =>
        {
            logging.ClearProviders();
            logging.AddXUnit(outputHelper);
        });
        configure?.Invoke(builder);
    }

    public static ApiHost WithExtender(ITestOutputHelper outputHelper, Action<WebApplication> configure) =>
        new(outputHelper, builder => builder.ConfigureServices(services => services.AddWebAppExtender(configure)));
}
