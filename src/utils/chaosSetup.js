export const MAX_CHAOS_SIZE = 5;
export const normalizeChaosSize = value => Number.isFinite(Number(value))
  ? Math.max(2, Math.min(MAX_CHAOS_SIZE, Math.round(Number(value)))) : 3;

// Preview and launch must resolve the same palette, including inherited custom
// colors. Copy mutable maps so a later settings edit cannot recolor a placed bet.
export function chaosSetupSettings(current = {}, selection = {}) {
  current = current || {};
  selection = selection || {};
  const merged = { ...current, ...selection };
  return {
    ...merged,
    cubeSize: normalizeChaosSize(selection.cubeSize ?? current.cubeSize ?? 3),
    // Old round snapshots may include flipPads. Chaos's raised presentation is
    // a runtime override, so setup must retain the player's saved preference.
    flipPads: current.flipPads,
    colorScheme: selection.colorScheme || current.colorScheme || 'standard',
    customColors: merged.customColors ? { ...merged.customColors } : null,
    biomeMode: { enabled: false, faceAssignment: null },
  };
}
