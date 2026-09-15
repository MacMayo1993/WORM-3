import { MathUtils, Vector3 } from 'three';
import { tunnelCameraInside } from '../tunnelVisibility.js';

const view = new Vector3();

export function updateHealBadgePose(mesh, position, normal, cameraPosition, size, phase) {
    view.copy(cameraPosition).sub(position);
    const distance = view.length();
    const facing = view.normalize().dot(normal);
    mesh.visible = facing > 0.18 && !tunnelCameraInside(cameraPosition, size, phase);
    if (!mesh.visible) return;
    mesh.position.copy(position).addScaledVector(normal, 0.68);
    const width = MathUtils.clamp(distance * 0.13, 0.9, 1.35);
    mesh.scale.set(width, width * 160 / 512, 1);
    mesh.material.opacity = MathUtils.smoothstep(facing, 0.18, 0.38);
}
