import { test, expect, openGame } from './helpers.js';

test('keeps Chaos forecast navigation clear on a phone and advances to Random briefing @phone', async ({ page, errors }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openGame(page);
  await page.getByRole('button', { name: 'Demo', exact: true }).click();
  const practice = page.getByRole('region', { name: 'WORM practice', exact: true });
  await expect(practice).toBeVisible({ timeout: 180_000 });
  // Skip lesson content through the public navigation, never mutating store
  // state. Verify each step before the next tap so exit animations cannot
  // swallow a tap or accidentally skip the Chaos briefing.
  for (let step = 1; step < 9; step++) {
    const progress = page.getByRole('progressbar', { name: 'Demo progress', exact: true });
    await expect(progress).toHaveAttribute('aria-valuenow', String(step));
    await page.getByRole('button', { name: 'Skip Step', exact: true }).click();
    await expect(progress).toHaveAttribute('aria-valuenow', String(step + 1));
  }
  await page.getByRole('button', { name: 'Skip Mobi', exact: true }).click();
  const forecast = page.getByRole('dialog', { name: 'Choose a color pair', exact: true });
  await expect(forecast).toBeVisible();
  for (const viewport of [{ width: 320, height: 568 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(viewport);
    const layout = await forecast.evaluate(element => {
      const rect = node => node.getBoundingClientRect().toJSON();
      return {
        header: rect(element.querySelector('.demo-toolbar')),
        card: rect(element.querySelector('.demo-forecast-panel')),
        actions: [...element.querySelectorAll('.demo-toolbar button')].map(rect),
        scrollWidth: document.documentElement.scrollWidth,
      };
    });
    expect(layout.scrollWidth).toBe(viewport.width);
    expect(layout.card.y).toBeGreaterThanOrEqual(layout.header.y + layout.header.height);
    for (const action of layout.actions) {
      expect(action.x).toBeGreaterThanOrEqual(0);
      expect(action.x + action.width).toBeLessThanOrEqual(viewport.width);
      expect(action.height).toBeGreaterThanOrEqual(44);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await forecast.getByRole('button', { name: /Red.*Orange/ }).click();
  await forecast.getByRole('button', { name: 'Confirm pick', exact: true }).click();
  await page.getByRole('button', { name: 'Next: Random →', exact: true }).click();
  await expect(page.getByRole('progressbar', { name: 'Demo progress', exact: true })).toHaveAttribute('aria-valuenow', '10');
  await expect(page.locator('.bottom-nav-bar, .top-app-bar')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Skip Mobi', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Exit Demo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Demo', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
