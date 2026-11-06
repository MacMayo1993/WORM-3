import { test, expect, openGame, press } from './helpers.js';
import { TILE_STYLE_SECTIONS } from '../src/utils/tileStyleCatalog.js';

// Bound each shader-backed family journey without dropping future additions.
const FAMILY_GROUP_SIZE = 4;
const FAMILY_GROUPS = Array.from({ length: Math.ceil(TILE_STYLE_SECTIONS.length / FAMILY_GROUP_SIZE) }, (_, group) => ({
  start: group * FAMILY_GROUP_SIZE,
  sections: TILE_STYLE_SECTIONS.slice(group * FAMILY_GROUP_SIZE, (group + 1) * FAMILY_GROUP_SIZE),
}));

async function openStore(page) {
  // Keep the real zero-balance catalogue, but make Store available as it is for
  // an established player. ?unlockall would hide the insufficient-funds state.
  await page.addInitScript(() => {
    localStorage.setItem('worm3_mode_gate', 'open');
    localStorage.setItem('worm3_parity_points', '0');
  });
  await openGame(page);
  await enterStoreFromMenu(page);
}

async function enterStoreFromMenu(page) {
  await press(page, /^\s*play\b/i);
  await page.getByRole('button', { name: 'Show STORE mode', exact: true }).click();
  await page.getByRole('button', { name: 'Open store', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Store', exact: true })).toBeVisible();
}

async function assertTouchTargets(page) {
  const controls = await page.locator('.store-catalogue button:visible').evaluateAll(buttons =>
    buttons.map(button => ({
      label: button.getAttribute('aria-label') || button.textContent.trim(),
      ...button.getBoundingClientRect().toJSON(),
    })));
  for (const button of controls) {
    expect(button.width, `${button.label} width`).toBeGreaterThanOrEqual(44);
    expect(button.height, `${button.label} height`).toBeGreaterThanOrEqual(44);
  }
}

// DOM visibility alone accepts content below the scrollport. Measure the
// actual intersection so a preview-only landscape screen cannot pass again.
async function assertPreviewAndShelfShareViewport(page) {
  const visible = await page.locator('.catalogue-selector').evaluate(selector => {
    const frame = selector.getBoundingClientRect();
    const measure = target => {
      const rect = selector.querySelector(target).getBoundingClientRect();
      return {
        width: rect.width, height: rect.height,
        visibleWidth: Math.max(0, Math.min(rect.right, frame.right, window.innerWidth)
          - Math.max(rect.left, frame.left, 0)),
        visibleHeight: Math.max(0, Math.min(rect.bottom, frame.bottom, window.innerHeight)
          - Math.max(rect.top, frame.top, 0)),
      };
    };
    return { preview: measure('.catalogue-preview'), item: measure('.store-card') };
  });
  expect(visible.preview.visibleWidth, 'preview fits horizontally').toBeGreaterThanOrEqual(visible.preview.width - 1);
  expect(visible.preview.visibleHeight, 'whole preview remains above the fold').toBeGreaterThanOrEqual(visible.preview.height - 1);
  expect(visible.item.visibleWidth, 'item shelf is on screen').toBeGreaterThanOrEqual(44);
  expect(visible.item.visibleHeight, 'a useful portion of the first card is on screen').toBeGreaterThanOrEqual(Math.min(96, visible.item.height));
}

async function assertShelfScroll(page) {
  const shelf = page.locator('.catalogue-selector');
  const header = await page.locator('.catalogue-header').boundingBox();
  const rail = await page.locator('.catalogue-sidebar').boundingBox();
  const last = page.locator('.catalogue-grid .store-card').last();
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport({ ratio: 1 });
  const scroll = await shelf.evaluate(element => ({
    top: element.scrollTop, overflows: element.scrollHeight > element.clientHeight,
  }));
  if (scroll.overflows) expect(scroll.top).toBeGreaterThan(0);
  expect(await page.locator('.catalogue-header').boundingBox()).toEqual(header);
  expect(await page.locator('.catalogue-sidebar').boundingBox()).toEqual(rail);
  await shelf.evaluate(element => { element.scrollTop = 0; });
}

test.afterEach(async ({ page, errors }) => {
  expect(errors, 'uncaught errors').toEqual([]);
  await expect(page.locator('[data-testid="app-error"]')).toHaveCount(0);
});

// Three screenshots per journey leave room for slow software-rendered frames.
for (const { name, viewports } of [
  { name: 'portrait', viewports: [[320, 568], [360, 640], [412, 800]] },
  { name: 'landscape and desktop', viewports: [[640, 320], [844, 390], [1024, 768]] },
]) {
  test(`Store compact preview and tabs stay usable in ${name} @phone`, async ({ page }, testInfo) => {
    await openStore(page);
    for (const [width, height] of viewports) {
      await test.step(`${width} × ${height}`, async () => {
        await page.setViewportSize({ width, height });
        await expect.poll(() => page.locator('.store-catalogue').evaluate(element =>
          Math.abs(element.getBoundingClientRect().height - window.innerHeight))).toBeLessThan(1);
        const geometry = await page.locator('.store-catalogue').evaluate(element => {
          const box = selector => element.querySelector(selector).getBoundingClientRect().toJSON();
          return {
            header: box('.catalogue-header'), rail: box('.catalogue-sidebar'),
            shelf: box('.catalogue-selector'), preview: box('.catalogue-preview'),
            footer: box('.catalogue-footer'),
            tabs: [...element.querySelectorAll('.catalogue-category')].map(tab => tab.getBoundingClientRect().toJSON()),
            overflows: [...element.querySelectorAll('.catalogue-header, .catalogue-selector, .catalogue-preview')]
              .map(node => node.scrollWidth > node.clientWidth + 1),
          };
        });
        expect(geometry.overflows).toEqual([false, false, false]);
        expect(geometry.header.top).toBeGreaterThanOrEqual(0);
        expect(geometry.footer.bottom).toBeLessThanOrEqual(height);
        expect(geometry.shelf.height).toBeGreaterThan(140);
        const shortLandscape = width >= 560 && width <= 1000 && height <= 500;
        if (width <= 650 && !shortLandscape) {
          expect(geometry.rail.bottom).toBeLessThanOrEqual(geometry.shelf.top);
          for (const tab of geometry.tabs) {
            expect(tab.top).toBeGreaterThanOrEqual(geometry.rail.top);
            expect(tab.bottom).toBeLessThanOrEqual(geometry.rail.bottom);
          }
        } else {
          expect(geometry.rail.right).toBeLessThanOrEqual(geometry.shelf.left);
        }
        if (width <= 650 || (width <= 1000 && height <= 500)) {
          expect(geometry.preview.height).toBeLessThan(180);
        }
        await assertTouchTargets(page);
        await assertPreviewAndShelfShareViewport(page);
        await assertShelfScroll(page);
        await page.screenshot({ path: testInfo.outputPath(`store-${width}x${height}.png`) });
      });
    }
  });
}

async function openStoreInSafeArea(page, { width, height, insets }) {
  await openStore(page);
  const cdp = await page.context().newCDPSession(page);
  await page.setViewportSize({ width, height });
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets });
  const bounds = await page.locator('.store-catalogue').evaluate(element => {
    const selectors = ['.catalogue-header', '.catalogue-layout', '.catalogue-footer'];
    return selectors.map(selector => element.querySelector(selector).getBoundingClientRect().toJSON());
  });
  for (const box of bounds) {
    expect(box.top).toBeGreaterThanOrEqual(insets.top || 0);
    expect(box.left).toBeGreaterThanOrEqual(insets.left || 0);
    expect(box.right).toBeLessThanOrEqual(width - (insets.right || 0));
    expect(box.bottom).toBeLessThanOrEqual(height - (insets.bottom || 0));
  }
}

// Give categories, shader-backed tile families and menu re-entry independent
// budgets. Combining them exhausted the four-minute software-GL timeout only
// at re-entry, after the catalogue assertions had already passed.
for (const viewport of [
  { width: 320, height: 568, insets: { top: 24, bottom: 20 } },
  { width: 844, height: 390, insets: { left: 44, right: 44, bottom: 21 } },
]) {
  const { width, height } = viewport;

  const categories = ['Skins', 'Accessories', 'Hats', 'Palettes', 'Tiles'];
  const categoryGroups = width > height ? [categories.slice(0, 3), categories.slice(3)] : [categories];
  for (const [group, groupCategories] of categoryGroups.entries()) {
    test(`Store categories and item navigation${categoryGroups.length > 1 ? ` group ${group + 1}` : ''} in safe areas at ${width} × ${height} @phone`, async ({ page }) => {
      await openStoreInSafeArea(page, viewport);
      for (const category of groupCategories) {
        await test.step(category, async () => {
          await page.locator('.catalogue-category', { hasText: category }).click();
          await expect(page.getByRole('heading', { name: category, exact: true })).toBeVisible();
          const title = page.locator('.catalogue-preview h3');
          const initial = await title.textContent();
          await page.getByRole('button', { name: 'Next item', exact: true }).click();
          await expect(title).not.toHaveText(initial);
          await page.getByRole('button', { name: 'Previous item', exact: true }).click();
          await expect(title).toHaveText(initial);
          await assertTouchTargets(page);
          if (width > height) await assertPreviewAndShelfShareViewport(page);
          await assertShelfScroll(page);
        });
      }
    });
  }

  for (const { start, sections } of FAMILY_GROUPS) {
    test(`Store tile families ${start + 1}-${start + sections.length} in safe areas at ${width} × ${height} @phone`, async ({ page }) => {
      await openStoreInSafeArea(page, viewport);
      await page.locator('.catalogue-category', { hasText: 'Tiles' }).click();
      await expect(page.getByRole('heading', { name: 'Tiles', exact: true })).toBeVisible();
      const families = page.locator('.catalogue-families button');
      await expect(families).toHaveCount(TILE_STYLE_SECTIONS.length);
      for (const [offset, section] of sections.entries()) {
        await test.step(section.label, async () => {
          const family = families.nth(start + offset);
          await family.click();
          await expect(family).toHaveAttribute('aria-pressed', 'true');
          await expect(family).toBeInViewport({ ratio: 1 });
          if (width > height) await assertPreviewAndShelfShareViewport(page);
          await assertShelfScroll(page);
        });
      }
    });
  }

  test(`Store tile ownership filter in safe areas at ${width} × ${height} @phone`, async ({ page }, testInfo) => {
    await openStoreInSafeArea(page, viewport);
    await page.locator('.catalogue-category', { hasText: 'Tiles' }).click();
    await expect(page.getByRole('heading', { name: 'Tiles', exact: true })).toBeVisible();
    const families = page.locator('.catalogue-families button');
    // Crafted has no free/default-owned items, so both the shortfall and
    // empty Owned only state are deterministic for this fresh save.
    await families.filter({ hasText: /^Crafted/ }).click();
    await page.getByRole('button', { name: 'Next item', exact: true }).click();
    await expect(page.locator('.catalogue-preview-info > small')).toContainText('more PP needed');
    await expect(page.locator('.catalogue-action')).toBeDisabled();
    if (width > height) await assertPreviewAndShelfShareViewport(page);
    await page.screenshot({ path: testInfo.outputPath(`store-safe-${width}x${height}.png`) });
    await page.getByRole('button', { name: 'Owned only', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Browse all items', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Browse all items', exact: true }).click();
  });

  test(`Store closes, reopens and dismisses with Escape at ${width} × ${height} @phone`, async ({ page }) => {
    await openStoreInSafeArea(page, viewport);
    await page.getByRole('button', { name: 'Close store', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Store', exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    await enterStoreFromMenu(page);
    await page.getByRole('button', { name: 'Close store', exact: true }).focus();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Store', exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  });
}
