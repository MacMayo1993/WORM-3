export const patchVertex = `
 attribute float patchAlpha;
 attribute float patchVariant;
 varying float vVariant;
 attribute float patchCharge;
 varying float vAlpha;
 varying float vCharge;
 varying vec2 vUv;
 void main() {
   vVariant=patchVariant; vAlpha=patchAlpha; vCharge=patchCharge; vUv=uv;
   gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);
 }
`;
export const shieldFragment = `
 varying float vVariant;
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
   if(vVariant>0.5 && vVariant<1.5) {
     // Obsidian: a dark faceted plate with a violet rim, no hot centre.
     float facet=step(0.0,p.x+p.y)*0.13;
     color=mix(vec3(0.10+facet,0.08+facet,0.20+facet),vec3(0.72,0.64,0.95),rim);
   } else if(vVariant>1.5) {
     // Steam keeps the shield silhouette and a pale, cool centre.
     color=mix(vec3(0.35,0.67,0.74),vec3(0.91,0.99,1.0),max(rim,heat));
   }
   gl_FragColor=vec4(color,mask*vAlpha);
 }
`;
export const springFragment = `
 varying float vAlpha;
 varying float vCharge;
 varying vec2 vUv;
 void main() {
   vec3 color=mix(vec3(0.22,0.53,0.15),vec3(0.78,1.0,0.53),0.5+0.5*cos(vUv.y*6.283185));
   // Thunderpad: a pad the storm struck is charged, lightning violet with a white core.
   color=mix(color,mix(vec3(0.66,0.55,0.98),vec3(0.94,0.97,1.0),0.5+0.5*cos(vUv.y*18.85)),vCharge);
   gl_FragColor=vec4(color,vAlpha);
 }
`;
