// src/3d/SafeEnvironment.jsx
// drei's <Environment preset="…"> fetches an HDR from a CDN and THROWS if the
// fetch fails. Because it lives inside the Canvas, that throw propagates to the
// top-level CanvasErrorBoundary and blanks the entire 3D scene — so a single
// blocked/slow CDN request (venue wifi, offline demo) takes down the cube, the
// menu, everything. This boundary contains the failure to the reflections
// alone: on error it renders nothing and the scene keeps its lights and
// materials, just without image-based reflections.
import React from 'react';
import { Environment } from '@react-three/drei';

class EnvBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err) {
    // One line, not a crash — the reflections are cosmetic.
    console.warn('[SafeEnvironment] environment map failed to load; continuing without reflections.', err?.message ?? err);
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

// Suspense fallback of null so a slow HDR never blocks the first paint either.
const SafeEnvironment = (props) => (
  <EnvBoundary>
    <React.Suspense fallback={null}>
      <Environment {...props} />
    </React.Suspense>
  </EnvBoundary>
);

export default SafeEnvironment;
