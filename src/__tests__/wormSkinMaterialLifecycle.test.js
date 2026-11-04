import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createWormSkinMaterial, applySkinMaterialProfile, applyBioluminescence, updateWormSkinMaterialTime } from '../worm/wormSkinMaterial.js';
import { applyCharacterFinish } from '../worm/wormCharacterVisuals.js';
import { BUMP_STYLES, SKIN_FX } from '../worm/wormSkinFX.js';

// Exercise Three's real compile hook, including recompilation, without a GPU.
function compile(material) {
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
  material.onBeforeCompile(shader);
  return shader.uniforms;
}

describe('character skin shader lifecycle', () => {
  it.each(['classic', 'inch', 'glow', 'book', 'wiggle', 'prism'])('%s keeps every skin recipe on first draw and recompilation', character => {
    const material = createWormSkinMaterial();
    for (const fx of Object.values(SKIN_FX)) {
      applySkinMaterialProfile(material, fx, 3);
      applyBioluminescence(material, '#00ff88', character === 'glow');
      applyCharacterFinish(material, character);
      updateWormSkinMaterialTime(material, 7.5);
      for (let pass = 0; pass < 2; pass++) {
        const uniforms = compile(material);
        expect(uniforms.uStyle.value).toBe(character === 'prism' ? 0 : BUMP_STYLES[fx.bump.style]);
        expect(uniforms.uAmp.value).toBe(character === 'prism' ? 0 : fx.bump.amp ?? 0);
        expect(uniforms.uFreq.value).toBe(fx.bump.freq ?? 1);
        expect(uniforms.uSpeed.value).toBe(fx.bump.speed ?? 1);
        expect(uniforms.uSeed.value).toBe(3);
        expect(uniforms.uTime.value).toBe(7.5);
        expect(uniforms.uEmissiveTint.value).toBe(character === 'glow' ? 0 : 1);
      }
    }
    material.dispose();
  });

  it('restores the equipped skin after leaving Prism, before and after compilation', () => {
    const material = createWormSkinMaterial();
    const fx = SKIN_FX.lava;
    applySkinMaterialProfile(material, fx);
    applyCharacterFinish(material, 'prism');
    let uniforms = compile(material);
    expect(uniforms.uAmp.value).toBe(0);
    applySkinMaterialProfile(material, fx);
    applyCharacterFinish(material, 'classic');
    expect(uniforms.uAmp.value).toBe(fx.bump.amp);
    expect(uniforms.uStyle.value).toBe(BUMP_STYLES.bump);
    applyCharacterFinish(material, 'prism');
    expect(uniforms.uAmp.value).toBe(0);
    uniforms = compile(material);
    expect(uniforms.uAmp.value).toBe(0);
    applyCharacterFinish(material, 'wiggle');
    expect(uniforms.uAmp.value).toBe(fx.bump.amp);
    material.dispose();
  });
});
