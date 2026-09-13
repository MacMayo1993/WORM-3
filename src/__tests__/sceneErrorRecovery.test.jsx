import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { it, expect, vi } from 'vitest';
vi.mock('@react-three/drei', () => ({ Html: ({ children }) => <div>{children}</div> }));
import ErrorBoundary3D from '../3d/ErrorBoundary3D.jsx';

it('keeps a failed scene contained until a new run and then renders it again', () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'); const root = createRoot(host);
  const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
  const Scene = ({ fail }) => { if (fail) throw new Error('mesh.dispose is not a function'); return <span>Running</span>; };
  const render = (run, fail) => act(() => root.render(<ErrorBoundary3D resetKey={run} label="Worm scene interrupted"><Scene fail={fail} /></ErrorBoundary3D>));
  try {
    render(1, true);
    expect(host.textContent).toContain('Worm scene interrupted');
    render(1, false);
    expect(host.textContent).not.toContain('Running');
    render(2, false);
    expect(host.textContent).toBe('Running');
  } finally { act(() => root.unmount()); errorLog.mockRestore(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; }
});
