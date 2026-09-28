import { Color, Group, Matrix4, Object3D, PointLight, Vector3 } from 'three';

export const WORM_POINT_LIGHTS = 4;

// Sources carry the old orb light's animated properties, but are not renderer
// lights. The fixed pool remains visible, including at zero intensity.
export function createWormLightSource() {
  return Object.assign(new Object3D(), { color: new Color(), intensity: 0, distance: 0, decay: 2 });
}

export function createWormLightPool(count = WORM_POINT_LIGHTS) {
  const group = new Group();
  group.name = 'WormPointLightPool';
  const lights = Array.from({ length: count }, () => new PointLight(0xffffff, 0, 0, 2));
  group.add(...lights);
  const sources = new Map();
  const candidates = [];
  const inverse = new Matrix4();
  return {
    group, lights,
    register(source) {
      sources.set(source, { source, position: new Vector3(), distance: 0 });
      return () => sources.delete(source);
    },
    update(cameraPosition) {
      candidates.length = 0;
      for (const entry of sources.values()) {
        const source = entry.source;
        if (source.intensity <= 0 || !source.parent) continue;
        let visible = true;
        for (let node = source; node; node = node.parent) {
          if (!node.visible) { visible = false; break; }
        }
        if (!visible) continue;
        source.getWorldPosition(entry.position);
        entry.distance = entry.position.distanceToSquared(cameraPosition);
        candidates.push(entry);
      }
      candidates.sort((a, b) => a.distance - b.distance);
      group.updateWorldMatrix(true, false);
      inverse.copy(group.matrixWorld).invert();
      for (let i = 0; i < lights.length; i++) {
        const light = lights[i], entry = candidates[i];
        light.intensity = entry?.source.intensity ?? 0;
        if (!entry) continue;
        light.position.copy(entry.position).applyMatrix4(inverse);
        light.color.copy(entry.source.color);
        light.distance = entry.source.distance;
        light.decay = entry.source.decay;
      }
    }
  };
}
