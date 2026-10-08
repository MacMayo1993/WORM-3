import * as THREE from 'three';

// Shared low-poly craft models: +Y is outward, -Z is the direction of travel.
// Dimensions are in bead radii. Geometry is built only on equipment changes.
//
// Every part names a finish, so a piece reads as what it is made of rather
// than as one felt: enamel buttons and bottle caps gloss, thimbles and keys
// are metal, spools are wood, paper is paper. buildCraftModel merges parts by
// colour and finish, so each piece stays within a handful of draw calls.
//
// Readability is part of the design, not a finishing pass. A piece rides on a
// bead that is only a few dozen pixels across, over any of fifteen skins and a
// dozen scenes, so every model here follows four rules:
//   - big: each piece stands well proud of the bead it is worn on;
//   - bold: saturated craft colours, with a light and a dark in every piece, so
//     it separates from green, pink or purple skins alike (a leaf is autumn
//     orange, not green, because it lives on a green worm);
//   - lit: every opaque finish carries a small emissive floor (see `glow`), so
//     a piece never goes muddy in a dark scene;
//   - moving: pieces that would move in the world do (`rig`), driven by the
//     same pause-aware clock as the face.
// buildCraftModel adds the ink outline (see wormAccessories.js), which is what
// keeps a cream hat or a pink bow legible against a pale background.
const FINISH = {
  cloth: { roughness: 0.93, metalness: 0, glow: 0.2 },
  paper: { roughness: 0.82, metalness: 0, glow: 0.22 },
  wood: { roughness: 0.6, metalness: 0, glow: 0.18 },
  leaf: { roughness: 0.55, metalness: 0, glow: 0.2 },
  gloss: { roughness: 0.26, metalness: 0, glow: 0.14 },
  metal: { roughness: 0.3, metalness: 0.6, glow: 0.3 },
  glass: { roughness: 0.08, metalness: 0, transparent: true, opacity: 0.32, depthWrite: false }
};

// The craft palette: warm, saturated, and deliberately not the worm's greens.
export const CRAFT = {
  cream: '#fff1d6',
  ink: '#3b2a2a',
  red: '#e8452c',
  orange: '#ff8f2e',
  gold: '#ffc83d',
  brass: '#f0b93a',
  leaf: '#6fc24c',
  leafDark: '#2f8a3e',
  teal: '#1fb5ad',
  blue: '#2f6fd0',
  navy: '#26407f',
  pink: '#ff6f9f',
  plum: '#8a4fc7',
  wood: '#d29a58',
  woodDark: '#7a4c26',
  autumn: '#e2582b',
  autumnDark: '#a8341a'
};

// The head's face frame in accessory space (see wormFaceLayout.js): the eyes
// sit at ±EYE_X, and a lens centred on an eye stands a little out along the
// face direction, tilted by FACE_TILT to face the way the face does.
const EYE_X = 0.37;
const LENS_Y = 0.84;
const LENS_Z = -0.76;
const FACE_TILT = 0.665;

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _y = new THREE.Vector3(0, 1, 0);

export function getHandmadeParts(id, s = 1) {
  const parts = [];
  // Named groups of parts that move on their own: pivot, then per-axis spin
  // (rad/s) and sway (rad), see animateCraftModel.
  const rigs = {};
  Object.defineProperty(parts, 'rigs', { value: rigs });
  const { cream, ink, red, orange, gold, brass, leaf, leafDark, teal, blue, pink, plum, wood, woodDark, autumn, autumnDark } = CRAFT;
  const add = (geo, args, pos, color, rot, scale, role, finish = 'cloth') => {
    const { glow, ...surface } = FINISH[finish];
    const mat = { color, ...surface, ...(glow && { emissive: color, emissiveIntensity: glow }) };
    parts.push({ geo: [geo, args], pos: pos.map(v => v * s), mat, rot, scale, role });
    return parts[parts.length - 1];
  };
  // Segment counts follow the part's size: a stitch or a crimp never needs the
  // 140 vertices of a bowl, and previews draw dozens of these at once.
  const ball = (r, p, c, scale, rot, finish) => add('sphere', [r*s, r < .16 ? 8 : r < .4 ? 10 : 14, r < .16 ? 6 : r < .4 ? 7 : 10], p, c, rot, scale, undefined, finish);
  const box = (d, p, c, rot, finish) => add('box', d.map(v => v*s), p, c, rot, undefined, undefined, finish);
  const cyl = (r1, r2, h, p, c, rot, finish) => add('cylinder', [r1*s,r2*s,h*s,Math.max(r1,r2) < .16 ? 8 : Math.max(r1,r2) < .5 ? 12 : 16],p,c,rot,undefined,undefined,finish);
  const ring = (r,t,p,c,rot,role,finish,arc=Math.PI*2) => add('torus',[r*s,t*s,t < .08 ? 5 : 7,r < .4 ? 14 : 22,arc],p,c,rot,undefined,role,finish);
  // A closed curved slab wrapped over a bead (see craftGeometry.js), for the
  // pieces of a garment that runs the length of the body.
  const arch = (radius, thickness, length, arc, c, finish) => add('arch', [radius*s, thickness*s, length*s, arc, 10], [0,0,0], c, undefined, undefined, undefined, finish);
  // A round rod from one point to another (temple arms, cords).
  const rod = (from, to, r, c, finish) => {
    _a.fromArray(from); _b.fromArray(to);
    const length = _a.distanceTo(_b);
    _q.setFromUnitVectors(_y, _b.clone().sub(_a).normalize());
    _e.setFromQuaternion(_q);
    return add('cylinder', [r*s, r*s, length*s, 8], _a.add(_b).multiplyScalar(0.5).toArray(), c, [_e.x, _e.y, _e.z], undefined, undefined, finish);
  };
  // Scale everything `fn` adds by k about `anchor`, so a bag or a key can grow
  // to read at thumbnail size while the strap holding it keeps hugging the bead.
  const grow = (k, anchor, fn) => {
    const start = parts.length;
    fn();
    for (let i = start; i < parts.length; i++) {
      const p = parts[i];
      p.pos = p.pos.map((v, j) => anchor[j] * s + (v - anchor[j] * s) * k);
      p.scale = (p.scale || [1, 1, 1]).map(v => v * k);
    }
  };
  // Turn everything `fn` adds by the Euler angles `rot` about `pivot`.
  const turn = (rot, pivot, fn) => {
    const start = parts.length;
    fn();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot));
    for (let i = start; i < parts.length; i++) {
      const p = parts[i];
      _a.fromArray(p.pos).sub(_b.fromArray(pivot).multiplyScalar(s)).applyQuaternion(q).add(_b);
      p.pos = _a.toArray();
      _e.setFromQuaternion(_q.setFromEuler(_e.set(...(p.rot || [0, 0, 0]))).premultiply(q));
      p.rot = [_e.x, _e.y, _e.z];
    }
  };
  // Everything `fn` adds moves about `pivot` (in final coordinates, so call it
  // outside any grow/turn that would shift the pivot). `motion` is
  // { spin: [x,y,z] rad/s, sway: [x,y,z] rad, freq, phase }.
  const rig = (name, pivot, motion, fn) => {
    const start = parts.length;
    fn();
    for (let i = start; i < parts.length; i++) parts[i].rig = name;
    rigs[name] = { pivot: pivot.map(v => v * s), ...motion };
  };
  const tag = (role) => { parts[parts.length - 1].role = role; };
  // A garment that runs the length of the body (cape, quilt, button trail) is
  // modelled as the piece that wraps ONE segment; the rig lays one per body
  // segment, so it grows with the worm. `cover` describes how the run behaves:
  // `gap` is the bead spacing the piece was drawn for (in bead radii), `stretch`
  // (default on) lengthens a piece over a wider gap, which a button must not, `taper`
  // narrows the last `tail` segments down to `min`, and `ripple` is the pitch
  // wave that travels down it. `pick` says which pieces carry a part: 'all'
  // (default), 'first', 'last', or 'n:c' for every n-th piece from c.
  const cover = (meta) => Object.defineProperty(parts, 'cover', { value: meta });
  // Pieces that differ only by colour share one hull: the last part added is
  // outlined once, for the pieces in `selector`, or (null) not at all.
  const outlineAs = (selector) => {
    const part = parts[parts.length - 1];
    if (selector) part.hullSel = selector; else part.noOutline = true;
  };
  const noOutline = () => { parts[parts.length - 1].noOutline = true; };
  const pick = (selector, fn) => {
    const start = parts.length;
    fn();
    for (let i = start; i < parts.length; i++) parts[i].sel = selector;
  };
  const stitches = (x,y,z,n=5,axis='x') => {
    for(let i=0;i<n;i++) box([0.05,0.07,0.12], [x+(axis==='x'?i*.16:0),y,z+(axis==='z'?i*.16:0)],cream,[0,.3,-.2]);
  };
  // A big, soft bow: two fat loops, a knot and two tails.
  const bow = (y,z,color=pink,knot=cream) => {
    ball(.42,[-.42,y,z],color,[1.1,.8,.55],[0,0,-.22]);
    ball(.42,[.42,y+.04,z],color,[1.1,.8,.55],[0,0,.22]);
    ball(.2,[0,y,z-.04],knot,[.9,1,.9]);
    box([.24,.6,.1],[-.2,y-.36,z+.04],color,[0,0,-.3]);
    box([.22,.5,.1],[.22,y-.3,z+.04],color,[0,0,.38]);
    for (const [dx, dy] of [[-.58, .06], [-.4, -.16], [.42, .1], [.6, -.08]]) ball(.07, [dx, y + dy, z - .1], cream);
  };
  // A daisy lying flat (petals around +Y): long petals radiating from a
  // contrasting heart, in two rings so it reads as a flower, not a plate.
  const daisy = (x,y,z,r=.5,petal=cream,heart=gold,inner=petal) => {
    for(let ring=0;ring<2;ring++) {
      const count = ring ? 7 : 10, reach = ring ? .46 : .64;
      for(let i=0;i<count;i++) {
        const a=(i+ring*.5)*Math.PI*2/count;
        ball(r*(ring?.4:.5),[x+Math.cos(a)*r*reach,y+ring*.05*r,z+Math.sin(a)*r*reach],ring?inner:petal,[1,.22,.46],[0,-a,0]);
      }
    }
    ball(r*.34,[x,y+.1*r,z],heart,[1,.62,1]);
  };
  // A pair of lenses centred on the eyes, with a clear pane in each.
  const lenses = (radius, tube, colors, finish, tint = '#bfeeff') => {
    for (const side of [-1, 1]) {
      const x = side * EYE_X;
      ring(radius, tube, [x, LENS_Y, LENS_Z], colors[side < 0 ? 0 : 1], [FACE_TILT, 0, 0], undefined, finish);
      add('cylinder', [radius*s, radius*s, 0.02*s, 20], [x, LENS_Y, LENS_Z], tint, [FACE_TILT - Math.PI / 2, 0, 0], undefined, undefined, 'glass');
    }
  };

  if(id==='daisy') {
    // A leaf pad under a great white daisy, tilted up at the camera.
    ball(1.02,[0,.84,0],leaf,[1.05,.2,.92],[0,.3,.1],'leaf');
    turn([-.28,0,.08],[0,1,0],()=>daisy(0,1.12,0,1.05,'#ffffff',gold,'#ffe3ef'));
  } else if(id==='thimble') {
    // A brass thimble with a red enamel rim: warm metal that pops on any skin.
    cyl(.74,.98,1.12,[0,1.2,0],brass,[0,0,-.08],'metal');
    ball(.74,[-.04,1.78,0],brass,[1,.62,1],undefined,'metal');
    ring(.99,.13,[.05,.68,0],red,[Math.PI/2,0,0],undefined,'gloss');
    for(let row=0;row<3;row++) for(let i=0;i<10;i++) {
      const a=(i+row*.5)*Math.PI/5,r=.85-row*.07;
      ball(.065,[Math.cos(a)*r, .92+row*.27, Math.sin(a)*r],'#9a5f12',undefined,undefined,'metal');
    }
    for(let i=0;i<6;i++) { const a=i*Math.PI/3+.3; ball(.065,[Math.cos(a)*.38-.04,1.98,Math.sin(a)*.38],'#9a5f12',undefined,undefined,'metal'); }
  } else if(id==='leafBeret') {
    // A fallen maple leaf, not a green one: it has to read on a green worm.
    grow(1.15,[0,.9,0],()=>{
    ball(1.04,[.12,.95,0],autumn,[1.2,.3,.95],[0,0,-.12],'leaf');
    for(const side of [-1,1]) ball(.52,[.1,1.0,side*.62],autumnDark,[1.1,.24,.58],[side*.45,0,-.12],'leaf');
    cyl(.07,.09,.4,[.18,1.36,0],woodDark,[0,0,-.5],'leaf');
    box([1.5,.05,.07],[.1,1.2,0],gold,[0,.2,-.08]);
    for(const side of [-1,1])for(let i=0;i<3;i++)box([.46,.04,.06],[-.35+i*.4,1.17,side*.2], gold,[0,side*.65,0]);
    });
  } else if(id==='bottlecapGlasses') {
    // Two crimped bottle caps for rims, joined by a bridge, with arms back over the ears.
    lenses(.31, .12, [red, blue], 'gloss');
    for (const side of [-1, 1]) {
      const color = side < 0 ? red : blue;
      // Chrome liner inside each cap, crimped teeth round the rim.
      ring(.22, .035, [side * EYE_X, LENS_Y, LENS_Z], '#eef3f5', [FACE_TILT, 0, 0], undefined, 'metal');
      for (let i = 0; i < 14; i++) {
        const a = i * Math.PI / 7, c = Math.cos(a) * .45, v = Math.sin(a) * .45;
        ball(.08, [side * EYE_X + c, LENS_Y + v * Math.cos(FACE_TILT), LENS_Z + v * Math.sin(FACE_TILT)], color, undefined, undefined, 'gloss');
      }
      rod([side * (EYE_X + .42), LENS_Y + .02, LENS_Z + .1], [side * 1.0, .56, .12], .06, ink, 'gloss');
    }
    rod([-.14, LENS_Y + .04, LENS_Z - .06], [.14, LENS_Y + .04, LENS_Z - .06], .07, brass, 'metal');
  } else if(id==='yarnMustache') {
    // A big handlebar of dark wool under the nose, above the smile, tips curled
    // up, with lighter strands wound across it so it reads as yarn.
    const yarn = '#4a2c1d', strand = '#8a5a3a';
    // Each tuft rests on the face's own curve, so it hugs the cheeks instead of floating off them.
    const onFace = (x, y) => -Math.sqrt(Math.max(.05, 1 - x * x - y * y)) - .12;
    for(const side of [-1,1]) for(let i=0;i<5;i++) {
      const x = side*(.07+i*.14), y = .5 + i*i*.0095;
      ball(.22,[x,y,onFace(x,y)],yarn,[1,.66,.62],[.4,0,side*.2*i]);
      ball(.06,[x,y+.08,onFace(x,y)-.1],strand,[1,.4,.7],[.4,0,0]);
    }
    ball(.15,[0,.51,onFace(0,.51)],yarn,[1.3,.9,.9],[.4,0,0]);
  } else if(id==='daisyCollar') {
    // A thick leafy ring, crowded with big daisies facing out around the top.
    ring(1,.12,[0,0,1.05],leaf,undefined,undefined,'leaf');
    const tints = [['#ffffff',gold],[pink,gold],['#ffe27a','#d2691e'],['#ffffff',gold],[pink,gold]];
    for(let i=0;i<5;i++) {
      const a=Math.PI*(.12+i*.19), [petal,heart]=tints[i];
      turn([0,0,a-Math.PI/2],[Math.cos(a)*.98,Math.sin(a)*.98,1.05],()=>daisy(Math.cos(a)*.98,Math.sin(a)*.98,1.05,.52,petal,heart));
    }
  } else if(id==='knittedScarf') {
    // Fat red wool with cream stripes and a fluttering tail.
    ring(.98,.2,[0,0,1.0],red);
    for(let i=0;i<9;i++) { const a=i*Math.PI*2/9; ring(.2,.05,[Math.cos(a)*.98,Math.sin(a)*.98,1.0],cream,[0,Math.PI/2,a]); }
    ball(.3,[.6,.76,1.2],red,[1,1,1.1]);
    rig('tail',[.62,.82,1.3],{ sway:[.16,0,.1], freq:3.1 },()=>{
      box([.5,.16,.95],[.64,.84,1.65],red,[0,-.15,-.1]);
      for(let i=0;i<4;i++)box([.52,.06,.12],[.66+i*.014,.92,1.35+i*.2],cream,[0,-.15,-.1]);
      for(let i=0;i<5;i++)cyl(.04,.04,.24,[.47+i*.07,.84,2.2],red,[Math.PI/2,0,0]);
    });
  } else if(id==='spoolBackpack') {
    ring(1,.07,[0,0,0],woodDark);
    grow(1.55, [0,1,0], () => {
      cyl(.45,.45,.8,[0,1.17,0],teal,[0,0,Math.PI/2]);
      for(const side of [-1,1])cyl(.62,.62,.12,[side*.46,1.17,0],wood,[0,0,Math.PI/2],'wood');
      for(let i=0;i<7;i++)ring(.46,.03,[-.3+i*.1,1.17,0],cream,[0,Math.PI/2,0]);
      cyl(.08,.08,1.0,[0,1.17,0],wood,[0,0,Math.PI/2],'wood');
    });
  } else if(id==='matchboxBackpack') {
    ring(1,.07,[0,0,0],woodDark);
    grow(1.55, [0,1,0], () => {
      box([.85,.5,.92],[0,1.1,0],red,[0,0,-.08],'paper');
      box([.7,.04,.72],[0,1.36,0],cream,[0,0,-.08],'paper');
      box([.5,.045,.14],[0,1.39,0],ink,[0,-.08,0],'paper');
      box([.07,.26,.74],[.44,1.1,0],ink,undefined,'paper');
      // A few matches stand out of the box, red-headed.
      for(let i=0;i<5;i++) {
        const x=-.3+i*.15, z=.28-(i%2)*.18;
        cyl(.03,.03,.5,[x,1.52,z],wood,[0,0,(i-2)*.07],'wood');
        ball(.08,[x+(i-2)*.016,1.8,z],i%2?orange:red,[1,1.2,1],undefined,'gloss');
      }
    });
  } else if(id==='buttonTrail') {
    // A button sewn on every other segment, alternating teal and coral, down the
    // whole back: the trail gets longer as the worm does.
    cover({ gap: .86, stretch: false, taper: null, ripple: { pitch: .05, freq: 3.4, wave: .5 } });
    [[0, teal], [2, '#ff7a59']].forEach(([c, color], i) => pick(`4:${c}`, () => {
      cyl(.62,.62,.18,[0,1.04,0],color,undefined,'gloss');
      // Both colours stand on the same body, so one hull (on the first) serves both.
      outlineAs(i ? null : '2:0');
    }));
    pick('2:0', () => {
      ring(.5,.06,[0,1.14,0],'#fff6e4',[Math.PI/2,0,0],undefined,'gloss');
      noOutline();
      for(const x of [-.14,.14])for(const z of [-.14,.14])ball(.07,[x,1.16,z],ink,[1,.3,1]);
      box([.04,.03,.4],[0,1.17,0],'#fff6e4',[0,.78,0]);
      box([.04,.03,.4],[0,1.17,0],'#fff6e4',[0,-.78,0]);
    });
  } else if(id==='leafCape') {
    // An autumn cloak that runs down the back, one overlapping leaf scale per body
    // segment, so it lengthens as the worm grows and narrows to a point at the tail.
    cover({ gap: .86, taper: { tail: 6, min: .42 }, ripple: { pitch: .04, freq: 3.1, wave: .55 } });
    // Alternate pieces ride a hair higher, so where they overlap the upper one always wins (no z-fighting).
    [[0, autumn], [1, '#f0852f']].forEach(([c, color], i) => pick(`2:${c}`, () => { arch(1.1 + c * .07,.12,1.34,2.55,color,'leaf'); outlineAs(i ? null : 'all'); }));
    pick('all', () => { box([.08,.07,1.2],[0,1.25,0],gold); noOutline(); });
    pick('first', () => { ring(1.0,.07,[0,0,0],woodDark); ball(.22,[0,1.0,-.6],gold,undefined,undefined,'metal'); });
  } else if(id==='fireflyJar') {
    // Wire cage round a clear jar, a warm glow and emissive fireflies that
    // circle inside it: no extra lights.
    ring(1,.07,[0,0,0],woodDark);
    grow(1.45, [.55,1,0], () => {
      for(const y of [.9,1.65])ring(.42,.05,[.55,y,0],blue,[Math.PI/2,0,0],undefined,'metal');
      for(let i=0;i<6;i++){const a=i*Math.PI/3;cyl(.03,.03,.75,[.55+Math.cos(a)*.42,1.27,Math.sin(a)*.42],blue,undefined,'metal');}
      cyl(.39,.39,.74,[.55,1.27,0],'#d8f6ff',undefined,'glass');
      cyl(.46,.46,.12,[.55,1.72,0],wood,undefined,'wood');
      ring(.24,.045,[.55,1.98,0],woodDark);
      add('sphere',[.36*s,16,12],[.55,1.27,0],'#fff3a0',undefined,[1,1.05,1],'glowball','glass');
      parts[parts.length-1].mat={color:'#fff3a0',roughness:1,metalness:0,transparent:true,opacity:.5,depthWrite:false,emissive:'#ffe45c',emissiveIntensity:1.7};
    });
    rig('flies',[.55,1.5,0],{ spin:[0,1.4,0], freq:1 },()=>grow(1.45,[.55,1,0],()=>{
      [[.35,1.1,.14],[.76,1.42,-.1],[.5,1.52,.1],[.64,1.24,.16]].forEach(([x,y,z],i)=>{
        ball(.15,[x,y,z],'#e8ff4a');
        parts[parts.length-1].mat={color:'#e8ff4a',roughness:.4,metalness:0,emissive:'#d6ff2e',emissiveIntensity:1.4};
        parts[parts.length-1].role=`firefly${i%2}`;
        ball(.1,[x+.09,y+.05,z],cream,[1,.25,.55]);
      });
    }));
  } else if(id==='windupKey') {
    // A big brass clockwork key standing up from the tail like a wind-up toy's,
    // its butterfly bow turning flat-on to the camera above and behind.
    cyl(.15,.19,.34,[0,.92,.25],brass,undefined,'metal');
    rig('key',[0,1.4,.25],{ spin:[0,2.4,0], freq:1 },()=>{
      cyl(.1,.1,.95,[0,1.5,.25],brass,undefined,'metal');
      for(const side of [-1,1]) {
        ring(.5,.13,[side*.62,2.02,.25],gold,[Math.PI/2,0,0],undefined,'metal');
        tag('wing');
      }
      box([.5,.22,.3],[0,2.02,.25],brass,undefined,'metal');
      ball(.17,[0,2.26,.25],brass,undefined,undefined,'metal');
    });
    for(const p of parts) if(p.role==='wing') p.scale=[1,1.3,1];
  } else if(id==='paperPinwheel') {
    // A tall stick and a big four-colour pinwheel, spinning in the worm's wake.
    cyl(.1,.1,1.9,[0,1.0,.4],wood,undefined,'wood');
    rig('blades',[0,2.1,.4],{ spin:[0,0,5.5], freq:1 },()=>{
      const colors=[red,gold,blue,teal];
      for(let i=0;i<4;i++) {
        const a=i*Math.PI/2;
        add('cone',[.85*s,1.8*s,3],[Math.cos(a)*.75,2.1+Math.sin(a)*.75,.4],colors[i],[0,0,a-.6],[1,1,.16],undefined,'paper');
      }
      ball(.26,[0,2.1,.24],brass,undefined,undefined,'gloss');
    });
  } else if(id==='toadstool') {
    cyl(.62,.74,.34,[0,.84,0],cream);
    add('sphere',[1.26*s,24,12,0,Math.PI*2,0,Math.PI/2],[.08,1.0,0],'#d9382f',[0,0,-.12],[1,.7,1],undefined,'gloss');
    ring(1.2,.06,[.08,1.01,0],cream,[Math.PI/2,0,-.12]);
    for(const [x,z,r] of [[-.58,.32,.24],[.48,.56,.2],[.58,-.4,.26],[-.42,-.6,.16],[.02,.03,.25]]) {
      const y=1+.7*Math.sqrt(Math.max(0,1.5876-x*x-z*z));
      ball(r,[x+.08,y,z],cream,[1,.2,1]);
    }
  } else if(id==='acorn') {
    grow(1.1,[0,.8,0],()=>{
      add('sphere',[1.04*s,20,10,0,Math.PI*2,0,Math.PI/2],[0,.8,0],'#b8763a',undefined,[1,.62,1],undefined,'wood');
      ring(1,.1,[0,.82,0],'#5a3a1e',[Math.PI/2,0,0],undefined,'wood');
      for(let j=0;j<2;j++) for(let i=0;i<10;i++) {
        const a=(i+j*.5)*Math.PI/5,r=.9-j*.24;
        ball(.14,[Math.cos(a)*r,1.06+j*.23,Math.sin(a)*r],'#e0a45e',[1,.38,1],undefined,'wood');
      }
      cyl(.1,.14,.46,[.06,1.54,0],'#5a3a1e',[0,0,-.3],'wood');
    });
  } else if(id==='paperboat') {
    // A folded boat: a blue V hull with pointed ends and a white stripe, a red
    // sail standing up from the middle, and a gold pennant.
    grow(1.05,[0,.8,0],()=>{
      for(const side of [-1,1]) {
        box([2.1,.52,.11],[0,.98,side*.3],blue,[side*.5,0,0],'paper');
        box([2.12,.07,.12],[0,1.12,side*.37],'#ffffff',[side*.5,0,0],'paper');
        add('cone',[.32*s,.7*s,4],[side*1.28,.95,0],blue,[0,0,-side*Math.PI/2],[1,1,.55],undefined,'paper');
      }
      add('cone',[1.05*s,1.45*s,3],[0,1.78,0],red,[0,Math.PI/2,0],[1,1,.26],undefined,'paper');
      cyl(.03,.03,.5,[0,2.62,0],ink);
      box([.4,.22,.04],[.2,2.74,0],gold,[0,0,-.1]);
    });
  } else if(id==='sprout') {
    // A seedling cracked from a seed: two bright leaves nodding on a stem.
    grow(1.35,[0,.9,0],()=>{
      ball(.46,[0,.9,0],woodDark,[1,.5,.9]);
      cyl(.09,.11,.9,[0,1.3,0],leafDark,[0,0,-.1],'leaf');
    });
    rig('leaves',[0,2.0,0],{ sway:[.05,0,.14], freq:2.6 },()=>grow(1.35,[0,.9,0],()=>{
      ball(.52,[-.36,1.74,0],leaf,[1.3,.24,.7],[0,0,-.34],'leaf');
      ball(.48,[.38,1.88,0],'#a6e063',[1.3,.24,.7],[0,0,.4],'leaf');
      box([.62,.03,.035],[-.32,1.82,0],cream,[0,0,-.34]);
      box([.55,.03,.035],[.34,1.96,0],cream,[0,0,.4]);
    }));
  } else if(id==='buttonGoggles') {
    // Big brass-rimmed button lenses on a thick leather band round the head.
    lenses(.32, .11, ['#e0a030', '#2fb0b8'], 'gloss', '#c9f3ff');
    for (const side of [-1, 1]) for (const x of [-.14, .14]) ball(.05, [side * EYE_X + x, LENS_Y + .2, LENS_Z + .16], cream, undefined, undefined, 'gloss');
    rod([-.14, LENS_Y + .04, LENS_Z - .04], [.14, LENS_Y + .04, LENS_Z - .04], .07, brass, 'metal');
    ring(1.0, .08, [0, .16, .12], '#7a4a28', [-0.905, 0, 0], undefined, undefined, Math.PI);
    for (const side of [-1, 1]) box([.2, .26, .14], [side * .98, .24, .2], brass, [0, 0, 0], 'metal');
  } else if(id==='patchworkBandana') {
    // A red neckerchief with white dots and a patchwork flap over the back.
    ring(.96,.11,[0,.0,0],red);
    for(let i=0;i<12;i++){const a=i*Math.PI/6; ball(.07,[Math.cos(a)*1.02,Math.sin(a)*1.02,.2],cream);}
    box([.74,.44,.1],[-.26,.74,-.74],blue,[.6,0,.2]);
    box([.58,.5,.1],[.32,.66,-.78],gold,[.6,0,-.2]);
    add('cone',[.54*s,.64*s,3],[0,.34,-.94],plum,[Math.PI,0,0],[1,1,.26]);
    stitches(-.4,.88,-.66,5);
    ball(.2,[.9,.52,.18],cream);
  } else if(id==='crookedBow') {
    // Tied on top of the collar and laid back, so it faces up at the camera
    // as a bow rather than standing behind the head like a pair of ears.
    ring(.98,.08,[0,0,0],cream);
    turn([-0.62, 0, 0.12], [0,.9,-.76], () => bow(.86,-.76,red,gold));
  } else if(id==='seedSatchel') {
    ring(1.02,.07,[0,0,0],woodDark);
    grow(1.55, [.8,1,0], () => {
      ball(.66,[.9,.92,.12],'#d9a05b',[.82,1,.6]);
      box([.68,.32,.12],[.9,1.24,-.26],leaf,[.18,0,-.08]);
      ball(.1,[.9,1.17,-.38],gold);
      stitches(.62,.98,-.3,4);
      ball(.3,[.72,1.54,.12],'#9ee06a',[.4,1,.2],[0,0,-.3],'leaf');
      ball(.26,[1.02,1.5,.1],leaf,[.4,1,.2],[0,0,.4],'leaf');
      cyl(.03,.03,.5,[.68,1.3,.12],leafDark,undefined,'leaf');
    });
  } else if(id==='friendshipBeads') {
    ring(1.03,.05,[0,0,0],cream);
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/4;
      ball(.3,[Math.cos(a)*1.05,Math.sin(a)*1.05,0],['#e8452c','#2fb0b8','#ffc83d','#8a4fc7'][i%4],undefined,undefined,'gloss');
      tag(`bead${i%2}`);
    }
    grow(1.7, [0,1.06,0], () => {
      box([.3,.3,.12],[0,1.06,-.07],cream,[0,0,.15],'gloss');
      box([.13,.05,.03],[0,1.06,-.14],ink);
      ball(.06,[0,1.06,-.17],red);
    });
  } else if(id==='quiltPatches') {
    // A patchwork quilt over the back: one stitched patch per body segment, cycling
    // red, gold, teal and plum, so the quilt grows with the worm.
    cover({ gap: .86, taper: { tail: 4, min: .55 }, ripple: { pitch: .035, freq: 3.0, wave: .45 } });
    [red, gold, teal, plum].forEach((color, c) => pick(`4:${c}`, () => { arch(1.1 + (c % 2) * .04,.12,.98,2.2,color); outlineAs(c ? null : 'all'); }));
    pick('all', () => {
      for(const z of [-.42,.42]) for(const phi of [-.62,-.21,.21,.62]) {
        box([.14,.05,.07],[1.18*Math.sin(phi),1.18*Math.cos(phi),z],cream,[0,0,-phi]);
      }
      ball(.15,[0,1.2,0],cream,[1,.55,1],undefined,'gloss');
    });
  } else if(id==='ribbonTail') {
    ring(.8,.09,[0,0,.1],cream);
    // Knot to the back, where the camera following the worm sees it.
    rig('bow',[0,.6,.42],{ sway:[.14,0,.09], freq:3.4 },()=>grow(2.2, [0,.6,.42], () => turn([0, Math.PI, 0], [0,.6,.42], () => bow(.6,.42,pink,red))));
  } else if(id==='paintbrushTail') {
    grow(2.1, [0,.2,.5], () => {
      cyl(.25,.2,.9,[0,.2,.5],blue,[Math.PI/2,0,0],'gloss');
      cyl(.28,.25,.38,[0,.2,1.02],brass,[Math.PI/2,0,0],'metal');
      for(let i=0;i<5;i++) {
        const x=(i-2)*.09;
        ball(.2,[x,.2,1.4+(i%2)*.05],'#735744',[.4,.8,1.8]);
        ball(.17,[x,.2,1.65+(i%2)*.05],pink,[.44,.82,1.1],undefined,'gloss');
        tag('paint');
      }
    });
  }
  if(id==='patchworkBandana'||id==='crookedBow') for(const p of parts) p.pos[2] += 1.05*s;
  return parts;
}
