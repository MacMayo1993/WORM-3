import { test, expect, openGame } from './helpers.js';

test('Mega Storm draws its colored constellation tiles on the real mega deck', async ({ page, errors }, testInfo) => {
  // Continue from an ordinary saved campaign, rather than injecting a test-only
  // scene/store. This exercises the shipped level look and instanced surfaces.
  await page.addInitScript(() => {
    localStorage.setItem('worm3_player_progress_v1', JSON.stringify({
      version: 1,
      progress: { wormStory: { stars: Object.fromEntries(Array.from({ length: 105 }, (_, i) => [i + 1, 1])), claimed: {} } },
      points: 0,
      ownedItems: []
    }));

    // Observe actual WebGL programs and draws. A visible canvas alone also
    // passes when the tile fragment shader failed and only the sky rendered.
    const probe = { programs: [], draws: 0, instancedDraws: 0 };
    window.__constellationProbe = probe;
    for (const Context of [WebGLRenderingContext, WebGL2RenderingContext]) {
      const proto = Context.prototype;
      const targets = new WeakSet();
      const current = new WeakMap();
      const link = proto.linkProgram;
      proto.linkProgram = function (program) {
        const result = link.call(this, program);
        const sources = (this.getAttachedShaders(program) ?? []).map(shader => this.getShaderSource(shader) ?? '');
        if (sources.some(source => source.includes('vec2 cStar('))) {
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
            if (name.endsWith('Instanced')) probe.instancedDraws++;
          }
          return draw.apply(this, args);
        };
      }
    }
  });
  await openGame(page, { unlock: true });
  await page.getByRole('button', { name: 'Continue: stage 11-6, Mega Storm', exact: true }).click();
  const mobi = page.getByRole('dialog', { name: /STORY.*Mobi/ });
  await expect(mobi).toBeVisible();
  await mobi.getByRole('button', { name: 'Skip', exact: true }).click();
  const objective = page.getByRole('region', { name: 'Story objective', exact: true });
  await expect(objective).toContainText('Mega Storm');
  await expect(objective.getByRole('listitem', { name: 'Use all 6 elements: 0 of 6', exact: true })).toBeVisible();
  await expect(objective.getByRole('listitem', { name: 'Collect orbs: 0 of 64', exact: true })).toBeVisible();
  await expect(objective.getByRole('list', { name: 'Level tasks', exact: true })).not.toContainText(/master|tiles long/i);
  const stars = objective.locator('.worm-star-requirements');
  await stars.locator('summary').click();
  await expect(stars).toContainText('65 total orbs');
  await expect(stars).not.toContainText(/tiles long|peak length/i);
  await stars.locator('summary').click();
  await expect(page.getByRole('button', { name: /start level/i })).toBeEnabled({ timeout: 180_000 });
  await expect.poll(() => page.evaluate(() => window.__constellationProbe.instancedDraws), {
    timeout: 60_000, message: 'the mega deck draws real constellation surface batches'
  }).toBeGreaterThan(0);
  const probe = await page.evaluate(() => window.__constellationProbe);
  expect(probe.programs.length).toBeGreaterThan(0);
  expect(probe.programs.every(program => program.linked), JSON.stringify(probe.programs)).toBe(true);
  // The surface may be richly decorated, but the six inventory samples still
  // have to communicate their six face colors. Read the actual rendered PNGs,
  // not just the underlying CSS fallback, which the pattern can entirely hide.
  const samples = page.locator('.orb-reserve .orb-sample');
  await expect(samples).toHaveCount(6);
  await expect.poll(() => samples.evaluateAll(nodes => nodes.every(node => node.style.backgroundImage.includes('data:image/png'))))
    .toBe(true);
  const screenshot = testInfo.outputPath('mega-storm.png');
  await page.screenshot({ path: screenshot });
  await testInfo.attach('Mega Storm staged board', { path: screenshot, contentType: 'image/png' });
  const hues = await samples.evaluateAll(async nodes => Promise.all(nodes.map(async node => {
    const image = new Image();
    image.src = node.style.backgroundImage.slice(4, -1).replace(/^["']|["']$/g, '');
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    const average = [0, 0, 0];
    for (let i = 0; i < pixels.length; i += 4) for (let c = 0; c < 3; c++) average[c] += pixels[i + c];
    for (let c = 0; c < 3; c++) average[c] /= pixels.length / 4;
    const expected = node.style.backgroundColor.match(/[\d.]+/g).slice(0, 3).map(Number);
    const chroma = rgb => { const mean = (rgb[0] + rgb[1] + rgb[2]) / 3; return rgb.map(value => value - mean); };
    const a = chroma(average), b = chroma(expected);
    return { expected, average, agreement: a.reduce((sum, value, i) => sum + value * b[i], 0) / (Math.hypot(...a) * Math.hypot(...b)) };
  })));
  for (const hue of hues) expect(hue.agreement, JSON.stringify(hue)).toBeGreaterThan(0.85);
  expect(errors).toEqual([]);
  await expect(page.locator('[data-testid="app-error"]')).toHaveCount(0);
});
