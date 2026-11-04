import { test, expect, openGame } from './helpers.js';

for (const phone of [false, true]) {
  test(`opens the main DEMO directly into playable highlights${phone ? ' @phone' : ''}`, async ({ page, errors }) => {
    await page.setViewportSize(phone ? { width: 390, height: 844 } : { width: 1024, height: 700 });
    await openGame(page);
    // The visible triangle is aria-hidden; target the accessible name, not raw text.
    await page.getByRole('button', { name: 'Demo', exact: true }).click({ timeout: 45000 });
    const card = page.getByRole('region', { name: 'WORM practice', exact: true });
    await expect(card).toBeVisible({ timeout: 180000 });
    const scenes = card.getByRole('combobox', { name: 'Choose demo scene' });
    // Queue independent DOM assertions together rather than paying for another
    // software-rendered frame between each read. Keep locator retry semantics.
    await Promise.all([
      expect(card).toContainText('Grow, ride, restore'),
      expect(scenes).toHaveValue('showcase:0'),
      expect(card.getByRole('button', { name: 'Try it', exact: true })).toBeEnabled(),
      expect(page.getByRole('button', { name: /^Jump / })).toBeVisible(),
      expect(card.getByRole('progressbar', { name: 'Demo progress', exact: true })).toBeVisible(),
      ...['Skip Step', 'Exit Demo', 'Pause'].map(name =>
        expect(card.getByRole('button', { name, exact: true })).toBeVisible()),
      expect(page.locator('.worm-hud-bottom .worm-demo-card')).toHaveCount(0)
    ]);
    const bounds = await card.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds.y).toBeLessThanOrEqual(12);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(phone ? 390 : 1024);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(phone ? 844 : 700);
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
    await card.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(card.getByRole('button', { name: 'Try it', exact: true })).toBeEnabled();
    await scenes.selectOption('showcase:0');
    await expect(card).toContainText('Grow, ride, restore');
    // Exit is the real cleanup action, not a cosmetic hide.
    await card.getByRole('button', { name: 'Exit Demo', exact: true }).click();
    await expect(card).toBeHidden();
    await expect(page.getByRole('button', { name: 'Demo', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

// Rotation exercises layout independently of the full combat/retry journey so
// both retain the suite's four-minute budget even on software-rendered WebGL.
test('keeps the demo dock clear of phone controls through rotations @phone', async ({ page, errors }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openGame(page);
  await page.getByRole('button', { name: 'Demo', exact: true }).click({ timeout: 45000 });
  const card = page.getByRole('region', { name: 'WORM practice', exact: true });
  await expect(card).toBeVisible({ timeout: 180000 });
  await card.getByRole('combobox', { name: 'Choose demo scene' }).selectOption('showcase:4');
  // The reference scene, small portrait, and short landscape all retain an
  // unobstructed game area between the instruction dock and thumb controls.
  for (const viewport of [{ width: 390, height: 760 }, { width: 320, height: 568 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(viewport);
    // Read all related rectangles in one browser turn, avoiding both repeated
    // slow GL frames and inconsistent measurements from different layout frames.
    await expect(async () => {
      const layout = await card.evaluate(element => {
        const rect = node => node?.getBoundingClientRect().toJSON() ?? null;
        const buttons = [...element.querySelectorAll('button')];
        const action = name => buttons.find(button => (button.getAttribute('aria-label') || button.textContent).trim() === name);
        return {
          top: rect(element),
          tray: rect(document.querySelector('.worm-hud-bottom')),
          scrollWidth: document.documentElement.scrollWidth,
          actions: ['Skip Step', 'Exit Demo', 'Pause'].map(name => rect(action(name))),
          count: rect(element.querySelector('.demo-progress-count')),
          skip: rect(action('Skip Step'))
        };
      });
      const { top, tray, actions, count, skip, scrollWidth } = layout;
      expect(tray).not.toBeNull();
      expect(top.x).toBeGreaterThanOrEqual(0);
      expect(top.x + top.width).toBeLessThanOrEqual(viewport.width);
      expect(top.y + top.height).toBeLessThan(tray.y - 85);
      expect(scrollWidth).toBe(viewport.width);
      for (const button of actions) {
        expect(button).not.toBeNull();
        expect(button.x).toBeGreaterThanOrEqual(top.x);
        expect(button.x + button.width).toBeLessThanOrEqual(top.x + top.width);
        expect(button.width).toBeGreaterThanOrEqual(44);
        expect(button.height).toBeGreaterThanOrEqual(44);
      }
      expect(count).not.toBeNull();
      expect(skip).not.toBeNull();
      expect(count.x + count.width).toBeLessThanOrEqual(skip.x);
    }).toPass({ timeout: 45_000 });
  }
  await card.getByRole('button', { name: 'Exit Demo', exact: true }).click();
  await expect(card).toBeHidden();
  await expect(page.getByRole('button', { name: 'Demo', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
