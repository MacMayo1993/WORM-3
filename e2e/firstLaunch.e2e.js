import { test, expect, press } from './helpers.js';

// A brand-new player is handed from the intro straight to WORM Story level 1,
// with Mobi's briefing first, instead of a menu of six modes. Back at the menu,
// the other modes wait behind WORM levels (progression/modeUnlocks.js).

test.afterEach(async ({ page, errors }) => {
  expect(errors, 'uncaught errors').toEqual([]);
  expect(await page.locator('[data-testid="app-error"]').count()).toBe(0);
});

test('first launch goes from the intro to Story level 1, once', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /skip intro/i }).click();
  const mobi = page.getByRole('dialog', { name: /STORY.*Mobi/ });
  await expect(mobi).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('worm3_mode_gate'))).toBe('gated');

  // The second launch is an ordinary one: the intro ends at the menu.
  await page.reload();
  await page.getByRole('button', { name: /skip intro/i }).click();
  await expect(page.locator('button:visible', { hasText: /^\s*play\b/i }).first()).toBeVisible();
  await press(page, /^\s*play\b/i);
  await expect(page.locator('.lc-play')).toBeEnabled();   // WORM is open
  await page.getByRole('button', { name: 'Show CHAOS mode' }).click();
  await expect(page.locator('.lc-play')).toBeDisabled();
  await expect(page.locator('.lc-play')).toContainText(/Clear 5 more WORM levels/i);
});
