import { test, expect, openProfile, press, skipIntro } from './helpers.js';

test('all seven character profiles show readable rules and persist selection @phone', async ({ page, errors }) => {
  await openProfile(page);
  const characters = ['Classic', 'Inch Worm', 'Glow Worm', 'Wiggle Worm', 'Book Worm', 'Prism Worm', 'MOBI'];
  for (const name of characters) {
    const option = page.getByRole('button', { name, exact: true });
    await option.click();
    await expect(option).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.worm-profile-identity > strong')).toHaveText(name);
    const facts = page.locator('.worm-profile-facts');
    await expect(facts).toContainText(name === 'Prism Worm' ? 'Always active' : 'Ability button');
    await expect(page.locator('.worm-profile-ability')).not.toBeEmpty();
  }
  for (const width of [320, 390, 1024]) {
    await page.setViewportSize({ width, height: 800 });
    const geometry = await page.locator('.worm-profile-facts, .worm-profile-ability, .worm-profile-option').evaluateAll(nodes =>
      nodes.map(node => {
        const rect = node.getBoundingClientRect();
        return { left: rect.left, right: rect.right, overflow: node.scrollWidth > node.clientWidth + 1 };
      }));
    for (const rect of geometry) {
      expect(rect.left).toBeGreaterThanOrEqual(0);
      expect(rect.right).toBeLessThanOrEqual(width);
      expect(rect.overflow).toBe(false);
    }
  }
  await page.locator('.worm-profile-footer button').click();
  await expect(page.getByRole('button', { name: /Customize/ })).toBeFocused();
  await page.getByRole('button', { name: /Customize/ }).click();
  await expect(page.getByRole('button', { name: 'MOBI', exact: true })).toHaveAttribute('aria-pressed', 'true');
  // A remount alone could hide a broken localStorage write. Reload the app and
  // return through its real menu path before checking the saved character.
  await page.reload();
  await skipIntro(page);
  await press(page, /^\s*play\b/i);
  await press(page, /play worm/i);
  await page.getByRole('combobox', { name: 'Worm mode section', exact: true }).selectOption('customize');
  await expect(page.getByRole('button', { name: 'MOBI', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.worm-profile-identity > strong')).toHaveText('MOBI');
  expect(errors).toEqual([]);
});
