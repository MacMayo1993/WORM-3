// Where each sticker plane sits on its cubie and how it is turned to face out.
// Pure data, no Three imports, so tests and shaders' face mappings can be held
// to it (see FACE_PLANE_AXES in styles/shaders/craftGlsl.js). The arrays are
// allocated once, so StickerPlane does not re-render on new array references.
export const STICKER_POS = {
  PZ: [0, 0, 0.51],
  NZ: [0, 0, -0.51],
  PX: [0.51, 0, 0],
  NX: [-0.51, 0, 0],
  PY: [0, 0.51, 0],
  NY: [0, -0.51, 0],
};
export const STICKER_ROT = {
  PZ: [0, 0, 0],
  NZ: [0, Math.PI, 0],
  PX: [0, Math.PI / 2, 0],
  NX: [0, -Math.PI / 2, 0],
  PY: [-Math.PI / 2, 0, 0],
  NY: [Math.PI / 2, 0, 0],
};
