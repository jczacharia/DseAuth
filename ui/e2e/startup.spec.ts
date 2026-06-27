import {expect, test} from './fixtures';

// Ported from Dse.Tests UiStartupTests.AppRootInDocument. The @startup tag drives .NET's --grep.
test('app root renders @startup', async ({page}) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Enterprise Search');
});
