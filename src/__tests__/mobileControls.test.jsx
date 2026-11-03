import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import MobileControls from '../components/menus/MobileControls.jsx';

let host, root, props;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  props = Object.fromEntries(['onShowHelp', 'onToggleFlip', 'onToggleExplode', 'onToggleTunnels', 'onShuffle', 'onReset', 'onToggleNet', 'onRotateCW', 'onRotateCCW', 'onUndo', 'onToggleTeachMode', 'onOrbitCW', 'onOrbitCCW'].map(key => [key, vi.fn()]));
  Object.assign(props, { cubeSize: 3, canUndo: true, undoCount: 2, flipMode: false, exploded: false, showNetPanel: false, showTunnels: false, teachModeActive: false });
});
afterEach(() => { act(() => root.unmount()); host.remove(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
const render = () => act(() => root.render(<MobileControls {...props} />));
const button = name => [...document.querySelectorAll('button')].find(el => el.getAttribute('aria-label') === name);
const click = name => act(() => button(name).click());
const open = () => { render(); click('Open menu'); };

describe('bounded mobile action sheet', () => {
  it('shows visible action labels and connects its launcher to the sheet', () => {
    open();
    const sheet = host.querySelector('.mobile-actions-sheet');
    expect(sheet.getAttribute('aria-label')).toBe('Cube actions');
    expect(button('Close menu').getAttribute('aria-controls')).toBe(sheet.id);
    expect(button('Close menu').getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(button('Close cube actions'));
    expect(sheet.querySelectorAll('.mobile-action-label')).toHaveLength(12);
    for (const action of sheet.querySelectorAll('.mobile-actions-grid button')) {
      expect(action.querySelector('.mobile-action-label').textContent.length).toBeGreaterThan(0);
      expect(action.style.minHeight).toBe('52px');
    }
  });

  it.each([['Help','onShowHelp'], ['Shuffle','onShuffle'], ['Reset','onReset'], ['Toggle teach mode','onToggleTeachMode']])('runs %s once and dismisses', (label, callback) => {
    open(); click(label);
    expect(props[callback]).toHaveBeenCalledTimes(1);
    expect(host.querySelector('.mobile-actions-sheet')).toBeNull();
    expect(button('Open menu').getAttribute('aria-expanded')).toBe('false');
  });

  it.each([['Rotate view left','onOrbitCCW'], ['Rotate view right','onOrbitCW'], ['Rotate clockwise','onRotateCW'], ['Rotate counter-clockwise','onRotateCCW'], ['Toggle flip mode','onToggleFlip'], ['Toggle exploded view','onToggleExplode'], ['Toggle net view','onToggleNet'], ['Tunnels: off — tap to cycle','onToggleTunnels']])('retains repeated %s actions', (label, callback) => {
    open(); click(label); click(label);
    expect(props[callback]).toHaveBeenCalledTimes(2);
    expect(host.querySelector('.mobile-actions-sheet')).not.toBeNull();
  });

  it('reflects toggle and tunnel states, and omits unavailable actions', () => {
    props = { ...props, cubeSize: 4, onOrbitCW: undefined, onOrbitCCW: undefined, onRotateCW: undefined, onRotateCCW: undefined, flipMode: true, exploded: true, showNetPanel: true, showTunnels: true, tunnelDetail: 'full' };
    open();
    for (const label of ['Toggle flip mode', 'Toggle exploded view', 'Toggle net view']) expect(button(label).getAttribute('aria-pressed')).toBe('true');
    expect(button('Tunnels: full — tap to cycle').textContent).toContain('Tunnels: Full');
    expect(button('Toggle teach mode')).toBeUndefined();
    expect(button('Rotate view left')).toBeUndefined();
  });

  it('dismisses on Escape and close, restores focus, and reopens cleanly', () => {
    open();
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(host.querySelector('.mobile-actions-sheet')).toBeNull();
    expect(document.activeElement).toBe(button('Open menu'));
    click('Open menu'); click('Close cube actions');
    expect(document.activeElement).toBe(button('Open menu'));
    click('Open menu');
    act(() => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(host.querySelector('.mobile-actions-sheet')).toBeNull();
    click('Open menu');
    act(() => button('Toggle flip mode').dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(host.querySelector('.mobile-actions-sheet')).not.toBeNull();
  });

  it('restores focus to the session summary when its portalled launcher is hidden', () => {
    const details = document.createElement('details');
    details.innerHTML = '<summary>Session menu</summary><span></span>';
    host.append(details); props.actionSlot = details.querySelector('span');
    // Keep the integration host outside React’s managed root.
    document.body.append(details); details.open = true;
    render(); click('Open menu'); details.open = false;
    click('Close cube actions');
    expect(document.activeElement).toBe(details.querySelector('summary'));
    details.remove();
  });

  it('keeps undo independent of the sheet and respects demo suppression', () => {
    render(); click('Undo last move (2 available)'); expect(props.onUndo).toHaveBeenCalledTimes(1);
    props.showUndo = false; render(); expect(button('Undo last move (2 available)')).toBeUndefined();
  });
});
