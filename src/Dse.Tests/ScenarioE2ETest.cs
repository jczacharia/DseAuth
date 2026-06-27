// Copyright (c) PNC Financial Services. All rights reserved.

namespace Dse.Tests;

// Base for browser scenarios driven by the TS Playwright suite. .NET owns the lifecycle: it hosts the
// app, seeds Elasticsearch via SeedAsync, then runs the tagged Playwright scenario against the live URL.
public abstract class ScenarioE2ETest(ITestOutputHelper output) : IAsyncLifetime
{
    private readonly ApiHost _host = new(output);
    protected ITestOutputHelper Output { get; } = output;
    protected IServiceProvider Services => _host.Services;
    protected string BaseUrl => _host.BaseAddress;

    public async ValueTask InitializeAsync()
    {
        _ = _host.CreateClient(); // boots Kestrel on a real port; BaseAddress becomes the live URL
        await SeedAsync();
    }

    public async ValueTask DisposeAsync()
    {
        await _host.DisposeAsync();
        GC.SuppressFinalize(this);
    }

    // Override to seed Elasticsearch (or any state) for the scenario before the browser runs.
    protected virtual Task SeedAsync() => Task.CompletedTask;

    protected async Task RunScenarioAsync(string scenarioTag)
    {
        int exitCode = await PlaywrightRunner.RunAsync(scenarioTag, BaseUrl, Output);
        Assert.True(exitCode == 0, $"Playwright scenario '{scenarioTag}' failed (exit {exitCode})");
    }
}
