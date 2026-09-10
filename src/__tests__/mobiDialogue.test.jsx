import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MobiIntroScreen from '../components/screens/MobiIntroScreen.jsx';

let host, root;
beforeEach(() => {
  vi.useFakeTimers();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});
function show(props = {}) {
  act(() => root.render(<MobiIntroScreen lines={['First instruction.', 'Second instruction.']} onComplete={() => {}} {...props} />));
}
const buttons = () => [...host.querySelectorAll('button')];

describe('Mobi dialogue interaction', () => {
  it('does not intercept Enter on Skip or advance its copy', () => {
    const skipped = vi.fn();
    show({ onSkip: skipped });
    const skip = buttons()[0];
    skip.focus();
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    act(() => skip.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(false);
    expect(host.textContent).toContain('First instruction.');
    act(() => skip.click()); // jsdom does not synthesize native keyboard activation.
    act(() => vi.runAllTimers());
    expect(skipped).toHaveBeenCalledTimes(1);
  });
  it('cancels pending completion when a different screen unmounts Mobi', () => {
    const complete = vi.fn();
    show({ lines: ['Ready.'], onComplete: complete });
    act(() => buttons()[1].click());
    act(() => root.render(null));
    act(() => vi.runAllTimers());
    expect(complete).not.toHaveBeenCalled();
  });
  it('completes only once after repeated final actions', () => {
    const complete = vi.fn();
    show({ lines: ['Ready.'], onComplete: complete });
    act(() => { buttons()[1].click(); buttons()[1].click(); });
    act(() => vi.runAllTimers());
    expect(complete).toHaveBeenCalledTimes(1);
  });
  it('ignores background taps so reading is not accidentally skipped', () => {
    show();
    act(() => host.querySelector('[role="region"]').click());
    expect(host.textContent).toContain('First instruction.');
  });
  it('handles an empty dialogue without completing during render', () => {
    const complete = vi.fn();
    show({ lines: [], onComplete: complete });
    expect(complete).toHaveBeenCalledTimes(1);
    expect(host.textContent).toBe('');
  });
});
