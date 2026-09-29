import { UI_CSS_VARS, ARCADE_INK_STRONG } from '../utils/uiTheme.js';
import fonts from '../fonts.css?inline';
import displayFont from '@fontsource/bungee/latin-400.css?inline';
import editorStyles from './creatorFrame.css?inline';

const CATEGORIES = [
  ['pattern', 'Pattern', ['Symmetry', 'Motif']],
  ['draw', 'Draw', ['Draw your own']],
  ['colors', 'Colors', ['Color']],
  ['motion', 'Motion', ['Motion', 'Display', 'Journey and sound']],
  ['looks', 'Looks', ['Save and share']],
];

// Same-origin iframe documents don't inherit the game's CSS or @font-face rules.
// Install the actual shared tokens and bundled font declarations, then reorganize
// existing controls without replacing them (their drawing-engine listeners stay).
export function installCreatorTheme(doc, accent) {
  if (!doc?.querySelector('#kaleidoApp aside') || doc.getElementById('worm-creator-theme')) return;
  for (const [key, value] of Object.entries(UI_CSS_VARS)) doc.documentElement.style.setProperty(key, value);
  doc.documentElement.style.setProperty('--mode-accent', accent);
  doc.documentElement.style.setProperty('--mode-ink', ARCADE_INK_STRONG);
  doc.documentElement.dataset.theme = 'light';
  const style = doc.createElement('style'); style.id = 'worm-creator-theme';
  style.textContent = fonts + displayFont + editorStyles;
  doc.head.append(style); doc.body.classList.add('worm-setup');
  const aside = doc.querySelector('#kaleidoApp aside');
  const sections = [...aside.querySelectorAll(':scope > details')];
  const nav = doc.createElement('nav'); nav.className = 'creator-categories'; nav.setAttribute('aria-label', 'Background categories');
  const controls = doc.createElement('div'); controls.className = 'creator-controls';
  const buttons = [], panels = [];
  const select = index => {
    panels.forEach((panel, i) => { panel.hidden = i !== index; });
    buttons.forEach((button, i) => i === index ? button.setAttribute('aria-current', 'true') : button.removeAttribute('aria-current'));
    controls.scrollTop = 0;
  };
  CATEGORIES.forEach(([id, label, headings], index) => {
    const panel = doc.createElement('section'); panel.id = `creator-panel-${id}`;
    panel.className = 'creator-panel'; panel.setAttribute('aria-labelledby', `creator-tab-${id}`);
    if (id === 'pattern') panel.append(aside.querySelector('.top'));
    for (const section of sections) if (headings.includes(section.querySelector('summary').textContent)) {
      section.open = true; panel.append(section);
    }
    const button = doc.createElement('button'); button.type = 'button'; button.id = `creator-tab-${id}`;
    button.textContent = label; button.setAttribute('aria-controls', panel.id);
    button.addEventListener('click', () => select(index));
    button.addEventListener('keydown', e => {
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? CATEGORIES.length - 1
        : ['ArrowRight', 'ArrowDown'].includes(e.key) ? (index + 1) % CATEGORIES.length
        : ['ArrowLeft', 'ArrowUp'].includes(e.key) ? (index + CATEGORIES.length - 1) % CATEGORIES.length : null;
      if (next == null) return;
      e.preventDefault(); select(next); buttons[next].focus();
    });
    buttons.push(button); panels.push(panel); nav.append(button); controls.append(panel);
  });
  aside.prepend(nav); aside.append(controls); select(0);
}
