// Solver state belongs to one puzzle session, never to menu/demo presentation.
export const newSolverSession = () => ({
  solveModeActive: false,
  solveFocusedStep: null,
  solveHighlights: [],
  kociembaLayerHighlight: null,
});

export const selectSolveModeVisible = (state) =>
  state.solveModeActive && !state.showMainMenu && !state.demoMode;
