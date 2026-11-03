// Optional laboratory, separate from the short first-play course. Each entry
// uses the actual character and requires an observed simulation consequence.
export const DEMO_SIGNATURE_LESSONS = [
  ['classic', 'Call orbs from a distance', 'Press Orb Call before you reach the side-lane orbs. Pull one in without touching its tile.', 'Orb Call collected a remote orb using the real magnet reach.'],
  ['book', 'Pause a turning layer', 'Watch the layer countdown begin, then press the Time Out ability in the action tray. Keep crawling while Time Out holds the clock, and watch it resume.', 'The live layer clock stopped while you kept moving, then resumed.'],
  ['prism', 'Heal with mixed colors', 'Spectrum is always active. You carry two different colors, neither matching this tunnel. Jump onto the pad and let your whole tail exit.', 'Spectrum spent mixed-color charges to heal both ends of the tunnel.'],
  ['wiggle', 'Sweep with your tail', 'Press Wiggle to sweep the staged tail across the nearby orbs. Let the sweep finish.', 'Your sweeping body collected an orb before control returned.'],
  ['inch', 'Coil, leap and slam', 'Press Spring, or hold it to aim and release. Land the leap to trigger its orb-collecting slam.', 'Your Spring landing slammed the floor and collected a nearby orb.'],
  ['glow', 'Pass through your own light', 'Press Trail, then keep straight through the body crossing ahead without jumping.', 'You passed safely through your own body using Light Trail.'],
  ['mobi', 'Make your own tunnel', 'Press Tunnel on the unflipped floor. Ride the tunnel you create and keep moving until your tail exits.', 'You created a real tunnel and completed its first ride. Heal it before creating another.'],
].map(([character, title, instruction, success]) => ({
  id: `signature-${character}`, practiceId: 'signature-showcase', character,
  category: 'Signatures', chapter: 'Character abilities', title, instruction, success,
}));
