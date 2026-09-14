import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { useDialogBehavior } from '../ui/Panel.jsx';

// Only the newest dialog owns the background. Rebuild on transitions so an
// outgoing ScreenTransition cannot leave the incoming dialog inert.
const dialogs = [];
let restoreBackground = [];
function updateBackground() {
  for (const [node, inert] of restoreBackground) {
    if (inert) node.setAttribute('inert', ''); else node.removeAttribute('inert');
  }
  restoreBackground = [];
  let active = dialogs.at(-1);
  while (active?.parentElement) {
    for (const sibling of active.parentElement.children) {
      if (sibling === active || /^(STYLE|SCRIPT|LINK)$/.test(sibling.tagName)) continue;
      restoreBackground.push([sibling, sibling.hasAttribute('inert')]);
      sibling.setAttribute('inert', '');
    }
    if (active.parentElement === document.body) break;
    active = active.parentElement;
  }
}

export default function DemoDialog({ onClose, children, ...props }) {
  const ref = useRef(null);
  const onKeyDown = useDialogBehavior(ref, onClose);
  useLayoutEffect(() => {
    const node = ref.current;
    dialogs.push(node); updateBackground();
    return () => { dialogs.splice(dialogs.indexOf(node), 1); updateBackground(); };
  }, []);
  useEffect(() => { ref.current?.querySelector('[data-demo-autofocus]')?.focus(); }, []);
  return <div {...props} ref={ref} tabIndex={-1} role="dialog" aria-modal="true" onKeyDown={onKeyDown}>{children}</div>;
}
