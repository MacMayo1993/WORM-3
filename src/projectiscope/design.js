// Mode flags use a URL fragment so the PWA serves the precached HTML offline.
export const PROJECTISCOPE_URL = `${import.meta.env.BASE_URL}projectiscope/index.html`;

// Keep saved drawings bounded: these recipes are persisted with player settings.
export function validProjectiscopeDesign(value) {
  if (value?.version !== 1 || typeof value.recipe !== 'string' || value.recipe.length > 180000) return false;
  if (typeof value.thumbnail !== 'string' || value.thumbnail.length > 100000 ||
      !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value.thumbnail)) return false;
  try {
    const recipe = JSON.parse(atob(value.recipe));
    return recipe.v === 1 && ['O', 'T', 'I', 'D', 'C'].includes(recipe.grp);
  } catch { return false; }
}

export function projectiscopeConfig(design, paused = false) {
  return { type: 'projectiscope:config', mode: 'kaleido', journey: false, immersive: false, paused,
    ...(validProjectiscopeDesign(design) ? { recipe: design.recipe } : { group: 'O', palette: 'worm', seed: 42 }) };
}
