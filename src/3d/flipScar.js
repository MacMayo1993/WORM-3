import { ShaderMaterial } from 'three';

// One transparent instanced draw, using the existing tile frame for both cameras.
export const flipScarMaterial = new ShaderMaterial({
  uniforms: { playTime: { value: 0 }, warning: { value: 0 } },
  transparent: true, depthWrite: false, toneMapped: false,
  vertexShader: `
    attribute vec4 aInstanceData;
    uniform float playTime, warning;
    varying vec2 tileUv;
    varying vec4 scar;
    void main() {
      tileUv = uv;
      scar = aInstanceData; // history, stable flag, last relapse time, motion
      vec3 p = position;
      float wobble = step(1.5,scar.x)*(1.0-scar.y)*scar.w*(0.002+0.002*scar.x)*(1.0+warning);
      p.xy += wobble * vec2(sin(playTime*18.0),cos(playTime*21.0));
      p.z += 0.032;
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
    }`,
  fragmentShader: `
    uniform float playTime, warning;
    varying vec2 tileUv;
    varying vec4 scar;
    float line(vec2 p, vec2 a, vec2 b) {
      vec2 v = b-a;
      return length(p-a-v*clamp(dot(p-a,v)/dot(v,v),0.0,1.0));
    }
    void main() {
      vec2 p = tileUv, fork = vec2(.49,.53);
      float d = min(line(p, vec2(.13,.86), fork), line(p, fork, vec2(.72,.16)));
      if (abs(scar.x) >= 4.0) d = min(d, line(p, fork, vec2(.86,.66)));
      float mark = 1.0-smoothstep(.007,.022,d);
      float rim = max(abs(p.x-.5),abs(p.y-.5));
      float tell = (1.0-smoothstep(.008,.023,abs(rim-.43))) * warning*(1.0-scar.y);
      float age = playTime-scar.z;
      float bloom = (1.0-smoothstep(.015,.04,abs(distance(p,vec2(.5))-.12-.45*age)))*step(0.0,age)*(1.0-smoothstep(.2,.85,age))*scar.w;
      float spot = (1.0-smoothstep(.008,.026,abs(rim-.40)))*step(0.0,age)*(1.0-step(1.4,age));
      float alpha = max(spot, max(max(mark*step(1.5,abs(scar.x)),tell*step(1.5,scar.x)),bloom));
      if(alpha < .025) discard;
      vec3 ink = mix(vec3(.18,.13,.10),vec3(.96,.67,.11),max(scar.y,step(.01,bloom)));
      gl_FragColor = vec4(ink,alpha*.91);
      #include <colorspace_fragment>
    }`,
});
