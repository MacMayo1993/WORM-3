import React from 'react';
import { createPortal } from 'react-dom';

// Gameplay feedback must survive the hidden/inert CaptureChrome ancestors.
// Always use the same portal, including outside capture, so toggling capture
// cannot remount an effect or restart its animation. Only noninteractive,
// screen-positioned visuals belong here; menus stay in CaptureChrome.
export default function CaptureVisual({ children, behindHud = false }) {
  return createPortal(
    <div className="capture-gameplay-visual" style={{
      position: 'fixed', inset: 0, zIndex: behindHud ? 90 : 100, pointerEvents: 'none',
    }}>{children}</div>,
    document.body,
  );
}
