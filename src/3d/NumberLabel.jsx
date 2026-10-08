import { TileSurfaceInstance } from './TileSurfaceInstances.jsx';
import { CanvasTexture, MeshBasicMaterial, PlaneGeometry, LinearFilter } from 'three';

// Sticker labels share a synchronous atlas. Views, Chaos tombstones and high
// flip counts must never suspend the cube on a font download or SDF worker.
const CHARACTERS = '0123456789M-RIP#×';
const CELL_WIDTH = 96;
let glyphs;
function getNumberGlyphs() {
  if (glyphs) return glyphs;
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.font = '96px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  for (let index = 0; index < CHARACTERS.length; index++) ctx.fillText(CHARACTERS[index], index * CELL_WIDTH + CELL_WIDTH / 2, 64);
  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  const material = new MeshBasicMaterial({ map: texture, color: 'black', alphaTest: 0.1, toneMapped: false });
  const labelMaterial = new MeshBasicMaterial({ map: texture, alphaTest: 0.1, toneMapped: false });
  const foregroundMaterial = labelMaterial.clone();
  foregroundMaterial.depthTest = false;
  foregroundMaterial.depthWrite = false;
  const geometries = Array.from({ length: CHARACTERS.length }, (_, index) => {
    const geometry = new PlaneGeometry(0.17, 0.23);
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, (index * CELL_WIDTH + uv.getX(i) * CELL_WIDTH) / canvas.width);
    return geometry;
  });
  // Module-owned resources survive level changes, like the shared sticker geometry.
  glyphs = { material, labelMaterial, foregroundMaterial, geometries };
  return glyphs;
}

function GlyphLabel({ value, grid = false }) {
  const { material, geometries } = getNumberGlyphs();
  const digits = String(value).split('');
  return <group name={`${grid ? 'GridLabel' : 'NumberLabel'}:${value}`} position={[0, 0, 0.03]}>
    {digits.map((digit, index) => <TileSurfaceInstance
      key={index}
      name={`${grid ? 'GridGlyph' : 'NumberDigit'}:${digit}`}
      geometry={geometries[CHARACTERS.indexOf(digit)]}
      material={material}
      position={[(index - (digits.length - 1) / 2) * 0.105, 0, 0]}
    />)}
  </group>;
}

export default function NumberLabel({ value }) {
  return <GlyphLabel value={value} />;
}

export function GridLabel({ value }) {
  return <GlyphLabel value={value} grid />;
}

export function CanvasLabel({ value, fontSize = 0.17, color = 'black', depthTest = true, renderOrder = 0, ...props }) {
  const { labelMaterial, foregroundMaterial, geometries } = getNumberGlyphs();
  const characters = String(value).split('');
  return <group name={`CanvasLabel:${value}`} {...props}>
    <group scale={fontSize / 0.17}>
      {characters.map((character, index) => {
        const glyph = CHARACTERS.indexOf(character);
        if (glyph < 0) return null;
        return <TileSurfaceInstance key={index} geometry={geometries[glyph]}
          material={depthTest ? labelMaterial : foregroundMaterial} color={color} renderOrder={renderOrder}
          position={[(index - (characters.length - 1) / 2) * 0.105, 0, 0]} />;
      })}
    </group>
  </group>;
}
