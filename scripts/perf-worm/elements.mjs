// Production WebGL smoke/capture for each elemental ability on an enemy-free
// board. Uses the real sim and pickup callbacks, then freezes the resulting pose.
// Build vite.perf.config.mjs first. CHROMIUM=/path/to/chrome node .../elements.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
import { chromium } from 'playwright-core';
const root = fileURLToPath(new URL('../../', import.meta.url));
const shots = process.env.SHOTS || '/tmp/worm-elements';
const server = await preview({ root, configFile: path.join(root, 'scripts/perf-worm/vite.perf.config.mjs'), preview: { host: '127.0.0.1', port: 4181 } });
let browser;
try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined,
        args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    const errors = [];
    page.on('pageerror', error => { if (!/\.hdr/.test(error.message)) errors.push(error.message); });
    page.on('console', msg => { if (msg.type() === 'error' && /THREE.WebGLProgram|shader error|VALIDATE_STATUS/.test(msg.text())) errors.push(msg.text()); });
    await page.addInitScript({ path: path.join(root, 'scripts/perf-worm/instrument.js') });
    await page.addInitScript(() => { window.__perf.noDraw = true; localStorage.setItem('worm3_mode_gate', 'gated'); });
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/WORM-3/?unlockall=1`);
    await page.getByRole('button', { name: 'Skip intro and enter game' }).click({ timeout: 60000 });
    await page.waitForFunction(() => window.__store);
    await page.evaluate(() => {
        const store = window.__store;
        store.subscribe(state => { if (state.perfReducedFX) store.setState({ perfReducedFX: false }); });
        store.setState({ showMainMenu: false, perfReducedFX: false, setPerfReducedFX: () => {} });
        store.getState().setSize(5); store.getState().initWormMode(9999, 0, 1, 10, 30, null, false, false, 1);
    });
    await page.waitForFunction(() => window.__wormSimRef?.current && window.__store.getState().wormStoryReady, null, { timeout: 60000 });
    await page.evaluate(`(${fs.readFileSync(path.join(root, 'scripts/perf-worm/inpage.js'), 'utf8')})()`);
    fs.mkdirSync(shots, { recursive: true });
    const results = [];
    for (const type of (process.env.ELEMENTS?.split(',') || ['fire', 'water', 'grass', 'ice', 'air', 'lightning'])) {
        const result = await page.evaluate(type => {
            const store = window.__store, size = store.getState().size, sim = window.__wormSimRef.current;
            store.setState({ wormPaused: true, wormAlive: true, wormStoryStarted: true, wormGamePhase: 'active', cubies: window.__perfMakeCubies(size), wormSpecials: [], wormElementalTheme: null, wormElementalPartner: null });
            window.__resetWormSim(sim, size, { orbCount: 0, wormholeInterval: 9999 });
            const ctx = { ...window.__wormCtxRef.current, isPaused: () => false };
            sim.powerups = [0, 1, 2, 3, 4].map((x, i) => ({ x, y: sim.pos.y, z: size - 1, dirKey: 'PZ', type: 'apple', spawnId: `element-${type}-${i}` }));
            store.setState({ wormPowerups: sim.powerups });
            window.__startElemental(sim, ctx, type, size); sim.elementalFocusT = 0;
            if (type === 'fire') window.__queueWormTurn(sim, 'boost');
            if (type === 'air') { window.__queueWormTurn(sim, 'jump-hold'); window.__queueWormTurn(sim, 'jump'); }
            const ticks = type === 'grass' ? 32 : type === 'air' ? 18 : 2;
            for (let i = 0; i < ticks; i++) window.__stepWormSim(sim, .05, size, ctx);
            const state = window.__perf.roots.r3f.containerInfo.getState(); state.setDpr(.35);
            if (!window.__elementCamera) {
                window.__elementCamera = { store: state.internal.subscribers[0].store, priority: .5, ref: { current: ({ camera }) => {
                    camera.position.set(4.5, 3.5, 8); camera.up.set(0, 1, 0); camera.lookAt(0, 0, 1);
                } } };
                state.internal.subscribers.push(window.__elementCamera);
                state.internal.subscribers.sort((a, b) => a.priority - b.priority);
            }
            window.__perf.noDraw = false;
            return { type, alive: sim.alive, heatReady: sim.elementalAbilities.fireReady,
                dash: sim.elementalAbilities.fireDashT, flying: sim.elementalAbilities.flying,
                buds: sim.powerups.filter(o => o.garden).length, chainCooldown: sim.elementalAbilities.lightningT };
        }, type);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
        const batches = await page.evaluate(() => {
            const scene = window.__perf.roots.r3f.containerInfo.getState().scene;
            const group = scene.getObjectByName('elemental-ability-feedback');
            return group?.children.map(mesh => mesh.isInstancedMesh ? mesh.count : mesh.geometry.drawRange.count);
        });
        if (!result.alive || !batches?.some(n => n > 0)) throw Error(`Element failed: ${JSON.stringify({ result, batches })}`);
        await page.screenshot({ path: path.join(shots, `${type}.png`), timeout: 60000 });
        await page.evaluate(() => { window.__perf.noDraw = true; });
        results.push({ ...result, batches });
    }
    if (errors.length) throw Error(errors.join('\n'));
    console.log(JSON.stringify(results, null, 2));
} finally {
    await browser?.close(); await new Promise(resolve => server.httpServer.close(resolve));
}
