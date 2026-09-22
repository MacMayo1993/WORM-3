// Preview and launch must resolve the same palette, including inherited custom
// colors. Copy mutable maps so a later settings edit cannot recolor a placed bet.
export function chaosSetupSettings(current = {}, selection = {}) {
  current = current || {};
  selection = selection || {};
  const merged = { ...current, ...selection };
  return {
    ...merged,
    colorScheme: selection.colorScheme || current.colorScheme || 'standard',
    customColors: merged.customColors ? { ...merged.customColors } : null,
    biomeMode: { enabled: false, faceAssignment: null },
  };
}
