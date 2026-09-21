// Shared low-poly craft models: +Y is outward, -Z is the direction of travel.
// Dimensions are in bead radii. Geometry is built only on equipment changes.
export function getHandmadeParts(id, s = 1) {
  const parts = [];
  const cloth = color => ({ color, roughness: 0.93, metalness: 0 });
  const cream = '#f5e6c8', ink = '#4b3d38', leaf = '#78a754', pink = '#d77c8c';
  const add = (geo, args, pos, color, rot, scale, role) => parts.push({
    geo: [geo, args], pos: pos.map(v => v * s), mat: cloth(color), rot, scale, role,
  });
  const ball = (r, p, c, scale, rot) => add('sphere', [r*s, 12, 8], p, c, rot, scale);
  const box = (d, p, c, rot) => add('box', d.map(v => v*s), p, c, rot);
  const cyl = (r1, r2, h, p, c, rot) => add('cylinder', [r1*s,r2*s,h*s,16],p,c,rot);
  const ring = (r,t,p,c,rot,role) => add('torus',[r*s,t*s,6,20],p,c,rot,undefined,role);
  const stitches = (x,y,z,n=5,axis='x') => {
    for(let i=0;i<n;i++) box([0.035,0.06,0.09], [x+(axis==='x'?i*.13:0),y,z+(axis==='z'?i*.13:0)],cream,[0,.3,-.2]);
  };
  const bow = (y,z) => {
    ball(.43,[-.4,y,z],pink,[1.15,.65,.25],[0,0,-.22]);
    ball(.33,[.32,y+.06,z],pink,[1.15,.75,.25],[0,0,.32]);
    ball(.16,[0,y,z-.05],cream,[.7,1,1]);
    box([.2,.48,.07],[-.16,y-.27,z+.03],pink,[0,0,-.3]);
    box([.18,.34,.07],[.2,y-.19,z+.03],pink,[0,0,.38]);
  };
  if(id==='toadstool') {
    cyl(.59,.7,.32,[0,.83,0],cream);
    add('sphere',[1.2*s,24,12,0,Math.PI*2,0,Math.PI/2],[.08,.99,0],'#b94f4a',[0,0,-.12],[1,.67,1]);
    ring(1.15,.05,[.08,1,0],cream,[Math.PI/2,0,-.12]);
    for(const [x,z,r] of [[-.55,.3,.2],[.45,.53,.17],[.55,-.38,.22],[-.4,-.58,.13],[.02,.03,.21]]) {
      const y=1+.67*Math.sqrt(Math.max(0,1.44-x*x-z*z));
      ball(r,[x+.08,y,z],cream,[1,.18,1]);
    }
  } else if(id==='acorn') {
    add('sphere',[1.04*s,20,10,0,Math.PI*2,0,Math.PI/2],[0,.8,0],'#916240',undefined,[1,.6,1]);
    ring(1,.09,[0,.82,0],'#624c35',[Math.PI/2,0,0]);
    for(let j=0;j<2;j++) for(let i=0;i<10;i++) {
      const a=(i+j*.5)*Math.PI/5,r=.9-j*.24;
      ball(.13,[Math.cos(a)*r,1.06+j*.23,Math.sin(a)*r],'#ba8958',[1,.38,1]);
    }
    cyl(.09,.13,.4,[.06,1.52,0],'#624c35',[0,0,-.3]);
  } else if(id==='paperboat') {
    // Flat triangular panels and folded brim: a paper silhouette, not a cone.
    add('cone',[1.12*s,1.12*s,3],[0,1.3,0],cream,[0,Math.PI/2,0],[1,1,.35]);
    box([2.25,.3,.14],[0,.83,.35],'#e6d6b8',[0,0,.05]);
    box([2.25,.3,.14],[0,.83,-.35],cream,[0,0,-.04]);
    for(let i=0;i<3;i++) box([.55,.018,.015],[-.48,.85+i*.07,-.43],'#95b7b4');
    box([.16,.03,.02],[.63,.91,-.435],'#bd6a68',[0,0,.65]);
    box([.16,.03,.02],[.63,.91,-.44],'#bd6a68',[0,0,-.65]);
  } else if(id==='sprout') {
    cyl(.07,.09,.85,[0,1.1,0],'#547c40',[0,0,-.13]);
    ball(.44,[-.3,1.48,0],leaf,[1.25,.22,.65],[0,0,-.32]);
    ball(.4,[.35,1.63,0],'#9dbf65',[1.25,.22,.65],[0,0,.38]);
    box([.5,.025,.025],[-.25,1.56,0],cream,[0,0,-.32]);
  } else if(id==='buttonGoggles') {
    for(const side of [-1,1]) {
      ring(.36,.105,[side*.4,.84,-.86],side<0?'#719ba2':'#d9a955',[.665,0,side*.08]);
      for(const x of [-.1,.1]) ball(.034,[side*.4+x,1.12,-.66],cream);
    }
    box([.2,.07,.07],[0,.88,-.9],ink);
    ring(.96,.045,[0,.13,0],ink,[Math.PI/2,0,0]);
  } else if(id==='patchworkBandana') {
    ring(1.02,.105,[0,.02,0],'#688e9b');
    box([.73,.38,.07],[-.22,.76,-.72],'#688e9b',[.6,0,.2]);
    box([.48,.48,.08],[.29,.65,-.76],'#c48667',[.6,0,-.2]);
    add('cone',[.45*s,.52*s,3],[0,.37,-.91],pink,[Math.PI,0,0],[1,1,.2]);
    stitches(-.35,.95,-.67,5);
    ball(.17,[.85,.5,.15],cream);
  } else if(id==='crookedBow') {
    ring(1,.07,[0,0,0],cream);
    bow(.73,-.76);
  } else if(id==='seedSatchel') {
    ring(1.02,.06,[0,0,0],'#795e45');
    ball(.64,[.88,.92,.12],'#b69a6e',[.8,1,.58]);
    box([.64,.3,.1],[.88,1.24,-.26],'#779065',[.18,0,-.08]);
    ball(.08,[.88,1.17,-.36],'#795e45');
    stitches(.62,.98,-.28,4);
    ball(.26,[.7,1.51,.12],leaf,[.4,1,.2],[0,0,-.3]);
    cyl(.025,.025,.44,[.65,1.3,.12],'#547c40');
  } else if(id==='friendshipBeads') {
    ring(1.03,.035,[0,0,0],cream);
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/4;
      ball(.17,[Math.cos(a)*1.04,Math.sin(a)*1.04,0],['#cc797b','#81a594','#e6bb67','#8e8eac'][i%4]);
      parts[parts.length-1].role = `bead${i%2}`;
    }
    box([.29,.29,.1],[0,1.06,-.07],cream,[0,0,.15]);
    box([.12,.04,.02],[0,1.06,-.135],ink);
  } else if(id==='quiltPatches') {
    box([.61,.07,.56],[.13,.99,0],'#799ca0',[0,.25,-.13]);
    stitches(-.12,1.04,-.22,4);
    stitches(-.12,1.04,.2,4);
    box([.22,.025,.06],[.12,1.065,0],cream,[0,.25,0]);
    box([.06,.025,.22],[.12,1.07,0],cream,[0,.25,0]);
  } else if(id==='ribbonTail') {
    ring(.8,.07,[0,0,.1],cream);
    bow(.6,.42);
  } else if(id==='paintbrushTail') {
    cyl(.24,.19,.9,[0,.2,.5],'#b88959',[Math.PI/2,0,0]);
    cyl(.27,.24,.38,[0,.2,1.02],'#c2b799',[Math.PI/2,0,0]);
    for(let i=0;i<5;i++) {
      const x=(i-2)*.09;
      ball(.2,[x,.2,1.4+(i%2)*.05],'#735744',[.4,.8,1.8]);
      ball(.16,[x,.2,1.65+(i%2)*.05],pink,[.42,.8,1.1]);
      parts[parts.length-1].role='paint';
    }
  }
  if(id==='patchworkBandana'||id==='crookedBow') for(const p of parts) p.pos[2] += 1.05*s;
  return parts;
}
