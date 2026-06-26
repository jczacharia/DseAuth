// Copyright (c) PNC Financial Services. All rights reserved.

using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;

namespace Dse.Core;

public sealed class WebAppExtender(Action<WebApplication> configure)
{
    public void Register(WebApplication app) => configure(app);
}

public static class WebAppExtenderExtensions
{
    extension(IServiceCollection services)
    {
        public IServiceCollection AddWebAppExtender(Action<WebApplication> configure) =>
            services.AddSingleton(new WebAppExtender(configure));
    }
}
