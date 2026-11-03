import { test, expect, openGame, press } from './helpers.js';

for (const phone of [false, true]) {
  test(`opens the main DEMO directly into playable highlights${phone ? ' @phone' : ''}`, async ({ page, errors }) => {
    await page.setViewportSize(phone ? { width: 390, height: 844 } : { width: 1024, height: 700 });
    await openGame(page);
    await press(page, /^\s*demo\b/i);
    const card = page.getByRole('region', { name: 'WORM practice', exact: true });
    await expect(card).toBeVisible({ timeout: 180000 });
    await expect(card).toContainText('Grow, ride, restore');
    const scenes = card.getByRole('combobox', { name: 'Choose demo scene' });
    await expect(scenes).toHaveValue('showcase:0');
    await expect(card.getByRole('button', { name: 'Try it', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: /^Jump / })).toBeVisible();
    const bounds = await card.boundingBox();
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
    expect(errors).toEqual([]);
  });
}
