export const patchVertex = `
 attribute float patchAlpha;
 varying float vAlpha;
 varying vec2 vUv;
 void main() {
   vAlpha=patchAlpha; vUv=uv;
   gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);
 }
`;
export const shieldFragment = `
 varying float vAlpha;
 varying vec2 vUv;
 void main() {
   vec2 p=vUv-0.5;
   float width=0.36*min(1.0,(p.y+0.4)/0.34);
   float d=min(width-abs(p.x),min(0.36-p.y,p.y+0.4));
   float mask=smoothstep(0.0,0.018,d);
   float rim=1.0-smoothstep(0.045,0.07,d);
   float heat=1.0-smoothstep(0.085,0.12,length(p-vec2(0.0,0.03)));
   vec3 color=mix(vec3(0.025,0.13,0.15),vec3(0.62,0.96,1.0),rim);
   color=mix(color,vec3(1.0,0.73,0.27),heat);
   gl_FragColor=vec4(color,mask*vAlpha);
 }
`;
export const springFragment = `
 varying float vAlpha;
 varying vec2 vUv;
 void main() {
   vec3 color=mix(vec3(0.22,0.53,0.15),vec3(0.78,1.0,0.53),0.5+0.5*cos(vUv.y*6.283185));
   gl_FragColor=vec4(color,vAlpha);
 }
`;
