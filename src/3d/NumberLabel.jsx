import { TileSurfaceInstance } from './TileSurfaceInstances.jsx';
import { CanvasTexture, MeshBasicMaterial, PlaneGeometry, LinearFilter } from 'three';

// One small, synchronous atlas for all ten digits. No font download, SDF worker,
// or per-label material: the surface pool draws at most ten glyph batches.
let glyphs;
function getNumberGlyphs() {
  if (glyphs) return glyphs;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.font = '96px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  for (let digit = 0; digit < 10; digit++) ctx.fillText(String(digit), digit * 96 + 48, 64);
  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  const material = new MeshBasicMaterial({ map: texture, color: 'black', alphaTest: 0.1, toneMapped: false });
  const geometries = Array.from({ length: 10 }, (_, digit) => {
    const geometry = new PlaneGeometry(0.17, 0.23);
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, (digit * 96 + uv.getX(i) * 96) / 1024);
    return geometry;
  });
  // Module-owned resources survive level changes, like the shared sticker geometry.
  glyphs = { material, geometries };
  return glyphs;
}

export default function NumberLabel({ value }) {
  const { material, geometries } = getNumberGlyphs();
  const digits = String(value).split('');
  return <group name={`NumberLabel:${value}`} position={[0, 0, 0.03]}>
    {digits.map((digit, index) => <TileSurfaceInstance
      key={index}
      name={`NumberDigit:${digit}`}
      geometry={geometries[Number(digit)]}
      material={material}
      position={[(index - (digits.length - 1) / 2) * 0.105, 0, 0]}
    />)}
  </group>;
}
