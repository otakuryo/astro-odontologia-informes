import type { Page } from '@playwright/test';

export type ToolbarSelectTestId = 'visual-theme-selector' | 'paper-size-selector';

export async function chooseToolbarOption(
  page: Page,
  testId: ToolbarSelectTestId,
  name: string,
) {
  const selector = page.getByTestId(testId);
  await selector.locator('summary').click();
  await selector.getByRole('option', { name }).click();
}
