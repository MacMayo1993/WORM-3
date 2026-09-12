// Bounded, full-square fields: no alpha cutout, vignette, texture fetch or ray march.
// Each style has its own spatial construction; time is deliberately slow.
const COMMON = `
 uniform vec3 baseColor;
 uniform vec3 antipodalColor;
 uniform float time;
 varying vec2 vUv;
 float edge(float x) { float w=max(fwidth(x),0.015); return smoothstep(-w,w,x); }
 float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
 vec2 turn(vec2 p,float a) { return mat2(cos(a),-sin(a),sin(a),cos(a))*p; }
 void paint(float field,float accent) {
   vec3 c=mix(baseColor*0.48,mix(baseColor,vec3(1.0),0.58),clamp(field,0.0,1.0));
   c=mix(c,mix(baseColor,antipodalColor,0.45),clamp(accent,0.0,1.0)*0.28);
   gl_FragColor=vec4(c,1.0);
 }
`;
const bodies = {
 breathingScales: `
 vec2 p=vUv*6.0; p.x+=mod(floor(p.y),2.0)*0.5;
 vec2 q=fract(p)-0.5; q.y*=0.8+0.12*sin(t+floor(p.x));
 float r=length(q+vec2(0.0,0.5));
 paint(0.25+0.6*edge(0.62-r),edge(0.035-abs(r-0.52)));`,
 coralPolyps: `
 vec2 p=vUv*4.0; vec2 q=fract(p)-0.5;
 float a=atan(q.y,q.x+0.0001),r=length(q);
 float petals=0.29+0.055*sin(a*7.0+t+hash(floor(p))*6.0);
 paint(0.25+0.65*edge(petals-r)+0.1*cos(r*35.0-t),edge(0.095-r));`,
 amoebaMosaic: `
 vec2 p=vUv*4.0; vec2 cell=floor(p),q=fract(p); float near=4.0,next=4.0;
 for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++) {
   vec2 g=vec2(float(x),float(y)); float h=hash(cell+g);
   vec2 seed=g+0.5+0.26*sin(vec2(h*6.28,h*13.7)+t)-q;
   float d=dot(seed,seed); if(d<near){next=near;near=d;}else{next=min(next,d);}
 }
 paint(0.22+0.7*edge(next-near-0.045),exp(-near*10.0));`,
 myceliumVeins: `
 vec2 p=vUv*7.0; p+=0.4*sin(p.yx*1.6+t);
 float veins=min(abs(sin(p.x*2.4+sin(p.y))),abs(sin(p.y*3.0+sin(p.x-t))));
 paint(0.3+0.55*edge(0.15-veins),0.5+0.5*sin(p.x+p.y+t));`,
 chromaticCilia: `
 vec2 p=vUv*vec2(12.0,4.0); vec2 q=fract(p)-0.5;
 float bend=0.19*sin(q.y*5.0+t+floor(p.x)*0.7);
 float hair=abs(q.x-bend);
 paint(0.25+0.7*edge(0.065-hair),smoothstep(-0.4,0.4,q.y));`,
 irisTessellation: `
 vec2 p=vUv*4.0; p.x+=0.5*mod(floor(p.y),2.0); vec2 q=fract(p)-0.5;
 q.y*=1.6; float r=length(q),a=atan(q.y,q.x+0.0001);
 float iris=(0.5+0.5*cos(a*22.0+r*10.0-t))*edge(0.38-r);
 paint(0.8-0.48*edge(0.42-r)+0.35*iris-0.2*edge(0.12-r),iris);`,
 ribbonEstuary: `
 vec2 p=vUv*6.0; float flow=p.x+0.45*sin(p.y*1.3-t)+0.2*sin(p.y*3.1+t);
 float stripe=0.5+0.5*sin(flow*8.0);
 paint(0.2+0.7*stripe,edge(sin(flow*4.0+p.y*0.7)));`,
 pearlMembrane: `
 vec2 p=vUv*5.0; p+=0.12*sin(p.yx*2.0+t); vec2 q=fract(p)-0.5;
 float r=length(q); float dome=sqrt(max(0.0,1.0-r*r*3.0));
 paint(0.18+0.7*dome-0.22*edge(r-0.43),pow(0.5+0.5*sin(r*24.0-t),5.0));`,
 origamiTide: `
 vec2 p=vUv*5.0; p.y+=0.2*sin(p.x*1.2+t); vec2 q=fract(p);
 float fold=edge(q.x-q.y),parity=mod(floor(p.x)+floor(p.y),2.0);
 paint(0.18+0.35*fold+0.3*parity+0.13*sin(q.x*3.14+t),abs(q.x-q.y));`,
 lenticularWaves: `
 vec2 p=vUv*2.0-1.0; float slats=edge(sin(p.x*42.0));
 float a=0.5+0.5*sin(p.y*12.0+p.x*4.0+t);
 float b=0.5+0.5*cos(p.y*7.0-p.x*12.0-t);
 paint(0.15+0.75*mix(a,b,slats),slats*0.5);`,
 quiltedSpace: `
 vec2 p=turn(vUv*5.0,0.785398); p+=0.09*sin(p.yx*2.0+t);
 vec2 q=fract(p); float puff=pow(max(0.0,sin(q.x*3.14159)*sin(q.y*3.14159)),0.6);
 paint(0.2+0.75*puff,edge(0.08-min(min(q.x,q.y),min(1.0-q.x,1.0-q.y))));`,
 phaseLabyrinth: `
 vec2 p=vUv*5.0; vec2 q=fract(p); if(hash(floor(p))>0.5) q.x=1.0-q.x;
 float d=min(abs(length(q)-0.5),abs(length(q-1.0)-0.5));
 paint(0.22+0.65*edge(0.11-d),0.5+0.5*sin((q.x+q.y)*12.0+t));`,
 rippleInterlock: `
 vec2 p=vUv*4.0; vec2 q=fract(p)-0.5;
 float a=sin(length(q-vec2(0.25,0.0))*28.0-t);
 float b=sin(length(q+vec2(0.25,0.0))*28.0+t);
 paint(0.2+0.65*edge(a*b),0.5+0.5*a);`,
 elasticHoneycomb: `
 vec2 p=vUv*7.0; p+=0.15*sin(p.yx*1.4+t);
 vec2 a=mod(p,vec2(1.73205,1.0))-vec2(0.866025,0.5);
 vec2 b=mod(p-vec2(0.866025,0.5),vec2(1.73205,1.0))-vec2(0.866025,0.5);
 vec2 q=dot(a,a)<dot(b,b)?a:b; q=abs(q);
 float d=max(q.y,dot(q,vec2(0.866025,0.5)));
 paint(0.2+0.65*edge(0.4-d),0.5+0.5*sin(d*20.0-t));`,
 livingContour: `
 vec2 p=vUv*6.0; float terrain=sin(p.x+t)*cos(p.y-t*0.5)+0.4*sin(p.x*2.3+p.y*1.7);
 float contour=edge(sin(terrain*16.0));
 paint(0.2+0.65*contour,0.5+0.5*sin(terrain*3.0+t));`,
 kaleidoBloom: `
 vec2 q=fract(vUv*3.0)-0.5; float a=atan(q.y,q.x+0.0001),r=length(q);
 float wedge=abs(mod(a+0.523599,1.047198)-0.523599);
 float bloom=sin(r*24.0+cos(wedge*6.0)*3.0-t);
 paint(0.22+0.66*edge(bloom),0.5+0.5*cos(wedge*12.0+r*8.0));`,
 foldedHorizon: `
 vec2 p=vUv*6.0; float peak=abs(fract(p.x*0.5+t*0.07)-0.5)*2.0;
 float bands=p.y+peak*1.3+0.12*sin(p.x*2.0+t);
 paint(0.2+0.65*fract(bands),edge(sin(bands*6.28318)));`,
 magneticRosettes: `
 vec2 p=vUv*4.0; vec2 q=fract(p)-0.5; float h=hash(floor(p));
 float a=atan(q.y,q.x+0.0001)+t*(h>0.5?1.0:-1.0),r=length(q);
 float star=sin(a*5.0+r*18.0);
 paint(0.2+0.65*edge(star),pow(0.5+0.5*cos(r*15.0-t),4.0));`,
 prismaticFaults: `
 vec2 p=vUv*5.0; p.x+=floor(p.y)*0.33+0.1*sin(t+floor(p.y));
 vec2 q=fract(p); float facets=edge(q.x+q.y-1.0);
 paint(0.2+0.35*facets+0.3*q.x,hash(floor(p))*0.8+0.1*sin(t));`,
 dominoDrift: `
 vec2 p=vUv*vec2(4.0,6.0); p.x+=sin(t+floor(p.y)*1.4)*0.25;
 vec2 q=fract(p); float grout=edge(min(min(q.x,q.y),min(1.0-q.x,1.0-q.y))-0.055);
 float panel=mod(floor(p.x)+floor(p.y),2.0);
 paint(0.2+grout*(0.25+0.4*panel),edge(0.035-abs(q.x-0.5))*grout);`,
};
export const livingSurfaceShaders = Object.fromEntries(Object.entries(bodies).map(([key, body]) =>
  [key, `${COMMON}\nvoid main() { float t=time*0.28; ${body}\n}`]));
