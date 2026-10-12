// Mobi's story, kept outside campaign.js so tuning a level never rewrites it.
// MOBI (Multi-Oriented Block Intelligence) is a ferry pilot from the Projective
// Plane, where every spot has a twin straight through the middle. His Flip Cube
// survived W³, the Great World Worm War, and crash-landed here broken; the
// World Worm's head came with it, trapped in the Core. The player is the
// hatchling who grows long enough to heal the ship and end the war.
//
// `briefing` is the story Mobi tells before play: each line is one dialogue card
// at launch (the mission card follows it), and the lines read together on the
// map and pause card. `debrief` is his note on the result card. Story lines
// never restate counts; objectives stay literal in goalText.js.
export const WORM_STORY_NARRATIVE = {
  // ── Chapter 1 · Crash Landing ────────────────────────────────────────────
  1: {
    briefing: [
      'Oh! You hatched! Hello, little worm. I’m Mobi: Multi-Oriented Block Intelligence. I face every way at once, which helps when you’re lost.',
      'We’re lost. This is my Flip Cube. It carried me out of the Projective Plane and through W³, the Great World Worm War. Then it crash-landed here.',
      'Its energy spilled everywhere. Eat it up and grow. Big worms fix big problems.',
    ],
    debrief: 'Look at you, all six colors and growing. The cube felt that. So did my stomach. I don’t have a stomach.',
  },
  2: {
    briefing: [
      'Every tile on this ship is a door. Its twin is straight through the middle, on the opposite face.',
      'The crash knocked doors open. Jump onto a raised one and you’ll ride through the Core and out of its twin.',
      'Let’s find out which passages still hold. Don’t worry. They mostly hold.',
    ],
    debrief: 'Five passages, five safe landings. You ride a tunnel like you were born in one. Technically, you were.',
  },
  3: {
    briefing: [
      'In the Plane we have a saying: a worm’s worst enemy is its own tail.',
      'During W³ that was true in the worst way. More on that later.',
      'For now your body is lying across the route. Jump it, land clean, keep growing.',
    ],
    debrief: 'Five clean jumps. Most worms in the war didn’t land so politely.',
  },
  4: {
    briefing: [
      'The ship’s layers still turn by themselves. The crash jammed the gears on.',
      'In the war a turning layer could cut a worm in half. Watch the warning light, then get off the layer.',
    ],
    debrief: 'Eight turns and you’re still in one piece. I’ll write that down. In my head. My head is a block.',
  },
  5: {
    briefing: [
      'Time for real repairs. Every open door has a twin, and they heal together.',
      'Carry the door’s color in, ride through, and let your whole tail clear the far side. Both tiles click home.',
    ],
    debrief: 'Four doors healed from both ends. In the Plane, fixing the far side fixes this side too. Same place, two views.',
  },
  6: {
    briefing: [
      'This is the navigation deck, and every door on it is open.',
      'Heal them all and the Flip Cube can find north again. Or whatever north is in a world with two of everything.',
    ],
    debrief: 'Navigation is back online. It’s pointing two ways at once. That’s normal. For me.',
  },
  7: {
    briefing: [
      'During W³ I ferried healer worms to the front. They traveled light and fast.',
      'Their gear is still in the hold: a speed burst, a second jump, a rocket, a magnet. Try everything. Land everything.',
    ],
    debrief: 'You’d have made the Healer Corps. Their motto was “Patch fast, land soft.” You did both.',
  },
  8: {
    briefing: [
      'The Plane has weather you can pick up and wear: water, fire, grass, ice and lightning.',
      'Some of it leaked out of the Core in the crash. Grab it before it fades.',
    ],
    debrief: 'Weather back in its jars. Well, in you. You’re a kind of jar.',
  },
  9: {
    briefing: [
      'Uh-oh. War leftovers. Rift crawlers came aboard with the crash, and a bomb is still ticking.',
      'Grow long enough to wrap a door and it heals without a toll. Wrap a bomb and it fizzles. Bite back if something bites you.',
    ],
    debrief: 'Deck secure. Those crawlers weren’t strays, though. They were guarding something.',
  },
  10: {
    briefing: [
      'One more deck before the lower levels. Get long, heal the doors, clear out the guards.',
      'And partner? Look at the door hinges as you pass.',
    ],
    debrief: 'See the hinges? Bite marks. On the inside. Something chewed these doors open from inside the ship.',
  },

  // ── Chapter 2 · Every Deck ───────────────────────────────────────────────
  11: {
    briefing: [
      'Fun fact: a Flip Cube folds. Every size, from pocket to mega, is a deck of the same ship.',
      'This is the pocket deck. Tiny. Cozy. Very easy to bump into yourself.',
    ],
    debrief: 'All six colors on a deck the size of a sugar cube. Your tail must be dizzy.',
  },
  12: {
    briefing: [
      'Grid view shows every tile’s address. Ferry pilots like me lived by these lines.',
      'Ride the old routes on this deck. If they still connect, my ferry run is in here somewhere.',
    ],
    debrief: 'The routes match my old ferry run. Same doors, same order. I used to fly this with my eyes closed. I don’t have eyelids.',
  },
  13: {
    briefing: [
      'Numbers view: every face holds every number once. It kept soldiers from getting turned around.',
      'Your tail keeps getting turned around. Jump it.',
    ],
    debrief: 'The numbers moved. Their order didn’t. Remember that. Doors move, but twins stay twins.',
  },
  14: {
    briefing: [
      'The glass deck. You can watch the gears turn inside. They still think it’s wartime.',
      'Every warning light is a gear about to bite. Watch them through the glass.',
    ],
    debrief: 'The gears repeat the same pattern. Somebody programmed them. Not me. Probably not me.',
  },
  15: {
    briefing: [
      'Chrome Works was the repair bay. During the war it was the only place a worm could get patched up.',
      'Bring every color home and heal its doors. We’re going to need this place.',
    ],
    debrief: 'Repair bay open. The tools are here. The mechanics aren’t. I hope they got out.',
  },
  16: {
    briefing: [
      'Seven layers deep. This deck held a whole sea once, folded up small.',
      'Its doors were twisted away from their twins. Heal every pair while the layers churn.',
    ],
    debrief: 'The sea deck is whole. Every door here was torn from the same side. The inside.',
  },
  17: {
    briefing: [
      'Launch Pad! I took off from here a thousand times. Courier worms rode rockets across broken decks.',
      'Build speed, take the air, and leave yourself room to land.',
    ],
    debrief: 'That landing! For a second I heard the old launch crew cheering. It was the gears. Still nice.',
  },
  18: {
    briefing: [
      'The explode orb pulls the whole ship apart for a while. Healers used it to slip between the pieces.',
      'The pieces separate, but twins stay connected. Keep crawling until it snaps back.',
    ],
    debrief: 'Pieces apart, twins together. Breaking the surface never broke the connections. The World Worm hated that.',
  },
  19: {
    briefing: [
      'Neon marked the ferry lanes into the big decks. Follow the lights and cross every pair.',
      'I want to see where these lanes lead now.',
    ],
    debrief: 'They all lead the same way. Inward. Toward the Core.',
  },
  20: {
    briefing: [
      'The summit deck, where every route meets. If anything is sealed inside this ship, it’s under here.',
      'Use everything you’ve learned. I’ll keep an eye on the Core. Both eyes. All my eyes.',
    ],
    debrief: 'The routes were sealed from the inside, and they all point at the Core. Partner, I don’t think we crashed alone.',
  },

  // ── Chapter 3 · Strange Views ────────────────────────────────────────────
  21: {
    briefing: [
      'We’re getting close to the Core. It bends the decks around it. This one is hollow.',
      'Every piece is an open frame. Don’t look down. There isn’t a down.',
    ],
    debrief: 'You crawled across nothing like it was something. Very brave. Very Plane.',
  },
  22: {
    briefing: [
      'No stickers here. Just edges and doors. This is what a Flip Cube looks like in a nightmare.',
      'The doors still work. Ride them before this deck forgets it has any.',
    ],
    debrief: 'Ghost frame, real tunnels. When you rode through, I heard something in the Core. Like a yawn.',
  },
  23: {
    briefing: [
      'Bricks? The Core is remembering this deck as a toy. Funny thing to remember.',
      'Your tail is all over the bricks. Jump it.',
    ],
    debrief: 'Whatever is in the Core is dreaming, partner. It dreams about toys. And tails.',
  },
  24: {
    briefing: [
      'The Healer Corps learned to mix weather. Water, then fire, makes Steam. Fire, then water, makes Quench.',
      'Same two elements, opposite order, different trick. Grab the first, then chase the partner before the timer runs out.',
    ],
    debrief: 'Steam and Quench, both by the book. The Corps alchemy is alive and well. Mostly well.',
  },
  25: {
    briefing: [
      'The far-side window shows each tile’s twin. Same place, other view.',
      'Heal the doors and keep an eye on that window. Tell me if anything in there… moves.',
    ],
    debrief: 'Did you see it? In the window, behind the Core. Something long. Something coiled.',
  },
  26: {
    briefing: [
      'This deck’s gears spin faster. Whatever is in the Core is awake now, I think.',
      'Keep moving. Gears can’t cut what they can’t catch.',
    ],
    debrief: 'The gears speed up the closer we get to the middle. That isn’t a coincidence.',
  },
  27: {
    briefing: [
      'The Core is leaking weather. A storm is forming in the neon.',
      'Don’t just grab the elements. Use them: build water’s speed, lay fire’s trail, spring off grass.',
    ],
    debrief: 'A healer who uses the weather instead of fearing it. That’s rare.',
  },
  28: {
    briefing: [
      'The glass deck again. Blow it apart, then fly over the pieces. Ferry pilots called this taking the shortcut.',
      'Nobody else called it that. They called it “please stop.”',
    ],
    debrief: 'Shattered and whole again. I took that shortcut on my last ferry run, right before the crash. I’m starting to remember.',
  },
  29: {
    briefing: [
      'More rift crawlers. They’re guarding the way to the Core. Somebody gave them orders.',
      'Surround a door, use your ability, disarm the bombs, and push through.',
    ],
    debrief: 'They fell back toward the middle. Crawlers only serve one master. And now I remember its name.',
  },
  30: {
    briefing: [
      'My last ferry run. The World Worm was chasing us. A worm so long it wrapped around the whole Plane.',
      'It lunged through one of our doors to catch the Flip Cube. I slammed the door shut. On its neck.',
      'Heal this deck. I need to see what’s left in the Core.',
    ],
    debrief: 'It’s still here, partner. The World Worm’s head is in our Core. W³ didn’t end. It came with us.',
  },

  // ── Chapter 4 · The Grand Crawl ──────────────────────────────────────────
  31: {
    briefing: [
      'Here’s the story of W³. The World Worm grew so long it wrapped the whole Projective Plane.',
      'In the Plane, anything that long meets itself coming the other way, mirrored. The World Worm didn’t recognize its own tail.',
      'It thought its tail was an invader, and it attacked. That was the war.',
    ],
    debrief: 'You’re getting long too. Don’t worry. When you meet your own tail, you’ll know it’s you. I’ll make sure.',
  },
  32: {
    briefing: [
      'Ten layers. The World Worm’s head is pushing on the Core, and every door here is bulging.',
      'Cross every pair before it pushes one wider.',
    ],
    debrief: 'All six crossed. When you rode through the Core, it watched you. I felt it watching.',
  },
  33: {
    briefing: [
      'The pocket deck again, but now the World Worm has its teeth in the gears. They bite every few seconds.',
      'Tiny deck. Fast turns. Big appetite. Yours, not its. Hopefully.',
    ],
    debrief: 'Ten turns on a deck the size of a dice. You don’t scare easily, do you?',
  },
  34: {
    briefing: [
      'The repair bay’s big sister. The World Worm reopens doors as fast as we close them.',
      'So close them faster.',
    ],
    debrief: 'Every door shut, and it didn’t reopen one. We’re winning a race it didn’t know it was in.',
  },
  35: {
    briefing: [
      'Its crawlers are all over this hollow deck, carrying pieces of the ship back to the Core.',
      'Ring the doors, defuse the bombs, and send the crawlers home empty.',
    ],
    debrief: 'Siege broken. The crawlers ran for the Core. They’ll be back with friends.',
  },
  36: {
    briefing: [
      'The World Worm breathes weather through the Core. Ice and storm, on a deck with no stickers to hold on to.',
      'Grab the elements before they spread. It can’t breathe what you’ve already caught.',
    ],
    debrief: 'Four elements caught. The storm is calmer. Its breathing isn’t.',
  },
  37: {
    briefing: [
      'Ten layers of bricks. The World Worm built itself a wall. Let’s take it apart.',
      'Then fly over the rubble. The rocket is in the hold.',
    ],
    debrief: 'Wall’s down. Bricks are bricks again. I may have enjoyed that too much.',
  },
  38: {
    briefing: [
      'Numbers on this side, twins on the far side. The World Worm can’t read either one. That’s our advantage.',
      'Heal every door before the gears catch you.',
    ],
    debrief: 'In the far-side window, the coil flinched every time a twin came home.',
  },
  39: {
    briefing: [
      'The cargo deck. Fifteen layers. The biggest room on the ship.',
      'The World Worm got huge by eating. We’re going to beat it at its own game. Eat everything. Grow enormous.',
    ],
    debrief: 'Look at you. Longest worm aboard. Well, second longest. We’ll fix that.',
  },
  40: {
    briefing: [
      'The World Worm is pulling its body toward us through the doors. If it reconnects, the Flip Cube becomes part of it.',
      'Heal every door on this deck and it loses its grip. Every trick you’ve got, partner. All of them.',
    ],
    debrief: 'It let go! For now. Its head is still in the Core, awake and hungry. And it heard my name. It remembered me.',
  },

  // ── Chapter 5 · The Long Body ────────────────────────────────────────────
  41: {
    briefing: [
      'New plan. The World Worm thinks long means strong. We’ll show it long can also mean kind.',
      'Step one is the long part. Eat.',
    ],
    debrief: 'A hundred segments. You’re officially a large worm. I’m having a badge made. In my head.',
  },
  42: {
    briefing: [
      'A long body means more tail in the way. Corps healers drilled this until they could jump in their sleep.',
      'You’re awake, so it should be easier.',
    ],
    debrief: 'Five clean jumps over a long body. Your tail trusts you now. That matters for what comes next.',
  },
  43: {
    briefing: [
      'Here’s the oldest healer trick. Ride a tunnel, and while your tail is still inside, dive into another. Or the same one, from its far end.',
      'Your head and your tail pass each other in the Core. You’ll see yourself, mirrored.',
      'Say hello. Don’t bite.',
    ],
    debrief: 'You passed yourself in the Core and didn’t bite. The World Worm never learned that. That’s the whole war, partner.',
  },
  44: {
    briefing: [
      'The longer you get, the more of you a gear can catch. The World Worm counted on that.',
      'Keep your whole body off the lit layers.',
    ],
    debrief: 'Eight turns and not a segment lost. Long and careful. Rare combination.',
  },
  45: {
    briefing: [
      'Let’s mix it up. Heal the doors, and pass yourself in the Core while you’re at it.',
      'Every time you meet yourself in there, the World Worm sees it happen.',
    ],
    debrief: 'Through and back, and polite about it. The coil in the Core went very still. I think it’s thinking.',
  },
  46: {
    briefing: [
      'The Corps ran courier drills with full-grown worms. Heavy bodies, light feet.',
      'Boost, double-jump, clear your own tail. Long and quick.',
    ],
    debrief: 'Heavy courier, certified. That isn’t a real certificate. I’ll make you one.',
  },
  47: {
    briefing: [
      'A small deck, a long worm, and gears. You’ll be crossing your own path a lot.',
      'Use the Core. It’s the only spot on the ship that is its own twin, so it’s where you meet yourself.',
    ],
    debrief: 'Every door healed, and you met yourself without a scratch. The World Worm pushed on the Core the whole time. It’s curious.',
  },
  48: {
    briefing: [
      'Big bodies need big moves. Use water to build speed and fire to lay a trail.',
      'Then rocket over everything and magnet up the leftovers.',
    ],
    debrief: 'Water, fire, flight, magnet. A long worm with tricks. The World Worm only ever had one trick: eat.',
  },
  49: {
    briefing: [
      'The crawlers are back. A long body makes a great wall.',
      'Wrap the doors and the crawlers can’t reach them.',
    ],
    debrief: 'Doors ringed, crawlers sent home. You’re a wall now. A kind wall.',
  },
  50: {
    briefing: [
      'Partner, the World Worm is trying to talk. Through the Core. To you.',
      'Heal this deck and pass yourself where it can see. Show it how a worm treats its own tail.',
    ],
    debrief: 'It spoke. One word: “MINE.” It thinks everything long is its tail. Including you.',
  },

  // ── Chapter 6 · Pocket Worlds ────────────────────────────────────────────
  51: {
    briefing: [
      'It’s retreating into the pocket decks, where a big worm can barely turn around.',
      'So turn around anyway. Grow big in a small place.',
    ],
    debrief: 'Eighty segments on a two-by-two. You’re basically a cube now. A worm-flavored cube.',
  },
  52: {
    briefing: [
      'Three by three, and the gears are biting. There’s barely room for you and the warning lights.',
      'Keep moving and keep your tail tidy.',
    ],
    debrief: 'No room, no problem. You’re wearing this deck like a scarf.',
  },
  53: {
    briefing: [
      'When there’s no room to go around, go over. The Corps called it knotting.',
      'Your body will be everywhere. Jump it, double-jump it, and don’t tie yourself in an actual knot.',
    ],
    debrief: 'Six jumps, zero knots. Well, one knot. It came undone. We’ll call it a bow.',
  },
  54: {
    briefing: [
      'New trick. If your head rides one door while your tail is still in another, both doors heal back to back.',
      'Two at once. These doors heal for free when you ride them, so practice the timing.',
    ],
    debrief: 'A double heal! Two doors, one body. The World Worm can only bite one thing at a time. You can heal two.',
  },
  55: {
    briefing: [
      'Same trick, but now the doors want their toll. Carry both colors.',
      'Ride one, then the other, before your tail clears the first.',
    ],
    debrief: 'Paid in full, healed in pairs. The pocket deck sounds quieter. The World Worm is backing off.',
  },
  56: {
    briefing: [
      'The World Worm jammed its teeth into the pocket gears. A layer turns every few seconds.',
      'On a two-by-two, every layer is half the world. Keep moving.',
    ],
    debrief: 'Ten turns on the tiniest deck there is. If the World Worm has a face, it’s making one.',
  },
  57: {
    briefing: [
      'It’s blowing weather into the small decks to flush us out.',
      'Catch the elements before they spread. In here, a storm has nowhere to go but onto you.',
    ],
    debrief: 'Four elements caught in a four-by-four. The storm ran out of room before you did.',
  },
  58: {
    briefing: [
      'This is it. The tightest squeeze on the ship, all the food you can eat, and nowhere to put your tail.',
      'I believe in you. I also believe in jumping.',
    ],
    debrief: 'A hundred and sixty segments on a three-by-three. That isn’t a worm on a cube anymore. It’s a cube in a worm.',
  },
  59: {
    briefing: [
      'When there’s no room on the ground, use the air. Rockets, boosts, double jumps.',
      'And sneak a double heal in while you’re up there.',
    ],
    debrief: 'Air superiority, pocket edition. The crawlers are looking up now. Good. Up is where you aren’t.',
  },
  60: {
    briefing: [
      'Found it. The World Worm’s hiding place is the smallest door on the ship. It leads straight into the Core.',
      'Heal every door around it, two at a time, and pass yourself right under its nose.',
    ],
    debrief: 'It came to the door to watch. It saw a long worm meet itself and heal two doors at once. Then it said a second word: “HOW?”',
  },

  // ── Chapter 7 · Weather of War ───────────────────────────────────────────
  61: {
    briefing: [
      'It doesn’t like questions. It’s throwing weather at us instead.',
      'Grab two elements back to back and they fuse. The order changes the result. Let’s see what you can brew.',
    ],
    debrief: 'Your first fusion of the storm. The Corps used to say: every storm is just ingredients.',
  },
  62: {
    briefing: [
      'The Corps ran its ferries on Steam: water first, then fire.',
      'Make it twice, then flip the recipe for Quench: fire first, then water.',
    ],
    debrief: 'Engines warm, firebreaks laid. You’re a better alchemist than I was. I once made soup out of lightning.',
  },
  63: {
    briefing: [
      'The World Worm set this deck on fire.',
      'So use water’s speed and lay fire’s trail. Fight fire with both.',
    ],
    debrief: 'You outran the fire and laid your own. Controlled burns. Very responsible.',
  },
  64: {
    briefing: [
      'All five kinds of Plane weather are loose on this deck: water, fire, grass, ice and lightning.',
      'Collect one of each. It can’t throw what we’re holding.',
    ],
    debrief: 'Five for five. The sky over the Core is clearing. I can almost see the World Worm’s eyes. There are a lot of them.',
  },
  65: {
    briefing: [
      'Lightning charges the doors on this deck.',
      'Ride through and meet yourself in the crackle.',
    ],
    debrief: 'Five doors, one hello, three storms bottled. It tried to shock you mid-pass. It missed.',
  },
  66: {
    briefing: [
      'The old Corps lab is down here. Twenty recipes, if you count both orders.',
      'Brew a few, and at least two different kinds. Science!',
    ],
    debrief: 'Three brews, two kinds. I’ve written them down in my head, which is a block, which is very organized.',
  },
  67: {
    briefing: [
      'Storm and gears together. The World Worm learned this combo in W³. It was its favorite.',
      'Use your elements on the move: water to outrun the turns, fire to mark your route, grass to spring clear.',
    ],
    debrief: 'Ten turns in a storm. It’s running out of favorite combos.',
  },
  68: {
    briefing: [
      'Ice deck. Grounded turns slide, but a jump steers.',
      'Your tail will be everywhere. Use the weather and clear your body.',
    ],
    debrief: 'Six jumps on ice without a single wipeout. I’d clap if I had hands.',
  },
  69: {
    briefing: [
      'Its lightning keeps hitting the doors. We’ll use that: a charged door costs less to heal.',
      'Master every element, heal every door, and double one up.',
    ],
    debrief: 'Every door healed and every element mastered. You’re the storm now.',
  },
  70: {
    briefing: [
      'We’re in the eye of its storm. It’s quiet here. It’s listening.',
      'Show it what a healer does with weather.',
    ],
    debrief: 'The storm stopped. It just stopped. It asked again: “HOW?” I told it: “Practice.” It didn’t like that answer.',
  },

  // ── Chapter 8 · The War Machine ──────────────────────────────────────────
  71: {
    briefing: [
      'It’s driving the gears now. All of them. In W³ we called this the Grind.',
      'A long body on a grinding deck. Keep every segment off the light.',
    ],
    debrief: 'Twelve turns, not a segment lost. The Grind didn’t grind you.',
  },
  72: {
    briefing: [
      'It sealed these doors with blast plating.',
      'Blow the ship apart and slip between the pieces.',
    ],
    debrief: 'Three blasts, two flights, four doors healed. Open was the problem. Healed is the answer.',
  },
  73: {
    briefing: [
      'It mined this deck. One bomb at a time. Ring each one with your body before the fuse burns down.',
      'Ring the doors too. You’re long enough now.',
    ],
    debrief: 'Four bombs fizzled. Bombs don’t scare a worm who can hug them.',
  },
  74: {
    briefing: [
      'The flight deck. Courier worms launched from here with rockets and magnets.',
      'Go fast, go high, and pull orbs from everywhere.',
    ],
    debrief: 'Three flights, eight catches. If the World Worm has a flight deck, it’s jealous.',
  },
  75: {
    briefing: [
      'Gears on every side. The only safe place is the Core.',
      'And you’re the only one who can meet yourself in there.',
    ],
    debrief: 'Every door healed under fire, and you hid in the Core with yourself twice. Smart.',
  },
  76: {
    briefing: [
      'The Fold was its signature move in the war: a turn that folds your own body back across your path.',
      'So jump yourself. A lot.',
    ],
    debrief: 'Eight jumps through the Fold. It can’t fold a worm who’s always in the air.',
  },
  77: {
    briefing: [
      'Bombs, blasts and crawlers. Shrapnel everywhere.',
      'Ten layers of trouble. Keep your head down and your tail long.',
    ],
    debrief: 'Shrapnel cleared. Ten layers of quiet. For about a minute.',
  },
  78: {
    briefing: [
      'When one door heals, the next is easier. Chain them.',
      'Two at once, then two at once again.',
    ],
    debrief: 'A double, then another double. The machine stuttered. It can’t keep up with healing in pairs.',
  },
  79: {
    briefing: [
      'Its crawlers planted bombs in the repair bay. Sabotage.',
      'Ring them, use your ability, and fly over the mess.',
    ],
    debrief: 'Repair bay saved. Again. I’m putting a lock on it. A big one. In my head.',
  },
  80: {
    briefing: [
      'This is the engine room. The World Worm wired every gear, bomb and blast door into one machine.',
      'Heal every door and the machine has nothing left to turn.',
    ],
    debrief: 'The engine is quiet. The Flip Cube is ours again. Every deck except the Core.',
  },

  // ── Chapter 9 · Siege of the Core ────────────────────────────────────────
  81: {
    briefing: [
      'The crawlers dug rifts all around the Core. They come out one at a time.',
      'Be ready, and don’t forget your own trick.',
    ],
    debrief: 'Four crawlers down. They aren’t fighting for the World Worm, you know. They’re scared of it.',
  },
  82: {
    briefing: [
      'Hold this deck. Heal every door while the gears turn and the crawlers probe.',
    ],
    debrief: 'Line held. Doors healed. You make it look easy. It isn’t easy. I checked.',
  },
  83: {
    briefing: [
      'Wrap three doors with your body. Fire’s trail keeps blasts off you; water keeps you quick.',
      'The bombs will try to break the ring. Don’t let them.',
    ],
    debrief: 'Three rings, three bombs. You’re a hoop of fire. Kindly fire.',
  },
  84: {
    briefing: [
      'Grow into a wall around the Core. The crawlers can’t get through a worm that long.',
    ],
    debrief: 'A hundred and eighty segments of wall. The crawlers stopped trying. One waved. I think it was a wave.',
  },
  85: {
    briefing: [
      'The trenches run through the doors. Ride them all.',
      'Meet yourself in the Core and heal them two at a time. Mind the crawlers in the trenches.',
    ],
    debrief: 'Six doors, three hellos, two doubles. The Core rumbled every time you passed.',
  },
  86: {
    briefing: [
      'They breached the outer decks. Crawlers and bombs everywhere.',
      'Push them back.',
    ],
    debrief: 'Breach sealed. The crawlers fell back into the Core itself. It’s crowded in there.',
  },
  87: {
    briefing: [
      'We need an engine of our own. Blast the deck apart, fly the gaps, and pull every orb in with a magnet.',
    ],
    debrief: 'Siege engine built and running. I named it Partner Two. It doesn’t know.',
  },
  88: {
    briefing: [
      'Crawlers on a tight deck, and your tail is everywhere.',
      'Jump over yourself, and fight when they show.',
    ],
    debrief: 'Eight jumps, three down. You fight like the Corps. Mostly upside down.',
  },
  89: {
    briefing: [
      'The last bastion before the Core.',
      'Ring the doors, double up your heals, and defuse the bombs.',
    ],
    debrief: 'The bastion is ours. One door left between us and the World Worm’s head.',
  },
  90: {
    briefing: [
      'This is it: the first door into the Core. Every crawler it has left is here.',
      'Heal the deck around it and the door opens. Then we see the World Worm face to face. Faces to faces.',
    ],
    debrief: 'The door is open. It isn’t attacking. Its head is staring at its own reflection on the far side, and it can’t stop shaking.',
  },

  // ── Chapter 10 · Mirror Decks ────────────────────────────────────────────
  91: {
    briefing: [
      'Inside the Core every deck is a mirror. Watch the far-side window: that’s you, from the other side.',
      'Pass yourself, and again. Let it see you do it.',
    ],
    debrief: 'Twice you met yourself and smiled. Okay, worms don’t smile. You did the worm version.',
  },
  92: {
    briefing: [
      'Glass reflects everything. Grow huge here and there will be two of you to look at.',
    ],
    debrief: 'A hundred and seventy segments, reflected. The World Worm stared the whole time.',
  },
  93: {
    briefing: [
      'Numbers on this side, twins on the other, gears in between.',
      'The World Worm is copying your moves now. Badly. Show it the right way.',
    ],
    debrief: 'It tried to pass itself in the Core. It flinched and bit the air. But it tried.',
  },
  94: {
    briefing: [
      'A wireframe deck. Your body is the only solid thing in here.',
      'Jump it. Lots.',
    ],
    debrief: 'Eight jumps over a ghost deck. Your head and your tail are on very good terms.',
  },
  95: {
    briefing: [
      'The hall of mirrors. Every door has a reflection, and both need healing.',
      'Heal in pairs. Ring the stubborn ones.',
    ],
    debrief: 'Three doubles. Pairs, pairs, pairs. The World Worm counted along. It’s learning numbers.',
  },
  96: {
    briefing: [
      'A pocket mirror. A tiny deck, a few doors, a long worm.',
      'You’ll meet yourself constantly. Be polite every time.',
    ],
    debrief: 'Two doubles in a three-by-three. You’re the most polite worm in the Plane.',
  },
  97: {
    briefing: [
      'Blow the mirror deck apart and the inside shows on the outside.',
      'Mix your weather while it’s open. Different recipes, please.',
    ],
    debrief: 'Three different brews on an inside-out deck. I’m not sure which way is up. Then again, I never am.',
  },
  98: {
    briefing: [
      'Every turn echoes in here. A small deck, a long worm, and your tail in the way.',
    ],
    debrief: 'Twelve turns, four jumps, and no echoes of you left behind. Clean.',
  },
  99: {
    briefing: [
      'Its last crawlers are panicking.',
      'Heal the doors in pairs, and don’t let them panic onto you.',
    ],
    debrief: 'Every crawler down, every door home. The World Worm is alone with its reflection now.',
  },
  100: {
    briefing: [
      'This is the mirror at the center of the Core. The World Worm is right behind it, watching its own tail.',
      'Pass yourself again and again. Heal in pairs. Show it a worm that knows its own tail.',
    ],
    debrief: 'It looked at its tail, then at you, then at its tail again. Then it whispered: “Mine… is me?” Partner, I think it gets it.',
  },

  // ── Chapter 11 · The Mega Decks ──────────────────────────────────────────
  101: {
    briefing: [
      'It understands now, but understanding isn’t healing. Its body is still stretched across the Plane, pulling at our doors.',
      'To hold its attention you need to be enormous. The cargo deck has all the food we need.',
    ],
    debrief: 'Two hundred segments. The World Worm measured you. It looked impressed. It has a lot of faces to look impressed with.',
  },
  102: {
    briefing: [
      'Ten layers, six doors. Ride them all the long way round, and pass yourself on every lap.',
    ],
    debrief: 'Six doors, four hellos, two doubles. Every time you passed yourself, its pull on our doors loosened.',
  },
  103: {
    briefing: [
      'Big decks have big gears. A huge body and nowhere to hide but everywhere.',
    ],
    debrief: 'Twelve turns on a ten-layer deck with a hundred and ninety segments. I’m running out of compliments. Here’s one: wow.',
  },
  104: {
    briefing: [
      'Remember the pocket deck? Let’s see if a giant fits.',
    ],
    debrief: 'Almost half the deck was worm, and you never bit it. If that isn’t a healer, nothing is.',
  },
  105: {
    briefing: [
      'The freight deck has every door torn open.',
      'Magnet up the energy and heal them in pairs.',
    ],
    debrief: 'Freight deck whole. The hull is humming. That’s the sound of a ship that wants to fly.',
  },
  106: {
    briefing: [
      'It isn’t attacking anymore, but its weather is stuck on. A storm across a whole mega deck.',
      'Use all five elements and brew different fusions. Turn the storm into something useful.',
    ],
    debrief: 'The storm turned into rain, then into nothing, then into a rainbow. Is that a fusion? It should be.',
  },
  107: {
    briefing: [
      'Some of its crawlers didn’t get the message. They’re dug in with the last artillery from the war.',
    ],
    debrief: 'Artillery silent. The crawlers surrendered to the World Worm, and it told them to go home. They don’t have one either.',
  },
  108: {
    briefing: [
      'Your body is so long it’s in your way everywhere. Big jumps. Lots of them.',
    ],
    debrief: 'Ten clean jumps over two hundred twenty segments. The World Worm tried one. It got stuck. We’ll work on it.',
  },
  109: {
    briefing: [
      'The last holdouts barricaded the observation deck.',
      'Ring the doors, defuse the bombs, and clear the rifts.',
    ],
    debrief: 'Observation deck clear. From up here you can see the whole Flip Cube. Almost whole.',
  },
  110: {
    briefing: [
      'All hands on deck. Every deck. The Flip Cube is nearly whole, and the World Worm’s body is pulling hard one last time.',
      'Be bigger than its pull. Heal everything.',
    ],
    debrief: 'It stopped pulling. Its body went slack across the Plane. Partner, the World Worm is asking us for help.',
  },

  // ── Chapter 12 · Through the Middle ──────────────────────────────────────
  111: {
    briefing: [
      'To let go, it has to see its tail as itself. Out in the Plane, the twist makes that hard. In the Core it’s easy.',
      'So we’ll lead it through the middle. First, clear a path: every door, every gear.',
    ],
    debrief: 'Path cleared. The World Worm’s head is following you. Slowly. Like a puppy the size of a planet.',
  },
  112: {
    briefing: [
      'The pocket gears are the last thing still biting.',
      'Ride the doors, pass yourself, heal in pairs, and outlast the turns.',
    ],
    debrief: 'The pocket gears stopped. That was the last of its teeth. It isn’t biting anything now. Not even the air.',
  },
  113: {
    briefing: [
      'Folding the Flip Cube home takes a lot of power, and the Corps furnace runs on fusions.',
      'Steam, Quench, and as many other recipes as you can brew. Fire it up.',
    ],
    debrief: 'Furnace roaring. The ship is warm for the first time since the crash.',
  },
  114: {
    briefing: [
      'The World Worm wants to learn to jump its own tail. Show it how. Again and again.',
    ],
    debrief: 'Twelve leaps. It tried one, and it cleared its tail! Barely. It made a sound like a happy earthquake.',
  },
  115: {
    briefing: [
      'To fly, the ship’s gears have to run in order again. That means turning every layer. With you on it.',
    ],
    debrief: 'Sixteen turns, all in order. The gears aren’t weapons anymore. Just gears. Lovely, boring gears.',
  },
  116: {
    briefing: [
      'The last bombs from W³ are rolling around loose.',
      'Ring them, ring the doors, and heal in pairs.',
    ],
    debrief: 'Every bomb from W³ is a dud now. The war is out of ammunition. It never needed much.',
  },
  117: {
    briefing: [
      'Some crawlers still think the war is on.',
      'Send them home. Gently, if they let you.',
    ],
    debrief: 'They didn’t let us. They’re home now anyway. The World Worm said it would explain things to them.',
  },
  118: {
    briefing: [
      'Final rehearsal. The World Worm will copy you exactly.',
      'Pass yourself, heal in pairs, bring every color home.',
    ],
    debrief: 'It matched you move for move. It passed itself in the Core without biting, for the first time since the war began.',
  },
  119: {
    briefing: [
      'Tomorrow we fold home. Tonight, one last full repair.',
      'Every system, every door, every trick.',
    ],
    debrief: 'Everything works. I checked twice: once from each side. That’s how we do it in the Plane.',
  },
  120: {
    briefing: [
      'This is it, partner. The World Worm will follow you through the middle, head to tail, and meet itself in the Core.',
      'Heal every door, two at a time. When the last pair closes, its head and tail touch, and it will know they’re the same worm.',
      'Then the Flip Cube can fold us home. Ready? Me too. Both ways.',
    ],
    debrief: 'Its head met its tail, and it didn’t bite. It laughed. The Great World Worm War is over. The way home is open, and I’m not going anywhere without you. Wherever home turns out to be, we’ll get there through the middle.',
  },
};

export const storyNarrative = id => WORM_STORY_NARRATIVE[id] ?? null;
// The briefing as one paragraph, for the map and pause card.
export const storyBriefingText = id => storyNarrative(id)?.briefing.join(' ') ?? '';
// Mobi's launch dialogue: the story first, then the literal mission card.
export const storyLaunchLines = level => [...(storyNarrative(level.id)?.briefing ?? [level.subtitle].filter(Boolean)), level.goal];
