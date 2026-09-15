// Keep the store protocol small; lesson copy loads with the WORM HUD.
export const WORM_DEMO_LESSON_COUNT = 18;
export const wormDemoActive = s => s.demoMode && s.demoStep === 'worm-traversal';
export const newWormDemo = () => ({ demoWormLessonIndex: 0, demoWormStarted: false, demoWormPrepared: false, demoWormAttempt: 0, demoWormComplete: false, demoWormFinished: false, demoWormCompleted: [], demoWormProgress: '', demoWormTarget: null, demoWormHazardCleared: null, demoWormSteered: false });
