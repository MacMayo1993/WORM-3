import { test as base, expect } from '@playwright/test';

export { expect };

// Console errors the game is known to log in a hermetic run. The environment map
// is fetched from a third-party host (drei's Environment preset); these tests block
// every non-local host so they never depend on the internet, and the game is
// built to carry on without reflections when it cannot load (SafeEnvironment).
// Anything else — including a first-party 404 — fails the test.
const KNOWN_CONSOLE_ERRORS = [
  /potsdamer_platz/,
  /Failed to load resource: net::ERR_(FAILED|BLOCKED_BY_CLIENT|TUNNEL_CONNECTION_FAILED|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED)/
];

export const test = base.extend({
  /** Uncaught exceptions and unexpected console errors seen by the page. Every test asserts on it. */
  errors: [async ({ page, context }, use) => {
    const errors = [];
    await context.route(url => !['127.0.0.1', 'localhost'].includes(url.hostname), route => route.abort('blockedbyclient'));
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
    page.on('console', message => {
      if (message.type() === 'error' && !KNOWN_CONSOLE_ERRORS.some(pattern => pattern.test(message.text()))) {
        errors.push(`console.error: ${message.text()}`);
      }
    });
    await use(errors);
  }, { auto: true }]
});

/** Click the first visible button whose text matches (button labels are styled uppercase, so match the DOM text, case-insensitively). */
export const press = (page, pattern) => page.locator('button:visible', { hasText: pattern }).first().click();

/** From the opening animation to the main menu. */
export async function skipIntro(page) {
  await page.getByRole('button', { name: /skip intro/i }).click();
  await expect(page.locator('button:visible', { hasText: /^\s*play\b/i }).first()).toBeVisible();
}

export async function openGame(page) {
  await page.goto('/');
  await skipIntro(page);
}

/** Main menu → Play → Play WORM. Loads the WORM entry screen, a lazy chunk. */
export async function openWormEntry(page) {
  await openGame(page);
  await press(page, /^\s*play\b/i);
  await press(page, /play worm/i);
}

/** Main menu → WORM → Customize: the worm profile editor with its closet of pieces. */
export async function openProfile(page) {
  await openWormEntry(page);
  await press(page, /customize/i);
  await expect(page.getByRole('tab', { name: /^worm/i })).toBeVisible();
}

/** Walk the Free Play wizard and Mobi's intro until the run's HUD is up. */
export async function startFreePlay(page) {
  await openWormEntry(page);
  await press(page, /free play/i);
  await press(page, /^\s*continue/i);
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  // Setup pages, then Mobi's intro; each ends in a primary key labelled Next, Play or Launch.
  for (let step = 0; step < 12 && !(await pause.isVisible()); step++) {
    await page.locator('button:visible', { hasText: /^\s*(next|play|launch)/i }).last().click();
    await page.waitForTimeout(1500);
  }
  await expect(pause).toBeVisible();
}

/**
 * The share of each preview canvas in `scope` that has been drawn on (non-transparent pixels).
 * A thumbnail that never rendered, or rendered blank, reads 0.
 */
export const previewCoverage = (page, scope = '.worm-profile-option-art canvas') =>
  page.locator(scope).evaluateAll(canvases => canvases.map(canvas => {
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    let drawn = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 24) drawn++;
    return drawn / (canvas.width * canvas.height);
  }));
