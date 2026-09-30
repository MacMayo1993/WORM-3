// Materials are shared by style/color. Bind physical sticker identity at draw
// time, including portal-patched clones, without cloning a material per tile.
export function bindTileStyleIdentity(home, face) {
  const x = home?.x ?? 0, y = home?.y ?? 0, z = home?.z ?? 0;
  const bind = (_renderer, _scene, _camera, _geometry, material) => {
    if (!material.uniforms?.tileHome) return;
    material.uniforms.tileHome.value.set(x, y, z);
    material.uniforms.tileFace.value = face ?? 0;
    // Consecutive meshes can use exactly the same ShaderMaterial/program.
    material.uniformsNeedUpdate = true;
  };
  bind.tileStyleBound = true;
  return bind;
}

// Shared styles also appear on pickups and previews without sticker metadata.
// Reset identity for those draws so they cannot inherit a previous tile's seed.
export function bindDefaultTileStyleIdentity(_renderer, _scene, _camera, _geometry, object) {
  if (object.onBeforeRender?.tileStyleBound || !this.uniforms?.tileHome) return;
  this.uniforms.tileHome.value.set(object.id, 0, 0);
  this.uniforms.tileFace.value = 0;
  this.uniformsNeedUpdate = true;
}

// Roll counts follow physical pieces, just like the shader seed. Looking up
// the moving world position samples several unrelated cells during one turn.
export function bumpTileRolls(data, cubies, size, axis, layers) {
  for (const layer of new Set(layers)) {
    for (let a = 0; a < size; a++) for (let b = 0; b < size; b++) {
      const x = axis === 'col' ? layer : a;
      const y = axis === 'row' ? layer : axis === 'col' ? a : b;
      const z = axis === 'depth' ? layer : b;
      const stickers = cubies[x]?.[y]?.[z]?.stickers;
      if (!stickers) continue;
      const home = Object.values(stickers).find(sticker => sticker.origPos)?.origPos;
      if (!home) continue;
      const offset = (home.z * size * size + home.x + home.y * size) * 4;
      data[offset] = (data[offset] + 1) & 255;
    }
  }
}
