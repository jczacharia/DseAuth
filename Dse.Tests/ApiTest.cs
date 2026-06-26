// Copyright (c) PNC Financial Services. All rights reserved.

using Microsoft.Extensions.DependencyInjection;

namespace Dse.Tests;

public abstract class ApiTest(ITestOutputHelper outputHelper) : IAsyncLifetime
{
    private AsyncServiceScope _scope;
    private ApiHost Host { get; } = new(outputHelper);
    protected HttpClient Client => Host.CreateClient();
    protected IServiceProvider Services => _scope.ServiceProvider;
    protected ITestOutputHelper Out => outputHelper;

    public virtual ValueTask InitializeAsync()
    {
        _scope = Host.Services.CreateAsyncScope();
        return ValueTask.CompletedTask;
    }

    public virtual async ValueTask DisposeAsync()
    {
        await _scope.DisposeAsync();
        GC.SuppressFinalize(this);
    }
}
