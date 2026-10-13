import { bodyMaterialProps } from '../../3d/cubeViewStyles.js';
import { getViewPickupGeometry } from './viewPickupGeometry.js';

const opacityTag = opacity => mesh => { if (mesh) mesh.userData.baseOpacity = opacity; };

export default function ViewPickupCube({ view }) {
  const geometry = getViewPickupGeometry(view);
  const glass = view === 'glass';
  return <group name={`view-pickup-${view}`} rotation={[0.22, 0, 0.16]}>
    {view !== 'wireframe' && <mesh geometry={geometry.body} ref={opacityTag(glass ? 0.14 : 1)}>
      <meshStandardMaterial {...bodyMaterialProps(view)} color={glass ? '#9be7ff' : bodyMaterialProps(view).color}
        emissive={view === 'chrome' ? '#7c8999' : '#182333'} emissiveIntensity={view === 'chrome' ? 0.32 : 0.12}
        transparent opacity={glass ? 0.14 : 1} depthWrite={!glass} />
    </mesh>}
    {geometry.panels && <mesh geometry={geometry.panels} ref={opacityTag(glass ? 0.18 : 1)}>
      <meshStandardMaterial vertexColors roughness={view === 'lego' ? 0.28 : 0.38} metalness={0}
        emissive={view === 'neon' ? '#22052b' : '#222222'} emissiveIntensity={view === 'neon' ? 0.35 : 0.12}
        transparent opacity={glass ? 0.18 : 1} depthWrite={!glass} />
    </mesh>}
    {geometry.details && <mesh geometry={geometry.details} ref={opacityTag(1)}>
      <meshBasicMaterial vertexColors toneMapped={false} transparent />
    </mesh>}
    {geometry.frames && <mesh geometry={geometry.frames} ref={opacityTag(1)}>
      <meshBasicMaterial vertexColors toneMapped={false} transparent />
    </mesh>}
  </group>;
}
