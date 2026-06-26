// Copyright (c) PNC Financial Services. All rights reserved.

namespace Dse.Tests.UI;

public sealed class UiStartupTests(ITestOutputHelper outputHelper) : UiTest(outputHelper)
{
    [Fact]
    public async Task AppRootInDocument()
    {
        await Page.GotoAsync("/");
        await Expect(Page).ToHaveTitleAsync("Enterprise Search");
    }
}
