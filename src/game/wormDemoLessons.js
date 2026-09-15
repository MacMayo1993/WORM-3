// One live task at a time. Completion comes from simulation outcomes, never taps
// on Next, and skipped exercises are not recorded as completed.
export const WORM_DEMO_LESSONS = [
  { id: 'steer', title: 'Find your direction', instruction: 'Swipe left or right, or use the arrow buttons. The worm keeps moving.', success: 'You are steering. Next, grow your worm.' },
  { id: 'orbs', title: 'Collect and grow', instruction: 'Follow the two glowing orbs. Each pickup adds three healing charges to your tail.', success: 'Two orbs give six charges. Tunnel healing costs four matching charges.' },
  { id: 'jump', title: 'Jump', instruction: 'Press JUMP, then land. Use jumps to clear your body and skip tunnel entrances.', success: 'A jump carries you over the surface. You can steer in the air.' },
  { id: 'double-jump', title: 'Jump again in the air', instruction: 'Press JUMP twice before you land to extend your flight.', success: 'Your second jump refreshed the arc. Landing restores both jumps.' },
  { id: 'boost', title: 'Burst of speed', instruction: 'Press Boost and feel the speed change. It recharges after the burst.', success: 'Boost is a timed burst. Watch the button for its recharge.' },
  { id: 'tunnel', title: 'Take a tunnel', instruction: 'Follow the marked entrance. With no matching orbs, you pass through but leave the tunnel open.', success: 'You emerged on the opposite face. The tunnel still needs healing charges.' },
  { id: 'heal', title: 'Heal on exit', instruction: 'This time you have six matching charges. Enter the tunnel and let your whole tail clear the exit.', success: 'Four charges sealed both ends. The remaining two stay with you.' },
  { id: 'surround', title: 'Surround to flip it back', instruction: 'Follow the eight marked tiles around the hole. Cover the whole ring with your body at once. Practice length is supplied.', success: 'Surrounding the entrance flips both tiles home without spending orbs.' },
  { id: 'rocket', title: 'Rocket flight', instruction: 'Collect the rocket orb ahead. Steer during the flight, then land.', success: 'Rocket flight protects you from body collisions and skips tunnel entrances.' },
  { id: 'magnet', title: 'Pull nearby orbs', instruction: 'Collect the magnet ahead, then pass near the glowing orbs to pull them in.', success: 'The magnet reaches two tiles away, including around cube edges.' },
  { id: 'water', title: 'Water momentum', instruction: 'Collect the blue droplet and keep a straight route to build speed. Turning sheds momentum.', success: 'Water adds up to 25% speed on a straight route.' },
  { id: 'fire', title: 'Leave a fire trail', instruction: 'Collect the flame orb and crawl across a few tiles to leave a hot route.', success: 'Hot tiles block blast damage on that route and burn bomb fuses faster.' },
  { id: 'grass', title: 'Grow a spring pad', instruction: 'Collect the green leaf, jump and land to grow a pad. Jump again from a green pad for a bigger leap.', success: 'You used a spring pad. Nature turns your landings into new launch points.' },
  { id: 'ice', title: 'Break out of a slide', instruction: 'Collect the snowflake. Ice delays grounded turns until the next tile; JUMP to regain immediate steering.', success: 'Jumping gives you control while the surface is slippery.' },
  { id: 'lightning', title: 'Ride the storm', instruction: 'Collect the purple lightning orb and keep crawling as the cube lights up.', success: 'Lightning transforms the cube with electrical veins and strikes.' },
  { id: 'signature', title: 'Your signature move', instruction: 'Press Beacon. Glow Worm reveals nearby pickups and reaches one tile farther. Every character has its own move.', success: 'Your signature has its own cooldown, separate from Boost.' },
  { id: 'bomb', title: 'Disarm a bomb', instruction: 'Surround the bomb using the marked ring before its fuse runs out. Your practice worm is already long enough.', success: 'A complete ring disarms the bomb. In real runs, keep clear of its blast lanes.' },
  { id: 'rotation', title: 'Watch the turning layer', instruction: 'Watch the lit layer and countdown. Keep your head and tail clear until the layer finishes turning.', success: 'You cleared the turning layer. You have finished WORM practice.' },
];
export { wormDemoActive, newWormDemo } from './wormDemoState.js';
export const wormDemoLesson = s => WORM_DEMO_LESSONS[s.demoWormLessonIndex ?? 0] ?? WORM_DEMO_LESSONS[0];
