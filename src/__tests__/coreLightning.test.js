import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { makeCoreLightningUniforms, setCoreLightningSize, withCoreLightning, coreLightningGLSL } from '../3d/coreLightning.js';
import { coreOpeningBandWidth, coreOpeningRadius } from '../3d/corePassage.js';
import { tunnelCoreScale, tunnelDockWidth } from '../utils/tunnelPath.js';
import { coreCubieMatrixInto, CORE_ZOOM_MAX } from '../3d/antipodalCore.js';

const shader = () => ({
  uniforms: {},
  vertexShader: '#include <common>\nvoid main() {\n#include <begin_vertex>\n}',
  fragmentShader: '#include <common>\nvoid main() {\n#include <emissivemap_fragment>\n}'
});

describe('core lightning seams', () => {
  it('measures the core in cubie units, so the shell sits on the plastic surface at every size', () => {
    for (const size of [2, 3, 5, 10, 15]) {
      const u = makeCoreLightningUniforms(), s = tunnelCoreScale(size);
      setCoreLightningSize(u, size, s);
      // A point on the outer face of the last cubie, through its real core matrix.
      const m = coreCubieMatrixInto(new THREE.Matrix4(), size - 1, 0, 0, size);
      const p = new THREE.Vector3(0.48, 0, 0).applyMatrix4(m);
      const q = p.x * u.uCoreCell.value.x + u.uCoreCell.value.y;
      expect(Math.abs(q - u.uCoreCell.value.y)).toBeCloseTo(u.uCoreShell.value, 8);
      // Cubie centres land on whole numbers, so seams fall half way between.
      const centre = new THREE.Vector3().applyMatrix4(m).y * u.uCoreCell.value.x + u.uCoreCell.value.y;
      expect(centre).toBeCloseTo(0, 8);
    }
  });

  it('patches on top of an existing compile hook, with its own program key per variant', () => {
    const u = makeCoreLightningUniforms();
    let ran = false;
    const base = new THREE.MeshStandardMaterial();
    base.onBeforeCompile = () => { ran = true; };
    base.customProgramCacheKey = () => 'core-sticker';
    const sticker = withCoreLightning(base, u, { haloOnly: true });
    const body = withCoreLightning(new THREE.MeshStandardMaterial(), u);
    const s = shader();
    sticker.onBeforeCompile(s);
    expect(ran).toBe(true);
    expect(s.uniforms.uCoreBoltTime).toBe(u.uCoreBoltTime);
    expect(s.vertexShader).toContain('vCoreLocal = (instanceMatrix');
    expect(s.fragmentShader).toContain('totalEmissiveRadiance += coreLightning(1.0)');
    const b = shader();
    body.onBeforeCompile(b);
    expect(b.fragmentShader).toContain('coreLightning(0.0)');
    expect(sticker.customProgramCacheKey()).toBe('core-sticker-core-lightning-halo');
    expect(body.customProgramCacheKey()).not.toBe(sticker.customProgramCacheKey());
    for (const name of Object.keys(u)) expect(coreLightningGLSL).toContain(name);
  });
});

describe('the ridden band and the core opening', () => {
  it('fills the opening as the core swells, leaving a rim, and never narrows below its tile', () => {
    for (const size of [2, 3, 5, 10, 15]) {
      expect(coreOpeningBandWidth(size, 1)).toBeCloseTo(tunnelDockWidth(size), 10);
      for (let zoom = 1; zoom <= CORE_ZOOM_MAX; zoom += 0.25) {
        const width = coreOpeningBandWidth(size, zoom);
        expect(width).toBeGreaterThanOrEqual(tunnelDockWidth(size));
        if (zoom >= 1.5) {
          expect(width).toBeLessThan(2 * coreOpeningRadius(size, zoom));
          expect(width).toBeGreaterThan(1.5 * coreOpeningRadius(size, zoom));
        }
      }
    }
  });
});
