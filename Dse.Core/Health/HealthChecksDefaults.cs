// Copyright (c) PNC Financial Services. All rights reserved.

namespace Dse.Health;

public static class HealthChecksDefaults
{
    /// <summary>
    /// Shared readiness-probe budget. Evaluated at health-check registration time (before options bind), so it is a
    /// constant rather than a per-environment config knob — a probe timeout is not an operational dial.
    /// </summary>
    public static readonly TimeSpan ReadinessTimeout = TimeSpan.FromSeconds(8);
}
