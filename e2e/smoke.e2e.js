import { test, expect, openGame, openProfile, previewCoverage, press, startFreePlay } from './helpers.js';

// The cheapest checks that would have caught real regressions: the page boots, a
// run starts, and the worm selector's thumbnails actually draw. Each also fails on
// any uncaught exception or unexpected console error (see helpers.js).

test.afterEach(async ({ page, errors }) => {
  expect(errors, 'uncaught errors').toEqual([]);
  // The root boundary's screen must never be what the player is looking at.
  expect(await page.locator('[data-testid="app-error"]').count()).toBe(0);
});

test('boots to the main menu', async ({ page }) => {
  await openGame(page);
  await expect(page.locator('button:visible', { hasText: /demo/i }).first()).toBeVisible();
  await expect(page.locator('canvas').first()).toBeAttached();
  await page.waitForTimeout(2000);   // let late errors (a lazy chunk, a worker) surface before the afterEach check
});

test('starts a WORM free-play run', async ({ page }) => {
  await startFreePlay(page);
  await expect(page.getByRole('button', { name: /^Collect \d+ orbs: 0 of \d+/ })).toBeVisible();
  for (const control of ['Turn left', 'Turn right', 'Boost']) await expect(page.getByRole('button', { name: control, exact: true })).toBeVisible();
  await expect(page.locator('canvas').first()).toBeVisible();
  await page.waitForTimeout(5000);   // the run is live: the sim, camera and orbs get a few seconds to throw
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
});

// The selector draws a dozen thumbnails through one shared renderer. A regression
// there (a parent re-render starving the later ones, a rig that fails to build)
// leaves some blank while every unit test passes.
for (const { tab, min, tag } of [
  { tab: 'Body', min: 8, tag: '' },
  { tab: 'Hats', min: 10, tag: '' },
  { tab: 'Tail', min: 4, tag: '' },
  { tab: 'Body', min: 8, tag: ' @phone' }
]) {
  test(`every ${tab.toLowerCase()} piece in the selector draws${tag}`, async ({ page }) => {
    await openProfile(page);
    await page.getByRole('tab', { name: new RegExp(`^${tab}`, 'i') }).click();
    await expect.poll(async () => {
      const coverage = await previewCoverage(page);
      return coverage.length >= min ? coverage.filter(share => share < 0.02).length : -1;   // -1: not all thumbnails mounted yet
    }, { timeout: 60_000, message: `${tab} thumbnails drawn` }).toBe(0);
    // Each picks an item and the hero stage redraws without error.
    await press(page, new RegExp(tab === 'Hats' ? 'toadstool' : tab === 'Tail' ? 'pinwheel' : 'leaf cape', 'i'));
    await page.waitForTimeout(1500);
  });
}
