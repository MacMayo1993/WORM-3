import { test, expect, openGame, press, skipIntro } from './helpers.js';

// A deploy deletes the old hashed chunks, so a tab that predates it fails its next
// lazy import. These simulate that by refusing one lazy chunk (the WORM entry
// screen, loaded by Play WORM) and check what a player would see.
//
// The failing requests show up as console errors; both tests expect them.
const WORM_ENTRY_CHUNK = '**/assets/WormEntryScreen-*.js';

const reloadsOf = page => {
  const state = { navigations: 0 };
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) state.navigations++; });
  return state;
};
// From the main menu: the click that loads the (refused) WORM entry chunk.
const playWorm = async page => {
  await press(page, /^\s*play\b/i);
  await press(page, /play worm/i);
};

// The app forgets its reload attempts after 30 s of a healthy page (see chunkRecovery.js).
// Software rendering can make a test's clicks slower than that, which would quietly
// reset the cap this test is about, so this suppresses that one timer.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const schedule = window.setTimeout;
    window.setTimeout = (callback, delay, ...args) => (delay === 30000 ? 0 : schedule(callback, delay, ...args));
  });
});

test.afterEach(async ({ errors }) => {
  // Refusing a chunk is the point; any *other* error is still a failure.
  const unexpected = errors.filter(e => !/dynamically imported module|Importing a module script failed|Unable to preload|ERR_FAILED|ERR_BLOCKED_BY_CLIENT|Uncaught \(in promise\)|TypeError: Failed to fetch/.test(e));
  expect(unexpected, 'unexpected errors').toEqual([]);
});

test('reloads once and carries on when a deploy has deleted a chunk', async ({ page }) => {
  const nav = reloadsOf(page);
  let deleted = true;
  await page.route(WORM_ENTRY_CHUNK, route => (deleted ? route.abort() : route.continue()));

  await openGame(page);
  const before = nav.navigations;
  await playWorm(page);

  // The failed import triggers one automatic reload (through a refetch of index.html).
  await expect.poll(() => nav.navigations, { timeout: 90_000 }).toBeGreaterThan(before);
  deleted = false;                                   // the "new deploy" is now what the server has
  expect(await page.evaluate(() => sessionStorage.getItem('worm3_chunk_reload'))).toBe('1');
  expect(await page.locator('[data-testid="app-error"]').count()).toBe(0);

  // The reload lands back on the opening; the player can go on to where they were headed.
  await skipIntro(page);
  await playWorm(page);
  await expect(page.locator('button:visible', { hasText: /free play/i }).first()).toBeVisible({ timeout: 90_000 });
});

test('shows a way back, not a blank page, when the chunk stays missing', async ({ page }) => {
  const nav = reloadsOf(page);
  await page.route(WORM_ENTRY_CHUNK, route => route.abort());

  await openGame(page);
  // Two automatic reloads (a stale CDN can keep serving the old index for minutes)...
  for (let attempt = 1; attempt <= 2; attempt++) {
    const before = nav.navigations;          // taken after the page is up, so only a recovery reload counts
    await playWorm(page);
    await expect.poll(() => nav.navigations, { timeout: 90_000, message: `automatic reload ${attempt}` }).toBeGreaterThan(before);
    expect(await page.evaluate(() => sessionStorage.getItem('worm3_chunk_reload'))).toBe(String(attempt));
    await skipIntro(page);                   // each reload lands back on the opening
  }
  // ...and then it stops reloading and says so.
  await playWorm(page);
  const screen = page.locator('[data-testid="app-error"]');
  await expect(screen).toBeVisible({ timeout: 90_000 });
  await expect(screen).toContainText('out of date');
  await expect(screen.getByRole('button', { name: 'Reload' })).toBeVisible();
  await expect(screen.getByRole('button', { name: /copy details/i })).toBeVisible();
  // The details name the failure, so a bug report is useful.
  await expect(screen.locator('pre')).toContainText(/dynamically imported module|Importing a module script failed|Unable to preload/);
  // Nothing is reloading any more.
  const settled = nav.navigations;
  await page.waitForTimeout(4000);
  expect(nav.navigations).toBe(settled);
});
