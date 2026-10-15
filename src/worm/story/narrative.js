// Mobi's story, kept outside campaign.js so tuning a level never rewrites it.
// MOBI (Multi-Oriented Block Intelligence) is a ferry pilot from the Projective
// Plane, where every spot has a twin straight through the middle. Two clans of
// Singular-Oriented worms, the Ringfolk and the Longhaul, fought the Great Worm
// War (W³) over the Plane's doors, and the Healer Corps flew its ferries between
// them. On Mobi's last run a Longhaul worm lunged through one of the Flip Cube's
// doors, and the ship crash-landed here broken. Mobi is the only voice in the
// story: he explains it all to the player, the hatchling who grows long enough
// to heal the ship and bring the feud to an end.
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
      'We’re lost. This is my Flip Cube. It carried me out of the Projective Plane and through W³, the Great Worm War, then crash-landed here, broken.',
      'Its energy spilled everywhere. Eat it up and grow. You’re Singular-Oriented, so you face one way at a time. Big worms fix big problems anyway.',
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
      'In the Great Worm War that was true in the worst way, and I’ll explain why. For now, your body is lying across the route.',
      'Jump it, land clean, keep growing.',
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
      'During the war I ferried Healer Corps medics to the front. They traveled light and fast.',
      'Their gear is still in the hold: a speed burst, a second jump, a rocket, a magnet. Try everything. Land everything.',
    ],
    debrief: 'You’d have made the Healer Corps. Their motto was “Patch fast, land soft.” You did both.',
  },
  8: {
    briefing: [
      'Start with three kinds of Plane weather: water, fire and earth. Collect one of each.',
      'Water builds speed and fire leaves a hot trail. Earth is the green mountain: land to plant a spring pad, then jump from it.',
    ],
    debrief: 'Weather back in its jars. Well, in you. You’re a kind of jar.',
  },
  9: {
    briefing: [
      'Uh-oh. War leftovers. Rift crawlers from the Longhaul came aboard in the crash, and a bomb is still ticking.',
      'Grow long enough to wrap a door and it heals without a toll. Wrap a bomb and it fizzles. Bite back if something bites you.',
    ],
    debrief: 'Deck secure. Those crawlers weren’t strays, though. They were guarding something.',
  },
  10: {
    briefing: [
      'One more deck before the lower levels. Get long, heal the doors, clear out the guards.',
      'And partner? Look at the door hinges as you pass.',
    ],
    debrief: 'See the hinges? Bite marks. On the inside. Those crawlers chewed these doors open from inside the ship.',
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
      'Numbers view: every face holds every number once. It kept Corps medics from getting turned around.',
      'Earth can help you clear your tail. Collect the green mountain orb, land to grow a spring pad, then jump from the pad and land safely.',
    ],
    debrief: 'Spring planted, spring launched. That is Earth mastery: your last landing becomes your next launch point.',
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
      'The mint wind orb is Air. It carries jumps farther and higher. Jump with it and land safely; a rocket flight is a separate trick.',
    ],
    debrief: 'That landing! For a second I heard the old launch crew cheering. It was the gears. Still nice.',
  },
  18: {
    briefing: [
      'The explode orb pulls the whole ship apart for a while. Healers used it to slip between the pieces.',
      'The pieces separate, but twins stay connected. Keep crawling until it snaps back.',
    ],
    debrief: 'Pieces apart, twins together. Breaking the surface never broke the connections. Both clans forgot that in the war.',
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
    debrief: 'The routes were sealed from the inside, and they all point at the Core. Partner, somebody did that on purpose.',
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
    debrief: 'Ghost frame, real tunnels. When you rode through, something in the Core groaned like a yawn. Something huge, stuck in there, and bored.',
  },
  23: {
    briefing: [
      'Bricks? The Core remembers this deck as a toy. Funny thing to remember.',
      'Your tail is all over the bricks. Jump it.',
    ],
    debrief: 'Whatever is stuck in the Core is dreaming, partner. It dreams about toys. And tails.',
  },
  24: {
    briefing: [
      'The Healer Corps learned to mix weather. Fire, then water, makes Steam. Water, then fire, makes Quench.',
      'Same two elements, opposite order, different trick. Grab the first, then chase the partner before the timer runs out.',
    ],
    debrief: 'Steam and Quench, both by the book. The Corps alchemy is alive and well. Mostly well.',
  },
  25: {
    briefing: [
      'The far-side window shows each tile’s twin. Same place, other view.',
      'Heal the doors and keep an eye on that window. Tell me if anything in there… moves.',
    ],
    debrief: 'Did you see it? In the window, behind the Core. Something short and coiled, watching us like a spring. A Ringfolk, by the look of it.',
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
      'Don’t just grab the elements. Use them: build water’s speed, lay fire’s trail, spring off earth.',
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
    debrief: 'They fell back toward the middle. Crawlers only serve one master. The Longhaul’s, and I remember that now.',
  },
  30: {
    briefing: [
      'My last ferry run. I had wounded from both clans aboard, Longhaul and Ringfolk, which was my whole job.',
      'The Longhaul ambushed us at the Core’s door. A big one lunged through our door after the Ringfolk, and I slammed it shut. On its neck.',
      'Heal this deck. I need to see what’s left in the Core.',
    ],
    debrief: 'It’s still here, partner. The Longhaul’s longest body is wedged in our Core, head first. W³ didn’t end when the door closed. It came with us.',
  },

  // ── Chapter 4 · The Grand Crawl ──────────────────────────────────────────
  31: {
    briefing: [
      'Here’s the story of W³. The Longhaul grew so long that their longest body wrapped the whole Projective Plane.',
      'In the Plane, anything that long meets itself coming the other way, mirrored. Their longest tail came round the far side, and they didn’t know it was theirs.',
      'Singular-Oriented worms can’t tell a mirror image from a stranger. The Ringfolk saw a stranger on their side and bit it. That was the first bite of the war.',
    ],
    debrief: 'You’re getting long too. Don’t worry. When you meet your own tail, you’ll know it’s you. I’ll make sure.',
  },
  32: {
    briefing: [
      'Ten layers. The longest body is pushing on the Core, and every door here is bulging.',
      'Cross every pair before it pushes one wider.',
    ],
    debrief: 'All six crossed. When you rode through the Core, the Longhaul watched you. I felt them watching.',
  },
  33: {
    briefing: [
      'The pocket deck again, but now the Longhaul’s crawlers have their teeth in the gears. They bite every few seconds.',
      'Tiny deck. Fast turns. Big appetite. Yours, not theirs. Hopefully.',
    ],
    debrief: 'Every turn survived on a deck the size of a dice. You don’t scare easily, do you?',
  },
  34: {
    briefing: [
      'The repair bay’s big sister. The Longhaul’s crawlers reopen doors as fast as we close them.',
      'So close them faster.',
    ],
    debrief: 'Every door shut, and it didn’t reopen one. We’re winning a race they didn’t know they were in.',
  },
  35: {
    briefing: [
      'The Longhaul’s crawlers are all over this hollow deck, carrying pieces of the ship back to the Core.',
      'Ring the doors, defuse the bombs, and send the crawlers home empty.',
    ],
    debrief: 'Siege broken. The crawlers ran for the Core. They’ll be back with friends.',
  },
  36: {
    briefing: [
      'The Longhaul breathes weather through the Core. Ice and storm, on a deck with no stickers to hold on to.',
      'Grab the elements before they spread. They can’t breathe what you’ve already caught.',
    ],
    debrief: 'Four elements caught. The storm is calmer. Their breathing isn’t.',
  },
  37: {
    briefing: [
      'Ten layers of bricks. The Longhaul’s crawlers built themselves a wall. Let’s take it apart.',
      'Then fly over the rubble. The rocket is in the hold.',
    ],
    debrief: 'Wall’s down. Bricks are bricks again. I may have enjoyed that too much.',
  },
  38: {
    briefing: [
      'Numbers on this side, twins on the far side. The Longhaul can’t read either one. That’s our advantage.',
      'Heal every door before the gears catch you.',
    ],
    debrief: 'In the far-side window, the Ringfolk coil flinched every time a twin came home. They’re counting too.',
  },
  39: {
    briefing: [
      'The cargo deck. Fifteen layers. The biggest room on the ship.',
      'The Longhaul got huge by eating. We’re going to beat them at their own game. Eat everything. Grow enormous.',
    ],
    debrief: 'Look at you. Longest worm aboard. Well, second longest. We’ll fix that.',
  },
  40: {
    briefing: [
      'The Longhaul is pulling its longest body toward us through the doors. If it reconnects, the Flip Cube becomes part of it.',
      'Heal every door on this deck and its grip loosens. Use all six elements, including Earth’s spring pads and Air’s updraft jumps. Every trick you’ve got, partner.',
    ],
    debrief: 'It let go! For now. Its head is still in the Core, awake and hungry. And it remembers my name. It remembers me.',
  },

  // ── Chapter 5 · The Long Body ────────────────────────────────────────────
  41: {
    briefing: [
      'New plan. The Longhaul thinks long means strong. We’ll show them long can also mean kind.',
      'Step one is the long part. Eat.',
    ],
    debrief: 'Nine tiles long. You’re officially a large worm. I’m having a badge made. In my head.',
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
    debrief: 'You passed yourself in the Core and didn’t bite. The Longhaul never learned that. That’s the whole war, partner.',
  },
  44: {
    briefing: [
      'The longer you get, the more of you a gear can catch. The Longhaul counted on that.',
      'Keep your whole body off the lit layers.',
    ],
    debrief: 'Eight turns and not a segment lost. Long and careful. Rare combination.',
  },
  45: {
    briefing: [
      'Let’s mix it up. Heal the doors, and pass yourself in the Core while you’re at it.',
      'Every time you meet yourself in there, the Longhaul sees it happen.',
    ],
    debrief: 'Through and back, and polite about it. The far-side window went very still. The Ringfolk are thinking.',
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
    debrief: 'Every door healed, and you met yourself without a scratch. The Longhaul pushed on the Core the whole time. They’re curious, too.',
  },
  48: {
    briefing: [
      'Big bodies need big moves. Use water to build speed and fire to lay a trail.',
      'Then rocket over everything and magnet up the leftovers.',
    ],
    debrief: 'Water, fire, flight, magnet. A long worm with tricks. The Longhaul only ever had one trick: eat.',
  },
  49: {
    briefing: [
      'The Longhaul’s crawlers are back. A long body makes a great wall.',
      'Wrap the doors and the crawlers can’t reach them.',
    ],
    debrief: 'Doors ringed, crawlers sent home. You’re a wall now. A kind wall.',
  },
  50: {
    briefing: [
      'Partner, the Longhaul is trying to talk. Through the Core. To you.',
      'Heal this deck and pass yourself where they can see. Show them how a worm treats its own tail.',
    ],
    debrief: 'Their whole answer comes down to one word: mine. They think everything long is their tail. Including you.',
  },

  // ── Chapter 6 · Pocket Worlds ────────────────────────────────────────────
  51: {
    briefing: [
      'The Longhaul is retreating into the pocket decks, where a big worm can barely turn around.',
      'So turn around anyway. Grow big in a small place.',
    ],
    debrief: 'A well-fed worm on a two-by-two, with room left to turn. Small deck, good manners.',
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
    debrief: 'Over your tail and safely down. That knot came undone. We’ll call it a bow.',
  },
  54: {
    briefing: [
      'New trick. Heal two different doors within twenty seconds of surface time to earn a double heal. The countdown pauses inside tunnels.',
      'These doors heal for free when you ride them. Follow the countdown after the first repair; overlapping paid rides also count.',
    ],
    debrief: 'A double heal! Two doors, one body. The Longhaul can only bite one thing at a time. You can heal two.',
  },
  55: {
    briefing: [
      'Same trick, but now the doors want their toll. Carry both colors.',
      'Heal one, then another within twenty seconds of surface time. Tunnel rides pause the countdown.',
    ],
    debrief: 'Paid in full, healed in pairs. The pocket deck sounds quieter. The Longhaul is backing off.',
  },
  56: {
    briefing: [
      'The Longhaul’s crawlers jammed their teeth into the pocket gears. A layer turns every few seconds.',
      'On a two-by-two, every layer is half the world. Keep moving.',
    ],
    debrief: 'You outlasted the gears on the tiniest deck there is. If the Longhaul has a face, it’s making one.',
  },
  57: {
    briefing: [
      'The Longhaul is blowing weather into the small decks to flush us out.',
      'Catch the elements before they spread. In here, a storm has nowhere to go but onto you.',
    ],
    debrief: 'The elements are yours. The storm ran out of room before you did.',
  },
  58: {
    briefing: [
      'This is it. The tightest squeeze on the ship, all the food you can eat, and nowhere to put your tail.',
      'I believe in you. I also believe in jumping.',
    ],
    debrief: 'A good meal, a longer tail, and a route back out. That’s how a healer handles a tight squeeze.',
  },
  59: {
    briefing: [
      'When there’s no room on the ground, use the air. Rockets, boosts, double jumps.',
      'Land safely, gather your colors, and repair the doors between flights.',
    ],
    debrief: 'Air superiority, pocket edition. The crawlers are looking up now. Good. Up is where you aren’t.',
  },
  60: {
    briefing: [
      'Found it. The Longhaul’s hiding place is the smallest door on the ship. It leads straight into the Core.',
      'Gather your colors, watch the gears, and repair each door at your own pace.',
    ],
    debrief: 'The Longhaul came to the door to watch. You made room to grow and repaired every door they had torn open. Then they asked the question the whole war never answered: how?',
  },

  // ── Chapter 7 · Weather of War ───────────────────────────────────────────
  61: {
    briefing: [
      'The Longhaul doesn’t like questions. They’re throwing weather at us instead.',
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
      'The Longhaul set this deck on fire.',
      'So use water’s speed and lay fire’s trail. Fight fire with both.',
    ],
    debrief: 'You outran the fire and laid your own. Controlled burns. Very responsible.',
  },
  64: {
    briefing: [
      'All six kinds of Plane weather are loose on this deck: water, fire, earth, ice, lightning and air.',
      'Collect one of each. They can’t throw what we’re holding.',
    ],
    debrief: 'Six for six. The sky over the Core is clearing. I can almost see the Longhaul in it. They look surprised.',
  },
  65: {
    briefing: [
      'Lightning charges the doors on this deck.',
      'Ride through and meet yourself in the crackle.',
    ],
    debrief: 'Five doors, one hello, three storms bottled. The Longhaul tried to shock you mid-pass. They missed.',
  },
  66: {
    briefing: [
      'The old Corps lab is down here. Thirty combinations, if you count both orders.',
      'Brew a few, and at least two different kinds. Science!',
    ],
    debrief: 'Three brews, two kinds. I’ve written them down in my head, which is a block, which is very organized.',
  },
  67: {
    briefing: [
      'Storm and gears together. The Longhaul learned this combo in W³. It was their favorite.',
      'Use your elements on the move: water to outrun the turns, fire to mark your route, earth to spring clear.',
    ],
    debrief: 'Ten turns in a storm. They’re running out of favorite combos.',
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
      'The Longhaul’s lightning keeps hitting the doors. We’ll use that: a charged door costs less to heal.',
      'Master all six elements, heal every door, and double one up. Spring from Earth’s pads and land an Air jump as well as surviving the lightning.',
    ],
    debrief: 'Every door healed and every element mastered. You’re the storm now.',
  },
  70: {
    briefing: [
      'We’re in the eye of their storm. It’s quiet here. They’re listening.',
      'Show them what a healer does with weather.',
    ],
    debrief: 'The storm stopped. It just stopped. The Longhaul asked again: how? I told them: practice. They didn’t like that answer.',
  },

  // ── Chapter 8 · The War Machine ──────────────────────────────────────────
  71: {
    briefing: [
      'The Longhaul is driving the gears now. All of them. In W³ we called this the Grind.',
      'A long body on a grinding deck. Keep every segment off the light.',
      'Watch both warning bands: every third turn spins two separated layers in opposite directions. Keep your head and tail in the still layers.',
    ],
    debrief: 'Twelve turns, not a segment lost. The Grind didn’t grind you.',
  },
  72: {
    briefing: [
      'The Longhaul sealed these doors with blast plating.',
      'Blow the ship apart and slip between the pieces.',
    ],
    debrief: 'Three blasts, two flights, four doors healed. Open was the problem. Healed is the answer.',
  },
  73: {
    briefing: [
      'The Longhaul mined this deck. One bomb at a time. Ring each one with your body before the fuse burns down.',
      'Ring the doors too. You’re long enough now.',
    ],
    debrief: 'Four bombs fizzled. Bombs don’t scare a worm who can hug them.',
  },
  74: {
    briefing: [
      'The flight deck. Courier worms launched from here with rockets and magnets.',
      'Go fast, go high, and pull orbs from everywhere.',
    ],
    debrief: 'Three flights, eight catches. If the Longhaul has a flight deck, it’s jealous.',
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
      'The Fold was the Ringfolk’s signature move in the war: a turn that folds your own body back across your path.',
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
    debrief: 'A double, then another double. The Longhaul’s machine stuttered. It can’t keep up with healing in pairs.',
  },
  79: {
    briefing: [
      'The Longhaul’s crawlers planted bombs in the repair bay. Sabotage.',
      'Ring them, use your ability, and fly over the mess.',
    ],
    debrief: 'Repair bay saved. Again. I’m putting a lock on it. A big one. In my head.',
  },
  80: {
    briefing: [
      'This is the engine room. The Longhaul wired every gear, bomb and blast door into one machine.',
      'Heal every door and the machine has nothing left to turn.',
    ],
    debrief: 'The engine is quiet. The Flip Cube is ours again. Every deck except the Core.',
  },

  // ── Chapter 9 · Siege of the Core ────────────────────────────────────────
  81: {
    briefing: [
      'The Longhaul’s crawlers dug rifts all around the Core. They come out one at a time.',
      'Be ready, and don’t forget your own trick.',
    ],
    debrief: 'Four crawlers down. They aren’t fighting out of loyalty, you know. They’re scared of the longest body.',
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
    debrief: 'Sixteen tiles of wall. The crawlers stopped trying. One waved. I think it was a wave.',
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
      'Ring the doors, double up on heals, and defuse the bombs.',
    ],
    debrief: 'The bastion is ours. One door left between us and the longest body.',
  },
  90: {
    briefing: [
      'This is it: the first door into the Core. Every crawler the Longhaul has left is here.',
      'Heal the deck around it and the door opens. Then we see the longest body face to face. Faces to faces.',
    ],
    debrief: 'The door is open. The longest body isn’t attacking. Its head is staring at its own reflection on the far side, and it can’t stop shaking.',
  },

  // ── Chapter 10 · Mirror Decks ────────────────────────────────────────────
  91: {
    briefing: [
      'Inside the Core every deck is a mirror. Watch the far-side window: that’s you, from the other side.',
      'Pass yourself, and again. Let the Longhaul see you do it.',
    ],
    debrief: 'Twice you met yourself and smiled. Okay, worms don’t smile. You did the worm version.',
  },
  92: {
    briefing: [
      'Glass reflects everything. Grow huge here and there will be two of you to look at.',
    ],
    debrief: 'Fifteen tiles of worm, reflected. The Longhaul stared the whole time.',
  },
  93: {
    briefing: [
      'Numbers on this side, twins on the other, gears in between.',
      'The Longhaul is copying your moves now. Badly. Show them the right way.',
    ],
    debrief: 'Their longest body tried to pass itself in the Core. It flinched and bit the air. But it tried.',
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
    debrief: 'Three doubles. Pairs, pairs, pairs. The Longhaul counted along. They’re learning numbers.',
  },
  96: {
    briefing: [
      'A pocket mirror. A tiny deck, a few doors, a long worm.',
      'You’ll meet yourself constantly. Be polite every time.',
    ],
    debrief: 'A double heal in a three-by-three. You’re the most polite worm in the Plane.',
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
    debrief: 'Turns survived, tail cleared, and no echoes of you left behind. Clean.',
  },
  99: {
    briefing: [
      'The Longhaul’s last crawlers are panicking.',
      'Heal the doors in pairs, and don’t let them panic onto you.',
    ],
    debrief: 'Every crawler down, every door home. The longest body is alone with its reflection now.',
  },
  100: {
    briefing: [
      'This is the mirror at the center of the Core. The longest body is right behind it, watching its own tail.',
      'Pass yourself again and again. Heal in pairs. Show the Longhaul a worm that knows its own tail.',
    ],
    debrief: 'It looked at its tail, then at you, then at its tail again. Then the Longhaul worked it out: that tail was theirs. Partner, I think they get it.',
  },

  // ── Chapter 11 · The Mega Decks ──────────────────────────────────────────
  101: {
    briefing: [
      'The longest body understands now, but understanding isn’t healing. It is still stretched across the Plane, pulling at our doors.',
      'To hold its attention you need to be enormous. The cargo deck has all the food we need.',
    ],
    debrief: 'Eighteen tiles long. The Longhaul measured you. They looked impressed, which for the Longhaul is a hug.',
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
    debrief: 'Twelve turns on a ten-layer deck with seventeen tiles of worm. I’m running out of compliments. Here’s one: wow.',
  },
  104: {
    briefing: [
      'Remember the pocket deck? Let’s see if a giant fits.',
    ],
    debrief: 'A grown worm on a tiny deck, and you found your way through. That’s a healer.',
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
      'The Longhaul isn’t attacking anymore, but their weather is stuck on. A storm across a whole mega deck.',
      'Use all six elements and brew different fusions. Turn the storm into something useful.',
    ],
    debrief: 'The storm turned into rain, then into nothing, then into a rainbow. Is that a fusion? It should be.',
  },
  107: {
    briefing: [
      'Some of the Longhaul’s crawlers didn’t get the message. They’re dug in with the last artillery from the war.',
    ],
    debrief: 'Artillery silent. The Longhaul’s young worms asked whether a worm can learn to jump its own tail. I said we’d find out.',
  },
  108: {
    briefing: [
      'Your body is so long it’s in your way everywhere. Big jumps. Lots of them.',
    ],
    debrief: 'Ten clean jumps over nearly twenty tiles of worm. The longest body tried one. It got stuck. We’ll work on it.',
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
      'All hands on deck. Every deck. The Flip Cube is nearly whole, and the longest body is pulling hard one last time.',
      'Be bigger than its pull. Heal everything.',
    ],
    debrief: 'It stopped pulling. Its body went slack across the Plane. Partner, the Longhaul is asking us for help.',
  },

  // ── Chapter 12 · Through the Middle ──────────────────────────────────────
  111: {
    briefing: [
      'To let go, the longest body has to see its tail as its own. Out in the Plane, the twist makes that hard. In the Core it’s easy.',
      'So we’ll lead it through the middle. First, clear a path: every door, every gear.',
    ],
    debrief: 'Path cleared. The longest body is following you. Slowly. Like a puppy the size of a planet.',
  },
  112: {
    briefing: [
      'The pocket gears are the last thing still biting.',
      'Ride the doors, pass yourself, heal in pairs, and outlast the turns.',
    ],
    debrief: 'The pocket gears stopped. That was the last of the Longhaul’s teeth. Nothing is biting now. Not even the air.',
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
      'The Longhaul’s young worms want to learn to jump their own tails. Show them how. Again and again.',
    ],
    debrief: 'Twelve leaps. The first clean one cleared its own tail! Barely. The whole Longhaul made a sound like a happy earthquake.',
  },
  115: {
    briefing: [
      'To fly, the ship’s gears have to run in order again. That means turning every layer. With you on it.',
    ],
    debrief: 'Sixteen turns, all in order. The gears aren’t weapons anymore. Just gears. Lovely, boring gears.',
  },
  116: {
    briefing: [
      'The last bombs from the war are rolling around loose.',
      'Ring them, ring the doors, and heal in pairs.',
    ],
    debrief: 'Every bomb from the war is a dud now. The war is out of ammunition. It never needed much.',
  },
  117: {
    briefing: [
      'Some crawlers still think the war is on.',
      'Send them home. Gently, if they let you.',
    ],
    debrief: 'They didn’t let us. They’re home now anyway. The longest body says it will explain things to them.',
  },
  118: {
    briefing: [
      'Final rehearsal. The longest body will copy you exactly.',
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
      'This is it, partner. The longest body will follow you through the middle, head to tail, and meet itself in the Core.',
      'Heal every door, two at a time. When the last pair closes, its head and tail touch, and it will know they’re the same worm.',
      'Then the Flip Cube can fold us home. Ready? Me too. Both ways.',
    ],
    debrief: 'Its head met its tail, and it didn’t bite. It laughed. The Ringfolk, watching from the far-side window, didn’t bite either. The Great Worm War is over. The way home is open, and I’m not going anywhere without you. Wherever home turns out to be, we’ll get there through the middle.',
  },
};

export const storyNarrative = id => WORM_STORY_NARRATIVE[id] ?? null;
// The briefing as one paragraph, for the map and pause card.
export const storyBriefingText = id => storyNarrative(id)?.briefing.join(' ') ?? '';
// Mobi's launch dialogue: the story first, then the literal mission card.
export const storyLaunchLines = level => [...(storyNarrative(level.id)?.briefing ?? [level.subtitle].filter(Boolean)), level.goal];
