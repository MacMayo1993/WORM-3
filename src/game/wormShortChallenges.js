// Skill checks use the real simulation and a clock that only runs during play.
export const WORM_SHORT_CHALLENGES = [
  {
    id: 'collect-heal', challenge: true, cue: 'link', title: 'Grow, ride, restore',
    speed: 2.6, timeLimit: 25, orbGoal: 4,
    goal: 'Collect 4 orbs, then seal the tunnel.',
    instruction: 'The four orbs are spread across the front face. Plan a route that collects every one before jumping onto the marked pad. Finish the ride and clear your tail.',
    success: 'Four pickups. One sealed pair.',
  },
  {
    id: 'body-route', practiceId: 'body-jump', challenge: true, cue: 'target', title: 'Cross your own route',
    speed: 2.8, timeLimit: 25, jumpGoal: 1, requireDouble: true, orbGoal: 3,
    goal: 'Double-jump over your body, then collect 3 orbs.',
    instruction: 'Use both jumps in one flight to clear your body. Land safely, then collect the three orbs around the upper-right corner. An empty double jump does not count. Plan your turns around the long tail.',
    success: 'Body cleared. Three orbs collected.',
  },
  {
    id: 'ring-route', practiceId: 'surround', challenge: true, cue: 'target', title: 'Close the loop',
    speed: 3, timeLimit: 25, orbGoal: 4,
    goal: 'Collect 4 corner orbs, then surround the hole.',
    instruction: 'Collect an orb from each corner of the front face to grow long enough. Then cover all eight tiles around the opening at once. Find your own route back to the ring.',
    success: 'You grew the body and closed the ring.',
  },
];
