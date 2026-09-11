// Shared, head-relative models for gameplay and every worm preview.
// +Y points out of the head. Keep to geometry supported by both renderers.
export function getHatParts(type, s = 0.28) {
  const parts = [];
  const cloth = (color) => ({ color, roughness: 0.88, metalness: 0 });
  const metal = (color) => ({ color, roughness: 0.28, metalness: 0.65 });
  const gold = metal('#e9b957');
  const cream = cloth('#fff1d2');
  const add = (geo, args, pos, mat, rot, scale) => {
    parts.push({ geo: [geo, args], pos: pos.map(v => v * s), mat, ...(rot && { rot }), ...(scale && { scale }) });
  };
  const cylinder = (top, bottom, height, pos, mat, rot) => add('cylinder', [top*s, bottom*s, height*s, 24], pos, mat, rot);
  const ball = (radius, pos, mat, scale) => add('sphere', [radius*s, 12, 10], pos, mat, undefined, scale);
  const ring = (radius, tube, y, mat) => add('torus', [radius*s, tube*s, 8, 32], [0,y,0], mat, [Math.PI/2,0,0]);
  const box = (dims, pos, mat, rot) => add('box', dims.map(v=>v*s), pos, mat, rot);
  const gem = (radius, pos, color) => add('octahedron', [radius*s,0], pos, { ...metal(color), emissive: color, emissiveIntensity: 0.12 });
  const around = (n, fn) => { for (let i=0;i<n;i++) fn(i*2*Math.PI/n,i); };

  if (type === 'tophat') {
    const felt = cloth('#272235');
    cylinder(1.34,1.3,0.13,[0,0.9,0],felt);
    ring(1.3,0.045,0.96,cloth('#51465e'));
    cylinder(0.77,0.85,1.45,[0,1.65,0],felt);
    ring(0.77,0.045,2.38,cloth('#51465e'));
    cylinder(0.84,0.86,0.28,[0,1.12,0],cloth('#9f3156'));
    box([0.34,0.25,0.07],[0,1.14,0.87],gold);
    box([0.2,0.13,0.08],[0,1.14,0.91],felt);
    ball(0.35,[-0.74,1.66,0.18],cloth('#c5a7d9'),[0.3,1.8,0.65]);
  } else if (type === 'party') {
    const purple = cloth('#713ead');
    add('cone',[0.84*s,2.2*s,24],[0,1.92,0],purple);
    ring(0.83,0.1,0.85,cream);
    ring(0.55,0.045,1.62,metal('#e9b957'));
    ring(0.29,0.045,2.3,cloth('#ed91b5'));
    around(7,(a,i)=>ball(0.085,[Math.cos(a)*0.69,1.27,Math.sin(a)*0.69],i%2?cream:cloth('#ed91b5')));
    ball(0.2,[0,3.06,0],cream);
    around(5,a=>ball(0.11,[Math.cos(a)*0.15,3.08,Math.sin(a)*0.15],cream));
  } else if (type === 'crown') {
    cylinder(1.02,0.96,0.45,[0,0.98,0],gold);
    cylinder(0.87,0.85,0.4,[0,1.17,0],cloth('#802347'));
    ring(0.99,0.075,0.78,gold);
    ring(1.02,0.055,1.2,gold);
    around(6,(a,i)=>{
      const x=Math.cos(a),z=Math.sin(a);
      add('cone',[0.22*s,0.64*s,4],[x*0.91,1.5,z*0.91],gold);
      ball(0.08,[x*0.91,1.84,z*0.91],gold);
      gem(0.14,[x*1.035,0.98,z*1.035],i%2?'#55cbb8':'#c83c76');
    });
  } else if (type === 'halo') {
    ring(0.87,0.075,1.9,gold);
    ring(0.87,0.025,1.98,{color:'#fff6d8',emissive:'#ffdc88',emissiveIntensity:0.65,roughness:0.3});
    ring(0.72,0.025,1.9,gold);
    around(6,a=>gem(0.07,[Math.cos(a)*0.87,1.98,Math.sin(a)*0.87],'#fff1d2'));
  } else if (type === 'beanie') {
    const knit=cloth('#85508f'), rib=cloth('#a870ad');
    add('sphere',[1.02*s,24,16,0,Math.PI*2,0,Math.PI*0.5],[0,0.79,0],knit);
    ring(0.98,0.17,0.85,cloth('#623968'));
    around(16,a=>ball(0.055,[Math.cos(a)*1.08,0.88,Math.sin(a)*1.08],rib,[1,2.1,1]));
    // Raised seams follow the dome instead of floating above the fabric.
    around(8,a=>{ for(let j=1;j<5;j++){const t=j*Math.PI/10;ball(0.035,[Math.cos(a)*Math.sin(t)*1.025,0.79+Math.cos(t)*1.025,Math.sin(a)*Math.sin(t)*1.025],rib,[1,1.5,1]);} });
    ball(0.24,[0,1.92,0],cream);
    around(6,a=>ball(0.12,[Math.cos(a)*0.16,1.94,Math.sin(a)*0.16],cream));
    box([0.31,0.23,0.055],[0,0.91,1.14],cream);
    box([0.13,0.1,0.06],[0,0.91,1.17],knit);
  } else if (type === 'wizard') {
    const fabric=cloth('#44345e');
    cylinder(1.4,1.48,0.13,[0,0.88,0],fabric);
    ring(1.42,0.05,0.94,gold);
    cylinder(0.24,0.9,1.65,[0,1.74,0],fabric);
    add('cone',[0.27*s,0.8*s,24],[0.19,2.87,0],fabric,[0,0,-0.5]);
    cylinder(0.85,0.89,0.23,[0,1.02,0],cloth('#a477ad'));
    gem(0.2,[0,1.04,0.9],'#70cbbb');
    gem(0.13,[-0.27,1.58,0.66],'#efcd83');
    gem(0.1,[0.12,2.12,0.43],'#efcd83');
    ball(0.1,[0.39,3.2,0],gold);
  } else if (type === 'flower') {
    cylinder(0.07,0.09,0.55,[0,1.02,0],cloth('#477451'));
    ball(0.34,[-0.25,1.01,0],cloth('#79a65a'),[1.3,0.2,0.65]);
    around(8,a=>ball(0.38,[Math.cos(a)*0.48,1.39,Math.sin(a)*0.48],cloth('#cf638e'),[1,0.38,1]));
    around(6,a=>ball(0.29,[Math.cos(a)*0.29,1.5,Math.sin(a)*0.29],cloth('#f3a3bb'),[1,0.4,1]));
    ball(0.26,[0,1.6,0],cloth('#e8b84c'),[1,0.55,1]);
    around(7,a=>ball(0.035,[Math.cos(a)*0.16,1.73,Math.sin(a)*0.16],cloth('#8f602f')));
  } else if (type === 'grad') {
    const felt=cloth('#2c293b');
    cylinder(0.78,0.85,0.45,[0,0.98,0],felt);
    ring(0.82,0.04,0.78,cloth('#554d64'));
    box([2.05,0.12,2.05],[0,1.25,0],felt);
    box([1.96,0.025,1.96],[0,1.32,0],cloth('#454052'));
    ball(0.09,[0,1.38,0],gold);
    // Continuous cord reaches from the button to the board's corner.
    cylinder(0.025,0.025,1.29,[0.46,1.37,0.46],gold,[Math.PI/2,0,-Math.PI/4]);
    cylinder(0.035,0.035,0.57,[0.93,1.09,0.93],gold);
    ball(0.08,[0.93,0.79,0.93],gold);
    around(7,a=>cylinder(0.017,0.026,0.31,[0.93+Math.cos(a)*0.07,0.62,0.93+Math.sin(a)*0.07],gold));
  }
  return parts;
}
