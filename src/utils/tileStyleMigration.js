// Retired tile purchases and equipment transfer to their replacement. Keep the
// legacy IDs only at save/input boundaries, never in the catalog or shaders.
export const migrateTileStyle = key => key === 'mobiusBand' ? 'mirrorFacets' : key;
export const migrateTileItem = id => id === 'tile_mobiusBand' ? 'tile_mirrorFacets' : id;
