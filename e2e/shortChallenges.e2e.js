import { test, expect, openGame, openWormEntry, press } from './helpers.js';

for (const phone of [false, true]) {
  test(`opens the short challenge course from WORM${phone ? ' @phone' : ''}`, async ({ page, errors }) => {
    await page.setViewportSize(phone ? { width: 390, height: 844 } : { width: 1024, height: 700 });
    await openWormEntry(page);
    await page.getByRole('combobox', { name: 'Worm mode section', exact: true }).selectOption('challenges');
    const launch = page.getByRole('button', { name: 'Start challenges', exact: true });
    await expect(launch).toBeVisible();
    const bounds = await launch.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(phone ? 390 : 1024);
    await launch.click();
    await expect(page.getByRole('heading', { name: 'Choose your mode', exact: true })).toBeHidden();
    await expect(page.getByRole('group', { name: 'Demo controls', exact: true })).toBeHidden();
    const card = page.getByRole('region', { name: 'WORM short challenges', exact: true });
    await expect(card).toBeVisible({ timeout: 180000 });
    await expect(card).toContainText('Grow, ride, restore');
    await expect(card.getByRole('button', { name: 'Start challenge', exact: true })).toBeEnabled();
    await expect(card.getByRole('button', { name: 'Next challenge', exact: true })).toHaveCount(0);
    await card.getByRole('button', { name: 'Start challenge', exact: true }).click();
    await expect(card.locator('.worm-challenge-details')).toHaveCount(0);
    expect((await card.boundingBox()).height).toBeLessThanOrEqual(70);
    await card.getByRole('button', { name: 'Challenge options', exact: true }).click();
    await expect(card).toContainText('Clock pauses during help');
    // Use the suite's software-WebGL action budget: CI can take over 15 seconds
    // to acknowledge this click even after the second challenge has rendered.
    await card.getByRole('button', { name: 'Skip challenge', exact: true }).click();
    await expect(card).toContainText('Cross your own route');
    await expect(card.getByRole('button', { name: 'Start challenge', exact: true })).toBeEnabled();
    await card.getByRole('button', { name: 'Start challenge', exact: true }).click();
    await expect(card.locator('.worm-challenge-details')).toHaveCount(0);
    expect((await card.boundingBox()).height).toBeLessThanOrEqual(70);
    await page.screenshot({ path: `/tmp/worm-challenges-${phone ? 'phone' : 'desktop'}.png` });
    expect(errors).toEqual([]);
  });
}

test('opens a cube challenge directly with folded, optional guidance', async ({ page, errors }) => {
  await openGame(page, { unlock: true });
  await press(page, /^\s*play\b/i);
  await page.getByRole('button', { name: 'Show TEACH mode', exact: true }).click();
  await page.getByRole('button', { name: 'Learn to solve', exact: true }).click();
  await page.getByRole('button', { name: 'Cube puzzle campaigns', exact: true }).click();
  await page.getByRole('button', { name: 'Play Short Challenges: 0 of 6 complete', exact: true }).click();
  await page.getByRole('button', { name: 'Play level 512: Hidden partners', exact: true }).click();
  const objective = page.getByRole('complementary', { name: 'Challenge objective', exact: true });
  await expect(objective.locator('.story-objective-content')).toHaveCount(0);
  expect((await objective.boundingBox()).height).toBeLessThanOrEqual(55);
  await objective.getByRole('button', { name: /Challenge 2\/6/ }).click();
  await expect(objective).toContainText('Restore all six faces. Aim for 5 moves.');
  await expect(objective).toContainText('Linked pair');
  await objective.getByText('Read the cube', { exact: true }).click();
  await expect(objective).toContainText('These two tile identities stay linked when layers turn.');
  await page.screenshot({ path: '/tmp/cube-short-challenges.png' });
  expect(errors).toEqual([]);
});
