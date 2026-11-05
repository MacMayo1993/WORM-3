import { test, expect, openGame } from './helpers.js';

test('Shatterglass renders bounded glass geometry without shader errors', async ({ page, errors }, testInfo) => {
  // Enter the shipped 7x7 glass stage from normal saved progression. No test-only
  // store or renderer is used, so this covers the actual production material path.
  await page.addInitScript(() => {
    localStorage.setItem('worm3_player_progress_v1', JSON.stringify({
      version: 1,
      progress: { wormStory: { stars: Object.fromEntries(Array.from({ length: 27 }, (_, i) => [i + 1, 1])), claimed: {} } },
      points: 0,
      ownedItems: []
    }));
    const probe = { programs: [], draws: 0, maxVertices: 0 };
    window.__glassProbe = probe;
    for (const Context of [WebGLRenderingContext, WebGL2RenderingContext]) {
      const proto = Context.prototype;
      const targets = new WeakSet(), current = new WeakMap();
      const link = proto.linkProgram;
      proto.linkProgram = function (program) {
        const result = link.call(this, program);
        const sources = (this.getAttachedShaders(program) ?? []).map(shader => this.getShaderSource(shader) ?? '');
        if (sources.some(source => /tint\.r\s*\+=\s*fresnel/.test(source))) {
          const linked = this.getProgramParameter(program, this.LINK_STATUS);
          probe.programs.push({ linked, log: linked ? '' : this.getProgramInfoLog(program) });
          targets.add(program);
        }
        return result;
      };
      const use = proto.useProgram;
      proto.useProgram = function (program) { current.set(this, program); return use.call(this, program); };
      for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
        const draw = proto[name];
        if (!draw) continue;
        proto[name] = function (...args) {
          if (targets.has(current.get(this))) {
            probe.draws++;
            const vertices = name.startsWith('drawElements') ? args[1] : args[2];
            probe.maxVertices = Math.max(probe.maxVertices, vertices);
          }
          return draw.apply(this, args);
        };
      }
    }
  });
  await openGame(page, { unlock: true });
  await page.getByRole('button', { name: 'Continue: stage 3-8, Shatterglass', exact: true }).click();
  const mobi = page.getByRole('dialog', { name: /STORY.*Mobi/ });
  await expect(mobi).toBeVisible();
  await mobi.getByRole('button', { name: 'Skip', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Story objective', exact: true })).toContainText('Shatterglass');
  await expect(page.getByRole('button', { name: /start level/i })).toBeEnabled({ timeout: 180_000 });
  // Ignore the intro and loading transition. Inspect the actual staged board.
  await page.evaluate(() => Object.assign(window.__glassProbe, { draws: 0, maxVertices: 0 }));
  await expect.poll(() => page.evaluate(() => window.__glassProbe.draws), {
    timeout: 60_000, message: 'the real glass stage submits its tinted sticker geometry'
  }).toBeGreaterThan(0);
  const probe = await page.evaluate(() => window.__glassProbe);
  expect(probe.programs.length).toBeGreaterThan(0);
  expect(probe.programs.every(program => program.linked), JSON.stringify(probe.programs)).toBe(true);
  // Dense glass uses the 92-triangle rounded sticker (276 vertices), not the
  // 284-triangle / 852-vertex opaque-detail geometry. The back alone has only 6,
  // so equality also proves the front actually drew, rather than just its back.
  expect(probe.maxVertices).toBe(276);
  expect(errors).toEqual([]);
  await expect(page.locator('[data-testid="app-error"]')).toHaveCount(0);
  const screenshot = testInfo.outputPath('glass-view.png');
  await page.screenshot({ path: screenshot });
  await testInfo.attach('Shatterglass staged board', { path: screenshot, contentType: 'image/png' });
});
