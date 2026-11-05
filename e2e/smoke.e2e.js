import { test, expect, openGame, openProfile, previewCoverage, press, startFreePlay } from './helpers.js';

// The cheapest checks that would have caught real regressions: the page boots, a
// run starts, and the worm selector's thumbnails actually draw. Each also fails on
// any uncaught exception or unexpected console error (see helpers.js).

test.afterEach(async ({ page, errors }) => {
  expect(errors, 'uncaught errors').toEqual([]);
  // The root boundary's screen must never be what the player is looking at.
  expect(await page.locator('[data-testid="app-error"]').count()).toBe(0);
});

test('boots to the main menu and keeps landscape actions inside the safe area', async ({ page }) => {
  await openGame(page);
  await expect(page.locator('button:visible', { hasText: /demo/i }).first()).toBeVisible();
  await expect(page.locator('canvas').first()).toBeAttached();
  await page.waitForTimeout(2000);   // let late errors (a lazy chunk, a worker) surface before the afterEach check
  await page.setViewportSize({ width: 812, height: 375 });
  const cdp = await page.context().newCDPSession(page);
  const play = page.getByRole('button', { name: 'Play', exact: true });
  // Exercise the real CSS env() value, including an iPhone-sized landscape cutout.
  for (const right of [0, 44]) {
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { right } });
    await expect.poll(async () => {
      const box = await play.boundingBox();
      return box ? box.x + box.width : Infinity;
    }, { timeout: 5000 }).toBeLessThanOrEqual(812 - right - 16);
    expect((await play.boundingBox()).width).toBeGreaterThanOrEqual(250);
  }
});

test('starts a WORM free-play run', async ({ page }) => {
  // Keep the full wizard/launch path and its existing budget. Opening turns
  // advance on rendered frames, so software GL can spend minutes arriving.
  test.setTimeout(330_000);
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  const paused = page.getByRole('dialog', { name: 'Game paused', exact: true });
  await test.step('launch through the wizard and verify the live HUD', async () => {
    await page.setViewportSize({ width: 640, height: 480 });
    await startFreePlay(page, { viewport: { width: 640, height: 320 } });
    await Promise.all([
      expect(page.getByRole('button', { name: /^Collect \d+ orbs: 0 of \d+/ })).toBeVisible(),
      ...['Turn left', 'Turn right', 'Boost'].map(control =>
        expect(page.getByRole('button', { name: control, exact: true })).toBeVisible()),
      expect(page.getByRole('list', { name: 'Orbs picked up by color' })).toBeVisible(),
      expect(page.getByRole('timer')).toBeVisible(),
      expect(page.getByRole('timer')).toHaveAttribute('aria-label', /Rotation (in|held at) \d+\.\d seconds/),
      expect(pause).toBeEnabled()
    ]);
    // Layout inspection must not require surviving minutes of unattended play.
    // Use the real pause control; both the crawler and rotation hazards freeze.
    await pause.click();
    await expect(paused).toBeVisible();
  });

  await test.step('inspect control contrast and responsive geometry while paused', async () => {
    // Paused controls remain mounted with the same layout, but are intentionally
    // aria-hidden/inert. Accessibility was checked live; use CSS for geometry.
    const controls = await page.locator('.worm-hud-bottom .worm-control').evaluateAll(buttons => {
      const luminance = color => {
        const rgb = color.match(/[\d.]+/g).slice(0, 3).map(value => {
          const channel = Number(value) / 255;
          return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
        });
        return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
      };
      return buttons.map(button => {
        const css = getComputedStyle(button), rect = button.getBoundingClientRect();
        const ink = luminance(css.color), face = luminance(css.backgroundColor);
        return { label: button.getAttribute('aria-label'), contrast: (Math.max(ink, face) + .05) / (Math.min(ink, face) + .05),
          opacity: css.opacity, height: rect.height, left: rect.left, right: rect.right };
      });
    });
    expect(controls.length).toBeGreaterThanOrEqual(4);
    for (const control of controls) {
      expect(control.contrast, `${control.label}: readable ink`).toBeGreaterThanOrEqual(7);
      expect(control.opacity, `${control.label}: opaque face`).toBe('1');
      expect(control.height).toBeGreaterThanOrEqual(48);
      expect(control.left).toBeGreaterThanOrEqual(0);
      expect(control.right).toBeLessThanOrEqual(640);
    }
    for (const width of [320, 390, 1024]) {
      await page.setViewportSize({ width, height: 700 });
      // Read one layout frame per viewport instead of serial renderer trips.
      await expect(async () => {
        const { dock, parts, counts } = await page.locator('.worm-hud-bar').evaluate(element => ({
          dock: element.getBoundingClientRect().toJSON(),
          parts: [...element.querySelectorAll('.orb-slot, .worm-rotation-clock, button')].map(node => {
            const rect = node.getBoundingClientRect();
            return { left: rect.left, right: rect.right, overflow: node.scrollWidth > node.clientWidth + 1 };
          }),
          counts: [...element.querySelectorAll('.orb-slot-count')].map(node => node.textContent)
        }));
        expect(dock.x).toBeGreaterThanOrEqual(0);
        expect(dock.x + dock.width).toBeLessThanOrEqual(width);
        for (const part of parts) {
          expect(part.left).toBeGreaterThanOrEqual(dock.x);
          expect(part.right).toBeLessThanOrEqual(dock.x + dock.width + 1);
          expect(part.overflow).toBe(false);
        }
        expect(counts).toHaveLength(6);
        for (const count of counts) expect(count).toMatch(/^\d+$/);
      }).toPass({ timeout: 45_000 });
    }
  });

  await test.step('resume at the gameplay viewport and observe live rendering', async () => {
    await page.setViewportSize({ width: 640, height: 320 });
    await paused.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(paused).toBeHidden();
    await expect(page.locator('canvas').first()).toBeVisible();
    await page.waitForTimeout(5000);   // the sim, camera and orbs get a few live seconds to throw
    await expect(pause).toBeEnabled();
  });
});

// The selector draws a dozen thumbnails through one shared renderer. A regression
// there (a parent re-render starving the later ones, a rig that fails to build)
// leaves some blank while every unit test passes. Each tab is checked for a full set
// of drawn thumbnails, then an item is worn so the hero stage redraws too.
const CLOSET_TABS = [
  { tab: 'Body', min: 8, wear: /leaf cape/i },
  { tab: 'Hats', min: 10, wear: /toadstool/i },
  { tab: 'Tail', min: 4, wear: /pinwheel/i }
];

async function expectThumbnailsDrawn(page, { tab, min, wear }) {
  await page.getByRole('tab', { name: new RegExp(`^${tab}`, 'i') }).click();
  await expect.poll(async () => {
    const coverage = await previewCoverage(page);
    return coverage.length >= min ? coverage.filter(share => share < 0.02).length : -1;   // -1: not all thumbnails mounted yet
  }, { timeout: 90_000, message: `${tab} thumbnails drawn` }).toBe(0);
  await press(page, wear);
  await expect(page.locator('.worm-profile-option[aria-pressed="true"]', { hasText: wear })).toBeVisible();
}

test('every piece in the selector closet draws', async ({ page }) => {
  await openProfile(page);
  for (const entry of CLOSET_TABS) await expectThumbnailsDrawn(page, entry);
});

test('every body piece in the selector draws on a phone @phone', async ({ page }) => {
  await openProfile(page);
  await expectThumbnailsDrawn(page, CLOSET_TABS[0]);
});
