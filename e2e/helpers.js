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

/**
 * Load the game and get to the main menu. `unlock` opens the store and the campaign
 * (the repo's opt-in `?unlockall=1`): a production build otherwise locks every
 * cosmetic behind progress, so a test could look at the closet but not wear anything.
 * The relative URL keeps the app's /WORM-3/ base instead of resolving to the host root.
 */
export async function openGame(page, { unlock = false } = {}) {
  await page.goto(unlock ? './?unlockall=1' : './');
  await skipIntro(page);
}

/** Main menu → Play → Play WORM. Loads the WORM entry screen, a lazy chunk. */
export async function openWormEntry(page, options) {
  await openGame(page, options);
  await press(page, /^\s*play\b/i);
  await press(page, /play worm/i);
}

/** Main menu → WORM → Customize: the worm profile editor with its closet of pieces. */
export async function openProfile(page) {
  await openWormEntry(page, { unlock: true });
  await press(page, /customize/i);
  await expect(page.getByRole('tab', { name: /^worm/i })).toBeVisible();
}

/** Walk the Free Play wizard and Mobi's intro until the run's HUD is up. */
export async function startFreePlay(page, { viewport } = {}) {
  await openWormEntry(page);
  await press(page, /free play/i);
  const wizard = page.getByRole('dialog', { name: 'WORM setup', exact: true });
  // Confirm each transition before advancing again. The old generic Next loop
  // could start another click after Launch and wait forever for a vanished key,
  // even after the HUD appeared. Mobi's Next also finishes speech before advancing.
  for (const category of ['Character', 'Scene', 'Colors', 'Style', 'Gameplay']) {
    const panel = wizard.getByRole('region', { name: category, exact: true });
    await expect(panel).toBeVisible();
    if (category === 'Scene') {
      // A shipped panorama keeps this startup check independent of the heavy
      // procedural Black Hole shader and third-party environment downloads.
      await panel.getByRole('button', { name: /Desert/ }).click();
    }
    if (category === 'Gameplay') {
      await panel.getByRole('button', { name: 'Easy', exact: true }).click();
      await panel.getByRole('switch', { name: 'Portal enemies', exact: true }).uncheck();
    }
    await wizard.locator('.mode-wizard-primary').click();
  }
  const mobi = page.getByRole('dialog', { name: /WORM FREE PLAY.*Mobi/ });
  await expect(mobi).toBeVisible();
  await mobi.getByRole('button', { name: 'Skip', exact: true }).click();
  await expect(mobi).toBeHidden();
  if (viewport) await page.setViewportSize(viewport);
  // A visible HUD can still belong to the paused opening scramble. Only an
  // enabled Pause confirms that spawning and the countdown reached live play.
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  await expect(pause).toBeVisible();
  // Twenty render-clock turns can take over two minutes on software GL. Leave
  // enough of the existing four-minute test budget for the scramble and countdown.
  await expect(pause).toBeEnabled({ timeout: 180_000 });
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
