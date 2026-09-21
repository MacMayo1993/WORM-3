import React, { act, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { WizardShell, wizardLayout } from '../components/screens/WizardChrome.jsx';
import CubeModeSelectScreen from '../components/screens/CubeModeSelectScreen.jsx';
import { useDialogBehavior } from '../components/ui/Panel.jsx';
vi.mock('../components/screens/wormMenuFeedback.js', () => ({ wormMenuFeedback: vi.fn() }));
let root, host;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
const render = node => act(() => root.render(node));
const click = node => act(() => node.click());

it('keeps both illustrated cube paths actionable and returns keyboard focus on close', () => {
  const outside = document.createElement('button'); document.body.append(outside); outside.focus();
  const cube = vi.fn(), chaos = vi.fn(), back = vi.fn();
  render(<CubeModeSelectScreen onRubiks={cube} onDisparity={chaos} onBack={back} />);
  const options = host.querySelectorAll('.cube-path-options>button');
  expect(options).toHaveLength(2);
  expect(options[0].querySelector('svg').getAttribute('aria-hidden')).toBe('true');
  click(options[0]); click(options[1]);
  expect(cube).toHaveBeenCalledOnce(); expect(chaos).toHaveBeenCalledOnce();
  act(() => host.querySelector('[role="dialog"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(back).toHaveBeenCalledOnce();
  render(null); expect(document.activeElement).toBe(outside); outside.remove();
});

it('keeps live setup selections while tabs and Next move through the compact wizard', () => {
  const finish = vi.fn();
  function Setup() {
    const [step, setStep] = useState(0), [color, setColor] = useState('Moss');
    const categories = [
      { key: 'colors', label: 'Colors', summary: color, hero: <div>Live preview: {color}</div>, content: <button onClick={() => setColor('Ember')}>Ember</button> },
      { key: 'size', label: 'Size', title: 'Size', summary: '3 × 3', content: <div>Size selector</div> },
    ];
    return <WizardShell styles={wizardLayout('#88e59a', '#367347', true)} mode="WORM" accent="#88e59a" categories={categories} active={step}
      onSelect={setStep} onBack={() => setStep(0)} onPrimary={() => step === 0 ? setStep(1) : finish(color)} finishLabel="Play" />;
  }
  render(<Setup />);
  expect(host.querySelectorAll('h1')).toHaveLength(1);
  click([...host.querySelectorAll('button')].find(b => b.textContent === 'Ember'));
  click([...host.querySelectorAll('button')].find(b => b.textContent.startsWith('Next')));
  const tabs = host.querySelectorAll('[aria-label="Setup categories"] button');
  act(() => tabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })));
  expect(host.textContent).toContain('Live preview: Ember');
  click(tabs[1]);
  click([...host.querySelectorAll('button')].find(b => b.textContent.startsWith('Play')));
  expect(finish).toHaveBeenCalledWith('Ember');
  expect(host.textContent).not.toMatch(/Configure your run|Confirm .* Continue/);
});

it('skips hidden controls when trapping focus and includes opened disclosures', () => {
  function Dialog() {
    const ref = useRef(null), onKeyDown = useDialogBehavior(ref);
    return <div ref={ref} onKeyDown={onKeyDown} role="dialog"><button>Resume</button>
      <details><summary>Controls</summary><button>Sound</button></details>
    </div>;
  }
  render(<Dialog />);
  const resume = host.querySelector('button'), summary = host.querySelector('summary'), sound = host.querySelectorAll('button')[1];
  const tab = () => act(() => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
  expect(document.activeElement).toBe(resume);
  summary.focus(); tab(); expect(document.activeElement).toBe(resume);
  host.querySelector('details').open = true; sound.focus(); tab(); expect(document.activeElement).toBe(resume);
});
