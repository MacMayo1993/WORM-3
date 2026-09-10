export const tubeVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const tubeFragmentShader = `
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform float uDanger;
  uniform float uTime;
  uniform float uPulse;
  uniform float uBurst;
  uniform float uDead;
  
  varying vec2 vUv;
  
  void main() {
    if (uDead > 0.5) {
      gl_FragColor = vec4(0.2, 0.2, 0.2, 0.15);
      return;
    }
    
    // Wait until it hits the VoidCore at the center (0.5), then switch colors
    vec3 baseColor = mix(uColor1, uColor2, smoothstep(0.48, 0.52, vUv.x));
    
    if (uDanger > 0.0) {
      // Saturate hue
      baseColor = mix(baseColor, baseColor * 1.5, uDanger * 0.5);
    }
    
    // Energy pulses traveling along the tube
    float scroll = fract(vUv.x * 3.0 - uTime * 2.0);
    float energy = smoothstep(0.4, 0.6, scroll) * smoothstep(0.8, 0.6, scroll);
    
    // Brighten the core
    vec3 finalColor = baseColor + (baseColor * energy * 0.8 * uPulse);
    finalColor += (vec3(1.0) * uBurst * 0.8);
    
    // Gap in middle (disappear inside VoidCore)
    float centerDist = abs(vUv.x - 0.5);
    float coreHide = smoothstep(0.08, 0.12, centerDist);
    
    // Edges are more transparent (vUv.y is the circumference)
    float edgeAlpha = sin(vUv.y * 3.14159);
    float alpha = clamp((0.4 + energy * 0.3) * uPulse + (uBurst * 0.5), 0.0, 1.0) * mix(0.5, 1.0, edgeAlpha) * coreHide;
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

