import { test, expect, openGame } from './helpers.js';

for (const phone of [false, true]) {
  test(`opens the main DEMO directly into playable highlights${phone ? ' @phone' : ''}`, async ({ page, errors }) => {
    await page.setViewportSize(phone ? { width: 390, height: 844 } : { width: 1024, height: 700 });
    await openGame(page);
    // The visible triangle is aria-hidden; target the accessible name, not raw text.
    await page.getByRole('button', { name: 'Demo', exact: true }).click({ timeout: 45000 });
    const card = page.getByRole('region', { name: 'WORM practice', exact: true });
    await expect(card).toBeVisible({ timeout: 180000 });
    await expect(card).toContainText('Grow, ride, restore');
    const scenes = card.getByRole('combobox', { name: 'Choose demo scene' });
    await expect(scenes).toHaveValue('showcase:0');
    await expect(card.getByRole('button', { name: 'Try it', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: /^Jump / })).toBeVisible();
    const bounds = await card.boundingBox();
    expect(bounds.y).toBeLessThanOrEqual(12);
    await expect(card.getByRole('progressbar', { name: 'Demo progress', exact: true })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Skip Step', exact: true })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Exit Demo', exact: true })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await expect(page.locator('.worm-hud-bottom .worm-demo-card')).toHaveCount(0);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(phone ? 390 : 1024);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(phone ? 844 : 700);
    await page.screenshot({ path: `/tmp/worm-demo-opening-${phone ? 'phone' : 'desktop'}.png` });
    // Start the real simulation, then switch scenes mid-run and retry. Neither
    // selection nor restart is allowed to invent a completed objective.
    await card.getByRole('button', { name: 'Try it', exact: true }).click();
    await expect(card).toContainText('LIVE GAMEPLAY');
    await scenes.selectOption('showcase:8');
    await expect(card).toContainText('Return fire');
    await expect(card.getByRole('button', { name: 'Try it', exact: true })).toBeEnabled();
    await expect(card.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
    await card.getByRole('button', { name: 'Try it', exact: true }).click();
    await expect(page.getByRole('button', { name: /Fire.*F|Fire/i }).first()).toBeVisible();
    await page.screenshot({ path: `/tmp/worm-demo-combat-${phone ? 'phone' : 'desktop'}.png` });
    await card.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(card.getByRole('button', { name: 'Try it', exact: true })).toBeEnabled();
    await scenes.selectOption('showcase:0');
    await expect(card).toContainText('Grow, ride, restore');
    if (phone) {
      // The reference scene, small portrait, and short landscape all retain an
      // unobstructed game area between the instruction dock and thumb controls.
      await scenes.selectOption('showcase:4');
      for (const viewport of [{ width: 390, height: 760 }, { width: 320, height: 568 }, { width: 667, height: 375 }]) {
        await page.setViewportSize(viewport);
        const top = await card.boundingBox();
        const tray = await page.locator('.worm-hud-bottom').boundingBox();
        expect(top.x).toBeGreaterThanOrEqual(0);
        expect(top.x + top.width).toBeLessThanOrEqual(viewport.width);
        expect(top.y + top.height).toBeLessThan(tray.y - 85);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
        for (const name of ['Skip Step', 'Exit Demo', 'Pause']) {
          const button = await card.getByRole('button', { name, exact: true }).boundingBox();
          expect(button.x).toBeGreaterThanOrEqual(top.x);
          expect(button.x + button.width).toBeLessThanOrEqual(top.x + top.width);
          expect(button.width).toBeGreaterThanOrEqual(44);
          expect(button.height).toBeGreaterThanOrEqual(44);
        }
        const count = await card.locator('.demo-progress-count').boundingBox();
        const skip = await card.getByRole('button', { name: 'Skip Step', exact: true }).boundingBox();
        expect(count.x + count.width).toBeLessThanOrEqual(skip.x);
        await page.screenshot({ path: `/tmp/worm-demo-clear-${viewport.width}x${viewport.height}.png` });
      }
    }
    // Exit is the real cleanup action, not a cosmetic hide.
    await card.getByRole('button', { name: 'Exit Demo', exact: true }).click();
    await expect(card).toBeHidden();
    await expect(page.getByRole('button', { name: 'Demo', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}
