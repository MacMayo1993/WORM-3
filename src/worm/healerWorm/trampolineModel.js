import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TRAMPOLINE } from './trampoline.js';
import { uploadInstancePrefix } from '../../3d/instanceUploads.js';

class SpringWire extends THREE.Curve {
    constructor(x, y) { super(); this.x = x; this.y = y; }
    getPoint(t, out = new THREE.Vector3()) {
        const angle = t * Math.PI * 8;
        return out.set(this.x + Math.cos(angle) * 0.030, this.y + Math.sin(angle) * 0.030, 0.046 + t * 0.115);
    }
}
const merge = geometries => {
    const combined = mergeGeometries(geometries);
    geometries.forEach(g => g.dispose());
    return combined;
};
const ring = (r, tube, z) => new THREE.TorusGeometry(r, tube, 6, 40).translate(0, 0, z);

/** One model, palette and flex shader for both the collectible and terrain. */
export function createTrampolineBatch(capacity) {
    const springs = [], feet = [], bolts = [];
    for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, x = Math.cos(a), y = Math.sin(a);
        springs.push(new THREE.TubeGeometry(new SpringWire(x * 0.31, y * 0.31), 28, 0.012, 5, false));
        bolts.push(new THREE.SphereGeometry(0.022, 8, 5).translate(x * 0.35, y * 0.35, 0.207));
        if (i % 2 === 0) feet.push(new THREE.BoxGeometry(0.13, 0.10, 0.035).rotateZ(a).translate(x * 0.31, y * 0.31, 0.018));
    }
    const chevron = new THREE.Shape();
    chevron.moveTo(-0.135, -0.024); chevron.lineTo(0, 0.092); chevron.lineTo(0.135, -0.024);
    chevron.lineTo(0.10, -0.065); chevron.lineTo(0, 0.020); chevron.lineTo(-0.10, -0.065); chevron.closePath();
    const tread = [];
    for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        tread.push(new THREE.BoxGeometry(0.11, 0.036, 0.018).rotateZ(a + Math.PI / 2)
            .translate(Math.cos(a) * 0.344, Math.sin(a) * 0.344, TRAMPOLINE.deck + 0.034));
    }
    const flatten = g => { const result = g.toNonIndexed(); g.dispose(); return result; };
    const designs = [
        ['base', merge([ring(0.334, 0.032, 0.031), ...feet]), '#142a32', 0.45, 0.44, 0],
        ['springs', merge([...springs, ...bolts]), TRAMPOLINE.metal, 0.58, 0.24, 0.07],
        ['rim', merge([ring(0.352, 0.037, TRAMPOLINE.deck),
            ring(0.341, 0.016, TRAMPOLINE.deck - 0.039)]), TRAMPOLINE.rim, 0.2, 0.34, 0.06],
        ['mat', new THREE.RingGeometry(0.001, 0.315, 48, 8).translate(0, 0, TRAMPOLINE.deck - 0.012), TRAMPOLINE.mat, 0.05, 0.86, 0.15],
        ['arrows', merge([...[-0.078, 0.085].map(y => flatten(new THREE.ShapeGeometry(chevron).translate(0, y, TRAMPOLINE.deck - 0.009))), ...tread.map(flatten)]), TRAMPOLINE.light, 0.1, 0.42, 0.15],
    ];
    const meshes = designs.map(([part, geometry, color, metalness, roughness, flex]) => {
        const positions = geometry.attributes.position;
        const weights = new Float32Array(positions.count);
        for (let i = 0; i < positions.count; i++) {
            const r = Math.hypot(positions.getX(i), positions.getY(i));
            weights[i] = part === 'mat' || part === 'arrows'
                ? 0.06 + (flex - 0.06) * (1 - Math.min(1, r / 0.313) ** 2) ** 2
                : part === 'springs' ? flex * Math.min(1, positions.getZ(i) / TRAMPOLINE.deck) : flex;
        }
        geometry.setAttribute('bounceFlex', new THREE.BufferAttribute(weights, 1));
        for (const attr of ['bouncePress', 'bounceAlpha', 'bounceVariant']) geometry.setAttribute(attr,
            new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.DynamicDrawUsage));
        const material = new THREE.MeshStandardMaterial({ color, metalness, roughness, transparent: true,
            emissive: part === 'arrows' ? TRAMPOLINE.light : part === 'rim' ? TRAMPOLINE.rim : '#000000',
            emissiveIntensity: part === 'arrows' ? 0.82 : part === 'rim' ? 0.27 : 0, side: THREE.DoubleSide });
        material.onBeforeCompile = shader => {
            shader.vertexShader = `attribute float bounceFlex; attribute float bouncePress; attribute float bounceAlpha;
                attribute float bounceVariant; varying float vBounceAlpha; varying float vBounceVariant; varying vec2 vMat;
                ${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
                vBounceAlpha=bounceAlpha; vBounceVariant=bounceVariant; vMat=position.xy;
                transformed.z-=bounceFlex*bouncePress;`);
            shader.fragmentShader = `varying float vBounceAlpha; varying float vBounceVariant; varying vec2 vMat;
                ${shader.fragmentShader}`.replace('#include <color_fragment>', `#include <color_fragment>
                diffuseColor.a*=vBounceAlpha;
                ${part === 'mat' ? 'float rr=length(vMat); float grooves=1.0-smoothstep(0.003,0.008,abs(fract(rr*15.0-0.15)-0.5)/15.0); diffuseColor.rgb=mix(diffuseColor.rgb*(0.9+0.1*step(0.0,sin(vMat.x*190.0)*sin(vMat.y*190.0))),vec3(0.11,0.36,0.31),grooves*0.74);' : ''}
                ${part === 'rim' || part === 'arrows' ? `if(vBounceVariant>2.5) diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.72,0.52,1.0),0.8);
                else if(vBounceVariant>1.5) diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.65,0.9,1.0),0.8);
                else if(vBounceVariant>0.5) diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.0,0.3,0.08),0.8);` : ''}`);
        };
        material.customProgramCacheKey = () => `trampoline-${part}`;
        const mesh = new THREE.InstancedMesh(geometry, material, capacity);
        mesh.name = `trampoline-${part}`;
        mesh.count = 0; mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        return mesh;
    });
    return {
        meshes,
        reset() { for (const mesh of meshes) mesh.count = 0; },
        put(index, matrix, compression = 0, alpha = 1, variant = 0) {
            if (index >= capacity) return;
            for (const mesh of meshes) {
                mesh.setMatrixAt(index, matrix); mesh.count = index + 1;
                mesh.geometry.attributes.bouncePress.setX(index, compression);
                mesh.geometry.attributes.bounceAlpha.setX(index, alpha);
                mesh.geometry.attributes.bounceVariant.setX(index, variant);
            }
        },
        flush() {
            for (const mesh of meshes) {
                // Only the pads placed this frame: the pool holds one per tile.
                const { attributes } = mesh.geometry;
                uploadInstancePrefix(mesh.instanceMatrix, mesh.count);
                uploadInstancePrefix(attributes.bouncePress, mesh.count);
                uploadInstancePrefix(attributes.bounceAlpha, mesh.count);
                uploadInstancePrefix(attributes.bounceVariant, mesh.count);
                // Empty, a pad part would still cost two program selections a pass
                // (transparent and double-sided): hide it.
                mesh.visible = mesh.count > 0;
            }
        },
        dispose() { for (const mesh of meshes) { mesh.geometry.dispose(); mesh.material.dispose(); mesh.dispose(); } },
    };
}
