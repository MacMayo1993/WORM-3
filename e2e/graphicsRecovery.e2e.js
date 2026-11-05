import { test, expect, openGame } from './helpers.js';

test.use({ serviceWorkers: 'block' });

test('healthy WebGL does not activate the canvas fallback recovery', async ({ page, errors }) => {
  await openGame(page);
  await expect(page.locator('.canvas-container canvas')).toBeVisible();
  await expect(page.getByRole('alertdialog', { name: 'Graphics could not start' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('lost context offers keyboard-accessible retry, then restores the canvas', async ({ page, errors }) => {
  await openGame(page);
  await page.locator('.canvas-container canvas').evaluate(canvas => {
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  });
  const modal = page.getByRole('alertdialog', { name: 'Graphics could not start' });
  await expect(modal).toBeVisible();
  const retry = modal.getByRole('button', { name: 'Retry graphics' });
  await expect(retry).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(modal.getByRole('button', { name: 'Return to menu' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(retry).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(modal).toBeHidden();
  await expect(page.locator('.canvas-container canvas')).toBeVisible();
  await page.locator('.canvas-container canvas').evaluate(canvas => {
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  });
  await expect(modal).toBeVisible();
  await expect(retry).toBeFocused();
  await page.keyboard.press('Space');
  await expect(modal).toBeHidden();
  await expect(page.locator('.canvas-container canvas')).toBeVisible();
  expect(errors).toEqual([]);
});

test('unavailable WebGL has bounded retries and an operable DOM menu', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    window.__graphicsAttempts = 0;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      if (/webgl|experimental-webgl/.test(kind)) { window.__graphicsAttempts++; return null; }
      return original.call(this, kind, ...args);
    };
  });
  await page.goto('./');
  const modal = page.getByRole('alertdialog', { name: 'Graphics could not start' });
  await expect(modal).toBeVisible();
  const before = await page.evaluate(() => window.__graphicsAttempts);
  // No 200 ms auto-remount loop. A later browser turn still has the same count.
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => window.__graphicsAttempts)).toBe(before);
  await modal.getByRole('button', { name: 'Retry graphics' }).click();
  await expect.poll(() => page.evaluate(() => window.__graphicsAttempts)).toBeGreaterThan(before);
  await modal.getByRole('button', { name: 'Retry graphics' }).click();
  await expect(modal.getByRole('button', { name: 'Reload game' })).toBeVisible();
  await modal.getByRole('button', { name: 'Return to menu' }).click();
  await expect(modal).toBeHidden();
  await expect(page.getByRole('button', { name: /^play$/i })).toBeVisible();
  await expect(page.locator('[data-graphics-recovery="banner"]')).toBeVisible();
  await expect(page.locator('.full-screen')).not.toHaveAttribute('inert', '');
});
