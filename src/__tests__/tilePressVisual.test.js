import { beforeEach, expect, it } from 'vitest';
import { Group, Color } from 'three';
import { pressTile, tickWormPress, getWormPress, getWormContact, resetWormPress, remapWormPress } from '../worm/tilePressBridge.js';
import { updateTilePressVisual } from '../worm/tilePressVisual.js';

beforeEach(resetWormPress);
function fixture() {
    const inner = new Group(), footprint = new Group();
    const uniforms = { uPress: { value: 0 }, uColor: { value: new Color() } };
    const draw = key => updateTilePressVisual(inner, footprint, uniforms, getWormPress(key), getWormContact(key), '#aa33ff');
    return { inner, footprint, uniforms, draw };
}
function hold() {
    for (let i = 0; i < 60; i++) { pressTile('a', 1); tickWormPress(1/60); }
}
it('extinguishes on the first released frame even while the tile is still depressed', () => {
    const f = fixture(); hold(); f.draw('a');
    expect(f.footprint.visible).toBe(true);
    tickWormPress(1/60); f.draw('a');
    expect(getWormPress('a')).toBeGreaterThan(0.8);
    expect(f.footprint.visible).toBe(false);
    for (let i = 0; i < 120; i++) {
        tickWormPress(1/60); f.draw('a');
        expect(f.footprint.visible).toBe(false);
    }
    expect(f.inner.scale.x).toBe(1);
});
it('clears a reused lit slot after remapping or resetting the run', () => {
    const f = fixture(); hold(); f.draw('a');
    remapWormPress(() => 'b'); f.draw('a');
    expect(f.footprint.visible).toBe(false);
    expect(f.uniforms.uPress.value).toBe(0);
    expect(f.inner.scale.x).toBe(1);
    f.draw('b'); expect(f.footprint.visible).toBe(true);
    resetWormPress(); f.draw('b');
    expect(f.footprint.visible).toBe(false);
    expect(f.footprint.position.z).toBe(0);
});
it('keeps depressed geometry above the Worm chassis even on an extreme spring overshoot', () => {
    const f = fixture();
    const z = updateTilePressVisual(f.inner, f.footprint, f.uniforms, 2, 1, '#aa33ff');
    expect(0.51 + z).toBeGreaterThan(0.46);
    expect(0.51 + 0.005 + f.footprint.position.z).toBeGreaterThan(0.46);
    expect(f.inner.scale.x).toBeGreaterThan(0.75);
});
