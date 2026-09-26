import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { makeCombat, stepCombat, surfacePose } from '../worm/combat/portalCombat.js';
import { makeAmbientCombat, cancelAmbientEncounter } from '../worm/combat/ambientCombat.js';
import {
  allocateEnemySlots, dissolveProgress, enemyFleck, ENEMY_DISSOLVE_SECONDS, ENEMY_DISSOLVE_HOLD,
  ENEMY_FLECK_LIFE, ENEMY_FLECKS, MAX_DISSOLVING,
} from '../worm/combat/enemyDissolve.js';
import { addIntroDissolve, addFrameDissolve } from '../components/intro/introDissolve.js';

const tile = (x = 2, y = 2, dirKey = 'PZ', z = 4) => ({ x, y, z, dirKey });
const player = (blocked = false) => ({ head: tile(), heading: 'right', position: surfacePose(tile(), tile(), 0, 5).position,
  protected: true, blocked, portalOpen: true, canFinish: false });
function arena() { const c = makeCombat(5, tile(2, 4)); c.started = true; c.spawnTimer = 999; return c; }
// A burning enemy with almost no health dies on the next unblocked step.
function doomed(c, t = tile(0, 0)) {
  const e = { id: ++c.seq, type: 'crawler', hp: 0.01, burn: 1, tile: t, next: null, t: 0, emerging: 0, stun: 0 };
  c.enemies.push(e); return e;
}
const run = (c, seconds, p = player()) => { for (let i = 0; i < Math.round(seconds / 0.05); i++) stepCombat(c, 0.05, p); };

describe('defeated enemies dissolve on the combat clock', () => {
  it('keeps the same enemy, where it fell, as a dissolving record', () => {
    const c = arena(), e = doomed(c);
    run(c, 0.05);
    expect(c.enemies).not.toContain(e);
    expect(c.kills).toBe(1);
    expect(c.dying).toEqual([e]);
    expect(c.dying[0].tile).toEqual(tile(0, 0));
    // The crumble replaces the old kill ring.
    expect(c.bursts.some(b => b.kind === 'kill')).toBe(false);
  });

  it('holds with pause and tunnel travel, then finishes and lets go', () => {
    const c = arena(), e = doomed(c);
    run(c, 0.05);
    const at = e.dissolveT;
    run(c, 2, player(true));
    expect(e.dissolveT).toBe(at);
    run(c, ENEMY_DISSOLVE_SECONDS / 2);
    expect(dissolveProgress(e.dissolveT)).toBeGreaterThan(0.3);
    expect(dissolveProgress(e.dissolveT)).toBeLessThan(0.7);
    run(c, ENEMY_DISSOLVE_HOLD);
    expect(c.dying).toHaveLength(0);
  });

  it('finishes the winning kill after the round ends, and bounds the pool', () => {
    const c = arena();
    for (let i = 0; i < MAX_DISSOLVING + 2; i++) doomed(c, tile(i % 5, 0));
    run(c, 0.05);
    expect(c.dying).toHaveLength(MAX_DISSOLVING);
    c.won = true;
    run(c, ENEMY_DISSOLVE_HOLD + 0.1);
    expect(c.dying).toHaveLength(0);
  });

  it('drops ambient crumbles when an encounter is cancelled rather than won', () => {
    const c = makeAmbientCombat(5);
    Object.assign(c, { encounter: true, dying: [{ id: 99, tile: tile(), dissolveT: 0.2 }] });
    cancelAmbientEncounter(c);
    expect(c.dying).toHaveLength(0);
  });
});

describe('dissolve timing and flecks', () => {
  it('runs the front linearly from whole to gone', () => {
    expect(dissolveProgress(0)).toBe(0);
    expect(dissolveProgress(ENEMY_DISSOLVE_SECONDS / 2)).toBeCloseTo(0.5);
    expect(dissolveProgress(ENEMY_DISSOLVE_SECONDS * 3)).toBe(1);
  });

  it('sheds flecks head to tail, only while it crumbles, and none for reduced motion', () => {
    const births = [];
    for (let i = 0; i < ENEMY_FLECKS; i++) {
      let born = null, height = null;
      for (let t = 0; t <= ENEMY_DISSOLVE_HOLD; t += 0.01) {
        const f = enemyFleck(i, t, 3);
        if (f && born == null) { born = t; height = f.position[1]; }
        if (f) expect(f.scale).toBeLessThanOrEqual(0.05);
      }
      expect(born).not.toBeNull();
      expect(born + ENEMY_FLECK_LIFE).toBeLessThanOrEqual(ENEMY_DISSOLVE_HOLD + 1e-9);
      births.push({ born, height });
      expect(enemyFleck(i, ENEMY_DISSOLVE_HOLD, 3)).toBeNull();
      expect(enemyFleck(i, ENEMY_DISSOLVE_SECONDS / 2, 3, true)).toBeNull();
    }
    const top = births.reduce((a, b) => (b.height > a.height ? b : a));
    const bottom = births.reduce((a, b) => (b.height < a.height ? b : a));
    expect(top.born).toBeLessThan(bottom.born);
  });
});

describe('stable render slots', () => {
  it('keeps a dying enemy in the rig it died in and lets a new arrival evict the oldest crumble', () => {
    const a = { id: 1 }, b = { id: 2 }, map = new Map(), slots = Array(3).fill(null);
    const c = { enemies: [a, b], dying: [] };
    allocateEnemySlots(c, map, slots);
    expect(slots).toEqual([a, b, null]);
    // `a` dies: it leaves the live list but keeps slot 0.
    a.dissolveT = 0; c.enemies = [b]; c.dying = [a];
    allocateEnemySlots(c, map, slots);
    expect(slots[0]).toBe(a); expect(slots[1]).toBe(b);
    const d = { id: 3 }, e = { id: 4 };
    c.enemies = [b, d, e];
    allocateEnemySlots(c, map, slots);
    // Full pool: the live arrival takes the crumbling enemy's rig.
    expect(slots).toContain(b); expect(slots).toContain(d); expect(slots).toContain(e);
    expect(slots).not.toContain(a);
    allocateEnemySlots(null, map, slots);
    expect(slots).toEqual([null, null, null]); expect(map.size).toBe(0);
  });
});

describe('one dissolve shader for the intro cube and the enemies', () => {
  const compile = (material, type) => {
    const shader = { uniforms: {}, vertexShader: THREE.ShaderLib[type].vertexShader, fragmentShader: THREE.ShaderLib[type].fragmentShader };
    material.onBeforeCompile(shader);
    return shader;
  };

  it('leaves the intro sampling its instanced cube with the emissive edge', () => {
    const uniform = { value: 0 };
    const shader = compile(addIntroDissolve(new THREE.MeshStandardMaterial(), uniform), 'standard');
    expect(shader.uniforms.uDissolve).toBe(uniform);
    expect(shader.vertexShader).toContain('vDissolvePos = (instanceMatrix * vec4(transformed, 1.0)).xyz;');
    expect(shader.fragmentShader).toContain('totalEmissiveRadiance += vec3(1.0, 0.5, 0.1) * 1.4 * dissolveEdge;');
    expect(shader.fragmentShader).toContain('if (dissolveGap < 0.0) discard;');
  });

  it('samples enemies in one shared frame, on lit and unlit materials alike', () => {
    const uniforms = { uDissolve: { value: 0 }, uDissolveFrame: { value: new THREE.Matrix4() } };
    const lit = compile(addFrameDissolve(new THREE.MeshStandardMaterial(), uniforms), 'standard');
    const unlit = compile(addFrameDissolve(new THREE.MeshBasicMaterial(), uniforms), 'basic');
    for (const shader of [lit, unlit]) {
      expect(shader.uniforms.uDissolve).toBe(uniforms.uDissolve);
      expect(shader.uniforms.uDissolveFrame).toBe(uniforms.uDissolveFrame);
      expect(shader.vertexShader).toContain('uniform mat4 uDissolveFrame;');
      expect(shader.vertexShader).toContain('(uDissolveFrame * modelMatrix * vec4(transformed, 1.0)).xyz');
      expect(shader.fragmentShader).toContain('if (dissolveGap < 0.0) discard;');
    }
    expect(lit.fragmentShader).toContain('totalEmissiveRadiance += vec3(1.0, 0.5, 0.1) * 1.4 * dissolveEdge;');
    expect(unlit.fragmentShader).toContain('gl_FragColor.rgb += vec3(1.0, 0.5, 0.1) * 1.4 * dissolveEdge;');
  });
});
