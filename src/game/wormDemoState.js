import { WORM_SHORT_CHALLENGES } from './wormShortChallenges.js';

// Keep the store protocol small; lesson copy loads with the WORM HUD.
import { WORM_DEMO_LESSON_COUNT, WORM_SHOWCASE_IDS } from './wormDemoCatalog.js';
export { WORM_DEMO_LESSON_COUNT };
export const wormPracticeCount = s => s.demoWormCourse === 'challenges' ? WORM_SHORT_CHALLENGES.length : s.demoWormCourse === 'showcase' ? WORM_SHOWCASE_IDS.length : WORM_DEMO_LESSON_COUNT;
export const wormDemoActive = s => s.demoMode && s.demoStep === 'worm-traversal';
export const newWormDemo = () => ({ demoWormCourse: 'practice', demoWormLessonIndex: 0, demoWormStarted: false, demoWormPrepared: false, demoWormAttempt: 0, demoWormComplete: false, demoWormFinished: false, demoWormCompleted: [], demoWormSkipped: [], demoWormProgress: '', demoChallengeHelpOpen: false, demoWormTarget: null, demoWormHazardCleared: null, demoWormSteered: false });
