// Copyright (c) PNC Financial Services. All rights reserved.

namespace Dse.Api;

public static class ApiHostExtensions
{
    extension(IHostApplicationBuilder builder)
    {
        public void RemoveWindowsEventLogProvider()
        {
            const string eventLogProvider = "Microsoft.Extensions.Logging.EventLog.EventLogLoggerProvider";

            foreach (
                ServiceDescriptor descriptor in builder
                    .Services.Where(d =>
                        d.ServiceType == typeof(ILoggerProvider) && d.ImplementationType?.FullName == eventLogProvider
                    )
                    .ToList()
            )
            {
                builder.Services.Remove(descriptor);
            }
        }
    }
}
