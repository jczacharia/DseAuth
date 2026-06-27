// Copyright (c) PNC Financial Services. All rights reserved.

using Microsoft.Extensions.DependencyInjection;
using Microsoft.Playwright;
using Microsoft.Playwright.Xunit.v3;

namespace Dse.Tests;

public abstract class UiTest(ITestOutputHelper outputHelper) : PageTest
{
    private AsyncServiceScope _scope;
    private ApiHost Host { get; } = new(outputHelper);
    protected HttpClient Client => Host.CreateClient();
    protected IServiceProvider Services => _scope.ServiceProvider;

    public override ValueTask InitializeAsync()
    {
        _scope = Host.Services.CreateAsyncScope();
        SetDefaultExpectTimeout(5_000);
        return base.InitializeAsync();
    }

    public override async ValueTask DisposeAsync()
    {
        await _scope.DisposeAsync();
        await base.DisposeAsync();
        GC.SuppressFinalize(this);
    }

    public override BrowserNewContextOptions ContextOptions()
    {
        BrowserNewContextOptions options = Playwright.Devices["Desktop Chrome"];
        options.Locale = "en-US";
        options.ColorScheme = ColorScheme.Dark;
        options.IgnoreHTTPSErrors = true;
        options.BaseURL = Host.BaseAddress;
        return options;
    }
}
