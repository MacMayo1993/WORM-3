import { expect, openGame, press, test } from './helpers.js';

for (const phone of [false, true]) {
  test('plays First Flip from the carousel and saves its result' + (phone ? ' @phone' : ''), async ({ page, errors }) => {
    await openGame(page, { unlock: true });
    await press(page, /^\s*play\b/i);
    await page.getByRole('button', { name: 'Show FLIP CUBE mode', exact: true }).click();
    await page.getByRole('button', { name: 'Play FLIP CUBE', exact: true }).click();
    await page.getByRole('button', { name: /^Levels/ }).click();
    await page.getByRole('button', { name: 'Play level 1: First Flip', exact: true }).click();
    const launch = page.getByRole('button', { name: /Let's go/ });
    await launch.click();
    // A first tap can finish Mobi's speech. A second input advances the
    // completed line and remains harmless if the card already dismissed.
    await page.keyboard.press('Enter');
    const hud = page.getByRole('complementary', { name: 'Flip puzzle' });
    await expect(hud).toContainText('Flips 0');
    if (phone) {
      await hud.getByRole('button', { name: 'Hint' }).tap();
      await hud.getByRole('button', { name: 'Open cube net' }).tap();
      await page.getByRole('button', { name: 'Front row 1 column 2', exact: true }).tap();
    } else {
      await hud.getByRole('button', { name: 'Hint' }).click();
      await expect(hud).toContainText('back bottom edge');
      await hud.getByRole('button', { name: 'Hide hint' }).click();
      await page.keyboard.press('ArrowUp');
      await page.keyboard.press('f');
    }
    await expect(page.getByLabel('3 of 3 stars')).toBeVisible();
    await expect(page.getByText('Target met!', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Level map', exact: true }).click();
    const card = page.getByRole('button', { name: 'Replay completed level 1: First Flip' });
    await expect(card).toContainText('Best 1');
    expect(errors).toEqual([]);
  });
}
