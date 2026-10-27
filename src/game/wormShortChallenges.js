// These use the real practice simulation. Completion is never a button press.
export const WORM_SHORT_CHALLENGES = [
  {
    id: 'collect-heal', cue: 'link', title: 'Grow, ride, restore',
    instruction: 'Collect the two orbs straight ahead, then JUMP onto the diamond-marked pad. Ride through and keep moving until your tail clears. Both linked mouths must seal.',
    success: 'You collected the healing energy, carried it through the cube, and sealed both linked mouths. Growth became a resource you could spend.',
  },
  {
    id: 'body-route', practiceId: 'body-jump', cue: 'target', title: 'Cross your own route',
    instruction: 'Keep straight toward the body crossing. JUMP before you reach it, clear your tail, and land safely. A jump somewhere else does not count.',
    success: 'You crossed your own route and landed safely. The body limits your path, but a well-timed jump opens it again.',
  },
  {
    id: 'ring-route', practiceId: 'surround', cue: 'target', title: 'Close the loop',
    instruction: 'Follow the eight diamond-marked tiles around the hole. Turn left at each corner. Cover the whole ring at once to seal both linked mouths without depositing orbs.',
    success: 'Your body covered the ring and sealed the linked pair. You used the shape of your route to heal.',
  },
];
