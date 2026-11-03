import { test, expect } from './helpers.js';

test('shared title stays legible through intro and menu at phone widths @phone', async ({ page, errors }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('worm3_mode_gate', 'open'));
  await page.goto('./');
  await expect(page.locator('.opening-title [aria-label="WORM cubed"]')).toBeVisible();
  await expect(page.locator('.opening-title svg text')).toHaveText('3');
  await page.getByRole('button', { name: /skip intro/i }).click();
  const title = page.locator('.worm-wordmark--menu');
  await expect(title).toBeVisible();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect.poll(async () => {
      const box = await title.boundingBox();
      return box && box.x >= 0 && box.x + box.width <= width;
    }).toBeTruthy();
    await expect(title.locator('.worm-wordmark-letter').first()).toHaveCSS('animation-name', 'none');
  }
  expect(errors).toEqual([]);
});
