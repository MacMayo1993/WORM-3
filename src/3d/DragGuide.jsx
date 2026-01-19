import React from 'react';
import { Html } from '@react-three/drei';

const DragGuide = ({ position, activeDir }) => {
  if (!position) return null;
  const arrows = [
    { id: 'up', label: '▲', style: { top: -80, left: 0 } },
    { id: 'down', label: '▼', style: { top: 80, left: 0 } },
    { id: 'left', label: '◀', style: { top: 0, left: -80 } },
    { id: 'right', label: '▶', style: { top: 0, left: 80 } }
  ];
  return (
    <Html position={[position.x, position.y, position.z]} center zIndexRange={[100, 0]}>
      <div className="drag-guide-container">
        {arrows.map(a => (
          <div key={a.id} className="guide-arrow" style={{
            ...a.style,
            transform: activeDir === a.id ? 'scale(1.5)' : 'scale(1)',
            color: activeDir === a.id ? 'var(--highlight)' : 'var(--text)'
          }}>
            {a.label}
          </div>
        ))}
      </div>
    </Html>
  );
};

export default DragGuide;
