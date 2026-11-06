import { test, expect, openGame, openWormEntry, press } from './helpers.js';

async function openChallenges(page, { phone, checkEntry = false }) {
  await page.setViewportSize(phone ? { width: 390, height: 844 } : { width: 1024, height: 700 });
  await openWormEntry(page);
  await page.getByRole('combobox', { name: 'Worm mode section', exact: true }).selectOption('challenges');
  const launch = page.getByRole('button', { name: 'Start challenges', exact: true });
  await expect(launch).toBeVisible();
  if (checkEntry) {
    const bounds = await launch.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(phone ? 390 : 1024);
  }
  await launch.click();
  const card = page.getByRole('region', { name: 'WORM short challenges', exact: true });
  await expect(card).toBeVisible({ timeout: 180000 });
  return card;
}

async function expectCompact(card) {
  // One read observes the same rendered card atomically, rather than spending
  // several software-WebGL frames on separate count and geometry round trips.
  await expect.poll(() => card.evaluate(element => ({
    details: element.querySelectorAll('.worm-challenge-details').length,
    compact: element.getBoundingClientRect().height <= 70,
  }))).toEqual({ details: 0, compact: true });
}

for (const phone of [false, true]) {
  const suffix = phone ? ' @phone' : '';

  // Each journey launches through the real menus, within the existing budget.
  // The old all-in-one journey reached Pause only after ~200s on desktop CI;
  // its Resume call began after teardown despite the correct menu being open.
  test(`opens short challenges with compact, optional guidance${suffix}`, async ({ page, errors }) => {
    const card = await openChallenges(page, { phone, checkEntry: true });
    await expect(page.getByRole('heading', { name: 'Choose your mode', exact: true })).toBeHidden();
    await expect(page.getByRole('group', { name: 'Demo controls', exact: true })).toBeHidden();
    await expect(card).toContainText('Grow, ride, restore');
    await expect(card.getByRole('button', { name: 'Start challenge', exact: true })).toBeEnabled();
    await expect(card.getByRole('button', { name: 'Next challenge', exact: true })).toHaveCount(0);
    await card.getByRole('button', { name: 'Start challenge', exact: true }).click();
    await expectCompact(card);
    await card.getByRole('button', { name: 'Challenge options', exact: true }).click();
    await expect(card).toContainText('Clock pauses during help');
    expect(errors).toEqual([]);
  });

  test(`keeps challenge help paused across keyboard Pause and Resume${suffix}`, async ({ page, errors }) => {
    // Exercise accessible activation as well as the pointer flows below.
    const card = await openChallenges(page, { phone });
    await card.getByRole('button', { name: 'Start challenge', exact: true }).press('Enter');
    await card.getByRole('button', { name: 'Challenge options', exact: true }).press('Enter');
    await card.getByRole('button', { name: 'Pause', exact: true }).press('Enter');
    const pause = page.getByRole('dialog', { name: 'Game paused', exact: true });
    await pause.getByRole('button', { name: 'Resume', exact: true }).press('Enter');
    await expect(card).toContainText('Clock pauses during help');
    const heldProgress = await card.getByRole('status').textContent();
    await page.waitForTimeout(1200);
    await expect(card.getByRole('status')).toHaveText(heldProgress);
    await card.getByRole('button', { name: 'Resume', exact: true }).press('Enter');
    await expectCompact(card);
    expect(errors).toEqual([]);
  });

  test(`opens and resumes the challenge pause menu with the pointer${suffix}`, async ({ page, errors }) => {
    const card = await openChallenges(page, { phone });
    await card.getByRole('button', { name: 'Start challenge', exact: true }).press('Enter');
    await card.getByRole('button', { name: 'Challenge options', exact: true }).press('Enter');
    // Keep mouse Pause distinct from the keyboard hold and Skip journeys. In
    // slow software-WebGL runs this pair alone costs more than 50 seconds.
    await card.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('dialog', { name: 'Game paused', exact: true })
      .getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(card).toContainText('Clock pauses during help');
    expect(errors).toEqual([]);
  });

  test(`skips an active challenge and starts the next compact attempt${suffix}`, async ({ page, errors }) => {
    const card = await openChallenges(page, { phone });
    await card.getByRole('button', { name: 'Start challenge', exact: true }).press('Enter');
    await card.getByRole('button', { name: 'Challenge options', exact: true }).press('Enter');
    await card.getByRole('button', { name: 'Skip challenge', exact: true }).click();
    await expect(card).toContainText('Cross your own route');
    await expect(card.getByRole('button', { name: 'Start challenge', exact: true })).toBeEnabled();
    await card.getByRole('button', { name: 'Start challenge', exact: true }).click();
    await expectCompact(card);
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
