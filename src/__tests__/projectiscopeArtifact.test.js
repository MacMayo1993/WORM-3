// Execute the shipped artifact, including its real recipe and drawing engine.
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import { it, expect, vi } from 'vitest';

it('renders and restores a drawn recipe without a background animation loop', async () => {
  const html = readFileSync('public/projectiscope/index.html', 'utf8');
  const errors = [], raf = vi.fn(), draws = vi.fn(), arcs = vi.fn(), gradients = vi.fn(() => ({ addColorStop() {} }));
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(html, { url: 'http://localhost/projectiscope/index.html#background=1',
    runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole,
    beforeParse(w) {
      w.matchMedia = () => ({ matches: false });
      w.ResizeObserver = class { observe() {} disconnect() {} };
      w.requestAnimationFrame = raf;
      Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get: () => 1024 });
      w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/jpeg;base64,YQ==';
      w.HTMLCanvasElement.prototype.getContext = function () {
        const context = { canvas: this, arc: arcs, createLinearGradient: () => ({ addColorStop() {} }),
          createRadialGradient: gradients, measureText: () => ({ width: 10 }) };
        return new Proxy(context, { get: (o, p) => p in o ? o[p] : draws });
      };
    } });
  await Promise.resolve();
  try {
    expect(errors).toEqual([]);
    const api = dom.window.__projectiscope;
    expect(api).toBeDefined(); expect(raf).not.toHaveBeenCalled();
    const recipe = JSON.parse(atob(api.recipe()));
    recipe.grp = 'I'; recipe.seed = 654; recipe.colors.ground = '#112233';
    recipe.drawn = [{ ci: 2, w: 3, p: [0, 0, 1, 0.2, 0.2, 0.96, 0.5, 0.5, 0.7] }];
    api.applyRecipe(btoa(JSON.stringify(recipe))); api.setPaused(true);
    api.stepBackground(1000);
    const design = api.backgroundDesign(), restored = JSON.parse(atob(design.recipe));
    expect(restored).toMatchObject({ grp: 'I', seed: 654, colors: { ground: '#112233' }, drawn: recipe.drawn });
    expect(design.thumbnail).toMatch(/^data:image\/jpeg/);
    expect(dom.window.document.getElementById('paint').width).toBeLessThanOrEqual(1024);
    expect(draws).toHaveBeenCalled(); expect(raf).not.toHaveBeenCalled();
    const t = restored.t;
    api.stepBackground(2000); expect(JSON.parse(atob(api.recipe())).t).toBe(t);
    api.setPaused(false); api.stepBackground(3000);
    expect(JSON.parse(atob(api.recipe())).t).toBeGreaterThan(t);
    // A saved circle/sphere look must not stamp a rim, black mask or radial
    // vignette onto the spherical sky's equator.
    Object.assign(recipe, { sphere: true, frame: 'circle', rim: true, vignette: 1,
      showMotif: false, mirrors: 'none', drawn: [] });
    arcs.mockClear(); gradients.mockClear();
    api.applyRecipe(btoa(JSON.stringify(recipe))); api.backgroundDesign();
    expect(arcs).not.toHaveBeenCalled(); expect(gradients).not.toHaveBeenCalled();
    expect(errors).toEqual([]);
  } finally { dom.window.close(); }
});

it('groups the original controls into setup categories without resetting their values or listeners', async () => {
  const { installCreatorTheme } = await import('../projectiscope/creatorTheme.js');
  const dom = new JSDOM(readFileSync('public/projectiscope/index.html', 'utf8'));
  const doc = dom.window.document, palette = doc.getElementById('pal'), changed = vi.fn();
  palette.value = 'neon'; palette.addEventListener('change', changed);
  try {
    installCreatorTheme(doc, '#00a749');
    const tabs = [...doc.querySelectorAll('.creator-categories button')];
    expect(tabs.map(b => b.textContent)).toEqual(['Pattern', 'Draw', 'Colors', 'Motion', 'Looks']);
    tabs[2].click();
    expect(doc.querySelector('#creator-panel-colors').hidden).toBe(false);
    expect(doc.querySelector('#creator-panel-pattern').hidden).toBe(true);
    expect(doc.getElementById('pal')).toBe(palette); expect(palette.value).toBe('neon');
    palette.dispatchEvent(new dom.window.Event('change')); expect(changed).toHaveBeenCalledOnce();
    tabs[2].dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(doc.activeElement).toBe(tabs[3]); expect(tabs[3].getAttribute('aria-current')).toBe('true');
    expect(doc.querySelector('#creator-panel-motion').hidden).toBe(false);
    installCreatorTheme(doc, '#00a749');
    expect(doc.querySelectorAll('.creator-categories')).toHaveLength(1);
  } finally { dom.window.close(); }
});
