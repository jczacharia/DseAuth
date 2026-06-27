// Copyright (c) PNC Financial Services. All rights reserved.

namespace Dse.Tests.UI;

public sealed class UiStartupTests(ITestOutputHelper output) : ScenarioE2ETest(output)
{
    [Fact]
    public Task AppRoot() => RunScenarioAsync("@startup");
}
