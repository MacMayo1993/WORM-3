import React from 'react';
import { Html } from '@react-three/drei';

export default class ErrorBoundary3D extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('3D Component Error:', error);
    console.error('Component Stack:', errorInfo.componentStack);
  }
  componentDidUpdate(previousProps) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <group>
          <mesh>
            <boxGeometry args={[10, 10, 10]} />
            <meshBasicMaterial color="red" wireframe />
          </mesh>
          <Html position={[0, 0, -2]}>
            <div style={{ color: 'red', background: 'rgba(0,0,0,0.8)', padding: '10px' }}>
              {this.props.label || 'Error Loading Background'}
              <br />
              {this.state.error?.message}
            </div>
          </Html>
        </group>
      );
    }
    return this.props.children;
  }
}
