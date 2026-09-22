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
  const flower = (x,y,z,r=.38) => {
    for(let i=0;i<7;i++) { const a=i*Math.PI*2/7;
      ball(r*.46,[x+Math.cos(a)*r*.7,y,z+Math.sin(a)*r*.7],cream,[1,.23,1]);
    }
    ball(r*.36,[x,y+.055,z],'#d9a955',[1,.5,1]);
  };
  if(id==='daisy') {
    ball(.86,[0,.86,0],leaf,[1,.16,.85],[0,.3,.1]);
    flower(.05,1.05,0,.85);
  } else if(id==='thimble') {
    cyl(.65,.87,1.02,[0,1.18,0],'#99aaa8',[0,0,-.08]);
    ring(.87,.07,[.04,.69,0],'#657e80',[Math.PI/2,0,0]);
    for(let row=0;row<3;row++) for(let i=0;i<10;i++) {
      const a=(i+row*.5)*Math.PI/5,r=.81-row*.07;
      ball(.055,[Math.cos(a)*r, .85+row*.26, Math.sin(a)*r],'#657e80');
    }
    stitches(-.25,1.71,-.12,5);
  } else if(id==='leafBeret') {
    ball(.98,[.12,.92,0],leaf,[1.13,.26,.88],[0,0,-.12]);
    cyl(.055,.07,.3,[.16,1.24,0],'#547c40',[0,0,-.4]);
    box([1.3,.025,.035],[.1,1.15,0],cream,[0,.2,-.08]);
    for(const side of [-1,1])for(let i=0;i<3;i++)box([.38,.02,.025],[-.35+i*.36,1.13,side*.16], '#547c40',[0,side*.65,0]);
  } else if(id==='bottlecapGlasses') {
    for(const side of [-1,1]) {
      ring(.35,.085,[side*.4,.84,-.86],side<0?'#c48667':'#688e9b',[.665,0,0]);
      for(let i=0;i<10;i++) { const a=i*Math.PI/5;
        ball(.065,[side*.4+Math.cos(a)*.36,.84+Math.sin(a)*.28,-.86+Math.sin(a)*.22],cream);
      }
    }
    box([.2,.065,.065],[0,.86,-.9],ink);
    ring(.96,.04,[0,.13,0],ink,[Math.PI/2,0,0]);
  } else if(id==='yarnMustache') {
    for(const side of [-1,1]) for(let i=0;i<4;i++) {
      ball(.2,[side*(.12+i*.13),.34+i*i*.018,-1.02+i*.035],'#795e45',[1,.42,.43],[0,0,side*.18*i]);
      ball(.05,[side*(.12+i*.13),.39+i*i*.018,-1.09+i*.035],cream,[1,.35,.5]);
    }
  } else if(id==='daisyCollar') {
    ring(1,.065,[0,0,1.05],leaf);
    for(let i=0;i<5;i++) {const a=.2+i*Math.PI/4;
      flower(Math.cos(a)*.86,Math.sin(a)*.9,1.05,.27);
    }
  } else if(id==='knittedScarf') {
    ring(1,.14,[0,0,1.05],'#b96c63');
    box([.36,.12,1.05],[.66,.8,1.48],'#b96c63',[0,-.2,-.2]);
    for(let i=0;i<6;i++)box([.35,.035,.045],[.66+i*.028,.88,1.1+i*.14],cream,[0,-.2,-.2]);
    for(let i=0;i<4;i++)cyl(.025,.025,.25,[.57+i*.09,.82,2.04],'#b96c63',[Math.PI/2,0,0]);
  } else if(id==='spoolBackpack') {
    ring(1,.05,[0,0,0],'#795e45');
    cyl(.45,.45,.8,[0,1.17,0],pink,[0,0,Math.PI/2]);
    for(const side of [-1,1])cyl(.57,.57,.1,[side*.44,1.17,0],'#b69a6e',[0,0,Math.PI/2]);
    for(let i=0;i<7;i++)ring(.45,.024,[-.3+i*.1,1.17,0],cream,[0,Math.PI/2,0]);
  } else if(id==='matchboxBackpack') {
    ring(1,.05,[0,0,0],'#795e45');
    box([.85,.48,.92],[0,1.08,0],'#b96c63',[0,0,-.08]);
    box([.7,.035,.7],[0,1.34,0],cream,[0,0,-.08]);
    box([.06,.24,.72],[.44,1.09,0],'#795e45');
    flower(0,1.4,0,.23);
    box([.6,.27,.055],[0,1.1,.48],'#b69a6e');
  } else if(id==='buttonTrail') {
    cyl(.36,.36,.1,[.08,1.0,0],'#688e9b');
    ring(.27,.026,[.08,1.065,0],cream,[Math.PI/2,0,0]);
    for(const x of [-.09,.09])for(const z of [-.09,.09])ball(.04,[.08+x,1.07,z],ink,[1,.25,1]);
    box([.025,.02,.26],[.08,1.08,0],cream,[0,.75,0]);
  } else if(id==='leafCape') {
    ring(1,.045,[0,0,-.28],'#b69a6e');
    ball(.92,[0,.94,.53],leaf,[.8,.13,1.45]);
    box([.035,.025,2.1],[0,1.07,.55],cream);
    for(const side of [-1,1])for(let i=0;i<4;i++)box([.51,.025,.03],[side*.24,1.05,-.05+i*.33],'#547c40',[0,side*.6,0]);
  } else if(id==='fireflyJar') {
    // Open wire cage and emissive beads: no transparent sorting or extra lights.
    ring(1,.05,[0,0,0],'#795e45');
    for(const y of [.9,1.65])ring(.4,.04,[.55,y,0],'#688e9b',[Math.PI/2,0,0]);
    for(let i=0;i<6;i++){const a=i*Math.PI/3;cyl(.024,.024,.75,[.55+Math.cos(a)*.4,1.27,Math.sin(a)*.4],'#688e9b');}
    cyl(.44,.44,.1,[.55,1.72,0],'#b69a6e');
    ring(.22,.035,[.55,1.96,0],'#795e45');
    for(const [x,y,z] of [[.4,1.12,.12],[.73,1.43,-.08],[.47,1.51,.08]]) {
      ball(.08,[x,y,z],'#e6bb67');
      parts[parts.length-1].mat={...cloth('#e6bb67'),emissive:'#e6bb67',emissiveIntensity:.65};
      parts[parts.length-1].role='firefly';
      ball(.09,[x+.08,y+.04,z],cream,[1,.25,.5]);
    }
  } else if(id==='windupKey') {
    cyl(.1,.1,.75,[0,.45,.48],'#b69a6e',[Math.PI/2,0,0]);
    for(const side of [-1,1])ring(.27,.075,[side*.25,.45,.93],'#d9a955');
    box([.26,.18,.1],[0,.45,.93],'#b69a6e');
  } else if(id==='paperPinwheel') {
    cyl(.045,.045,1.15,[0,.65,.38],'#b69a6e');
    for(let i=0;i<4;i++) {
      const a=i*Math.PI/2;
      add('cone',[.27*s,.58*s,3],[Math.cos(a)*.25,1.22+Math.sin(a)*.25,.38],i%2?cream:pink,[0,0,a-.6],[1,1,.13]);
    }
    ball(.1,[0,1.22,.29],'#d9a955');
  } else if(id==='toadstool') {
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
