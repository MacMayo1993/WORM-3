import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { createCautionDissolve } from '../worm/healerWorm/cautionDissolve.js';
import { addWormDissolve } from '../components/intro/introDissolve.js';

const uniforms = () => ({ uDissolve: { value: 0 }, uDissolveFrame: { value: new THREE.Matrix4() } });
it('dissolves instanced beads and the face in one world frame without modifying shared materials', () => {
    const root = new THREE.Group(), source = new THREE.MeshStandardMaterial();
    const skinPatch = vi.fn(shader => { shader.uniforms.skin = { value: 7 }; });
    source.onBeforeCompile = skinPatch;
    source.customProgramCacheKey = () => 'equipped-skin';
    const geometry = new THREE.SphereGeometry(1, 8, 4);
    const body = new THREE.InstancedMesh(geometry, source, 10), face = new THREE.Mesh(geometry, source);
    root.add(body, face);
    const shared = uniforms(), restore = createCautionDissolve(root, shared);
    const bodyCopy = body.material, faceCopy = face.material;
    expect(bodyCopy).not.toBe(source); expect(faceCopy).not.toBe(bodyCopy);
    for (const [copy, instanced] of [[bodyCopy, true], [faceCopy, false]]) {
        const shader = { uniforms: {}, ...THREE.ShaderLib.standard };
        shader.uniforms = {};
        copy.onBeforeCompile(shader, {});
        expect(shader.uniforms.skin.value).toBe(7);
        expect(shader.uniforms.uDissolve).toBe(shared.uDissolve);
        expect(shader.fragmentShader).toContain('if (dissolveGap < 0.0) discard;');
        expect(shader.vertexShader).toContain(instanced
            ? 'uDissolveFrame * modelMatrix * instanceMatrix * vec4(transformed, 1.0)'
            : 'uDissolveFrame * modelMatrix * vec4(transformed, 1.0)');
        expect(copy.customProgramCacheKey()).toContain('equipped-skin');
    }
    const disposed = vi.fn(); bodyCopy.addEventListener('dispose', disposed); faceCopy.addEventListener('dispose', disposed);
    restore();
    expect(disposed).toHaveBeenCalledTimes(2);
    expect(body.material).toBe(source); expect(face.material).toBe(source);
    expect(source.onBeforeCompile).toBe(skinPatch);
    geometry.dispose(); source.dispose();
});

it('supports custom accessory shaders without relying on built-in shader chunks', () => {
    const material = new THREE.ShaderMaterial({
        vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'void main() { gl_FragColor = vec4(1.0); }',
    });
    addWormDissolve(material, uniforms());
    const shader = { uniforms: {}, vertexShader: material.vertexShader, fragmentShader: material.fragmentShader };
    material.onBeforeCompile(shader, {});
    expect(shader.vertexShader).toContain('vDissolvePos = (uDissolveFrame * modelMatrix * vec4(position, 1.0)).xyz;');
    expect(shader.fragmentShader).toContain('if (dissolveGap < 0.0) discard;');
    expect(shader.fragmentShader).toContain('gl_FragColor.rgb +=');
    material.dispose();
});
