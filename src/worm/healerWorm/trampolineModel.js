import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TRAMPOLINE } from './trampoline.js';

class SpringWire extends THREE.Curve {
    constructor(x, y) { super(); this.x = x; this.y = y; }
    getPoint(t, out = new THREE.Vector3()) {
        const angle = t * Math.PI * 8;
        return out.set(this.x + Math.cos(angle) * 0.026, this.y + Math.sin(angle) * 0.026, 0.045 + t * 0.105);
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
        springs.push(new THREE.TubeGeometry(new SpringWire(x * 0.31, y * 0.31), 28, 0.009, 5, false));
        bolts.push(new THREE.SphereGeometry(0.017, 6, 4).translate(x * 0.35, y * 0.35, 0.207));
        if (i % 2 === 0) feet.push(new THREE.BoxGeometry(0.13, 0.10, 0.035).rotateZ(a).translate(x * 0.31, y * 0.31, 0.018));
    }
    const chevron = new THREE.Shape();
    chevron.moveTo(-0.105, -0.02); chevron.lineTo(0, 0.075); chevron.lineTo(0.105, -0.02);
    chevron.lineTo(0.075, -0.05); chevron.lineTo(0, 0.018); chevron.lineTo(-0.075, -0.05); chevron.closePath();
    const designs = [
        ['base', merge([ring(0.335, 0.026, 0.025), ...feet]), '#1b282b', 0.7, 0.36, 0],
        ['springs', merge([...springs, ...bolts]), TRAMPOLINE.metal, 0.8, 0.22, 0.07],
        ['rim', ring(0.35, 0.035, TRAMPOLINE.deck), TRAMPOLINE.rim, 0.4, 0.33, 0.06],
        ['mat', new THREE.RingGeometry(0.001, 0.313, 48, 6).translate(0, 0, TRAMPOLINE.deck - 0.012), TRAMPOLINE.mat, 0.05, 0.86, 0.15],
        ['arrows', merge([-0.08, 0.08].map(y => new THREE.ShapeGeometry(chevron).translate(0, y, TRAMPOLINE.deck - 0.009))), TRAMPOLINE.light, 0.1, 0.5, 0.15],
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
            emissiveIntensity: part === 'arrows' ? 0.6 : 0.12, side: THREE.DoubleSide });
        material.onBeforeCompile = shader => {
            shader.vertexShader = `attribute float bounceFlex; attribute float bouncePress; attribute float bounceAlpha;
                attribute float bounceVariant; varying float vBounceAlpha; varying float vBounceVariant; varying vec2 vMat;
                ${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
                vBounceAlpha=bounceAlpha; vBounceVariant=bounceVariant; vMat=position.xy;
                transformed.z-=bounceFlex*bouncePress;`);
            shader.fragmentShader = `varying float vBounceAlpha; varying float vBounceVariant; varying vec2 vMat;
                ${shader.fragmentShader}`.replace('#include <color_fragment>', `#include <color_fragment>
                diffuseColor.a*=vBounceAlpha;
                ${part === 'mat' ? 'diffuseColor.rgb*=0.84+0.16*step(0.0,sin(vMat.x*240.0)*sin(vMat.y*240.0));' : ''}
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
                mesh.instanceMatrix.needsUpdate = true;
                for (const attr of ['bouncePress', 'bounceAlpha', 'bounceVariant']) mesh.geometry.attributes[attr].needsUpdate = true;
            }
        },
        dispose() { for (const mesh of meshes) { mesh.geometry.dispose(); mesh.material.dispose(); mesh.dispose(); } },
    };
}
