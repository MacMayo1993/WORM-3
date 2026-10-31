import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Vector3, Matrix4, Color, Quaternion } from 'three';
import { createMenuCharacterRig, MENU_CHARACTER_SKINS } from '../components/menus/menuCharacterRig.js';
import { MENU_TRAIL_LIFE, MENU_WORM_INK } from '../components/menus/menuWormFinish.js';
import { menuWormGround } from '../components/menus/menuWormTransit.js';
import { carouselWormMotion, CAROUSEL_WORM_SEGMENTS } from '../components/menus/cubeWormPath.js';
import { getSkin } from '../worm/wormCosmeticsData.js';
import { WORM_CHARACTERS } from '../worm/wormCharacterData.js';

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const m = new Matrix4(), p = new Vector3(), s = new Vector3(), q = new Quaternion();
const scaleAt = (mesh, i) => { mesh.getMatrixAt(i, m); m.decompose(p, q, s); return s.x; };
const positionAt = (mesh, i) => { mesh.getMatrixAt(i, m); return new Vector3().setFromMatrixPosition(m); };
const motion = (ground = 1) => ({ width: 1, stretch: 1, lift: 0, sway: 0, roll: 0, pulse: 0, transit: false, ground });

// A worm lying along +Y on the face z = 1.62 (route clearance above z = 1.5),
// heading +Y, so world down falls along the body toward its tail.
function poseStraight(rig, headY = 0, opts = {}) {
  const n = new Vector3(0, 0, 1), f = new Vector3(0, 1, 0);
  for (let i = 0; i < rig.segments.length; i++) {
    rig.pose(i, new Vector3(opts.x ?? 0, headY - i * 0.115, 1.5 + 0.155 * 0.86), n, f, opts.visible?.(i) ?? true, opts.time ?? 1, motion(opts.ground ?? 1), false);
  }
  rig.endFrame(opts.time ?? 1, false);
}

describe('menu worm look', () => {
  it('wears each species its own vivid skin, with the skin\'s real material profile', () => {
    const bodies = ['classic', 'inch', 'glow', 'wiggle'].map(id => getSkin(MENU_CHARACTER_SKINS[id]).body);
    expect(new Set(bodies).size).toBe(bodies.length);
    const rig = createMenuCharacterRig('classic');
    const material = rig.segments[0].material;
    // The slime profile is a glossy clearcoat, not the bare matte default.
    expect(material.clearcoat).toBe(1);
    expect(material.roughness).toBeLessThan(0.5);
    expect(material.toneMapped).toBe(true);
    rig.dispose();
  });

  it('never asks a menu for a transmission pass, and tones the Scout\'s glow down', () => {
    const glow = createMenuCharacterRig('glow', { skinId: 'ice' });
    for (const segment of glow.segments) if (segment.material) expect(segment.material.transmission).toBe(0);
    expect(glow.segments[1].material.userData.pulse.base).toBeLessThan(1.2);
    glow.dispose();
  });

  it.each(WORM_CHARACTERS.filter(c => c.id !== 'mobi' && c.id !== 'book').map(c => c.id))('inks every %s bead one draw at a time', character => {
    const rig = createMenuCharacterRig(character);
    expect(rig.finish.outline.count).toBe(rig.segments.length);
    poseStraight(rig, 0, { visible: i => i !== 5 });
    for (let i = 0; i < rig.segments.length; i++) {
      if (i === 5) { expect(scaleAt(rig.finish.outline, i)).toBe(0); continue; }
      // The hull is the bead grown by exactly the ink width.
      expect(scaleAt(rig.finish.outline, i)).toBeCloseTo(rig.segments[i].body.scale.x + MENU_WORM_INK, 5);
    }
    rig.dispose();
  });

  it('gives MOBI shadows and a trail but no bead outline', () => {
    const rig = createMenuCharacterRig('mobi');
    expect(rig.finish.outline).toBeNull();
    poseStraight(rig);
    expect(scaleAt(rig.finish.shadow, 0)).toBeGreaterThan(0);
    rig.dispose();
  });

  it('casts shadows on the sticker, down the face, and none from a body still in the throat', () => {
    const rig = createMenuCharacterRig('classic');
    poseStraight(rig);
    const head = positionAt(rig.finish.shadow, 0);
    expect(head.z).toBeCloseTo(1.5 + 0.004, 5);
    expect(head.y).toBeLessThan(0); // world down, across the face
    expect(rig.finish.shadow.geometry.attributes.aFade.getX(0)).toBe(1);
    poseStraight(rig, 0, { ground: 0 });
    expect(scaleAt(rig.finish.shadow, 0)).toBe(0);
    rig.dispose();
  });

  it('lays a fading slime trail on the worm\'s own clock, only on the face', () => {
    const rig = createMenuCharacterRig('wiggle');
    const alive = () => Array.from(rig.finish.trail.geometry.attributes.aFade.array).filter(v => v > 0).length;
    for (let k = 0; k < 20; k++) poseStraight(rig, k * 0.05, { time: 1 + k * 0.03 });
    const laid = alive();
    expect(laid).toBeGreaterThan(5);
    // A frozen clock (pause) keeps the trail exactly as it was.
    poseStraight(rig, 0.95, { time: 1.57 });
    expect(alive()).toBe(laid);
    poseStraight(rig, 0.95, { time: 1.6 + MENU_TRAIL_LIFE });
    expect(alive()).toBe(0);
    // Diving into a mouth lays nothing.
    for (let k = 0; k < 10; k++) poseStraight(rig, 2 + k * 0.1, { time: 5 + k * 0.03, ground: 0 });
    expect(alive()).toBe(0);
    rig.dispose();
  });

  it('inks with a darker shade of the skin itself', () => {
    const rig = createMenuCharacterRig('wiggle');
    const ink = rig.finish.outline.material.color, body = new Color(rig.skin.body);
    expect(ink.r + ink.g + ink.b).toBeLessThan((body.r + body.g + body.b) / 3);
    expect(ink.r).toBeGreaterThan(ink.g); // cherry stays a red, not a black
    rig.dispose();
  });

  it('releases the finish with the rig', () => {
    const rig = createMenuCharacterRig('classic');
    const spies = [rig.finish.outline.material, rig.finish.shadow.material, rig.finish.trail.material].map(mat => vi.spyOn(mat, 'dispose'));
    rig.dispose();
    spies.forEach(spy => expect(spy).toHaveBeenCalled());
  });
});

describe('menu worm motion helpers', () => {
  it('grounds a tunnel worm only away from its mouths', () => {
    const beats = [{ kind: 'exit', distance: 1 }, { kind: 'enter', distance: 5 }];
    expect(menuWormGround(beats, 0.5)).toBe(0);
    expect(menuWormGround(beats, 1)).toBe(0);
    expect(menuWormGround(beats, 3)).toBe(1);
    expect(menuWormGround(beats, 5.2)).toBe(0);
  });

  it('squeezes the carousel worm without changing its volume or moving the head', () => {
    const out = {};
    for (let i = 1; i < CAROUSEL_WORM_SEGMENTS; i++) for (const t of [0, 0.3, 1.7]) {
      carouselWormMotion(i, t, out);
      expect(out.width * out.width * out.stretch).toBeCloseTo(1, 8);
      expect(out.lift).toBeGreaterThanOrEqual(0);
    }
    expect(carouselWormMotion(0, 1, out).stretch).toBe(1);
    expect(carouselWormMotion(4, 1, out, true)).toMatchObject({ stretch: 1, width: 1, lift: 0 });
  });
});
