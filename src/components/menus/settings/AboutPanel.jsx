import React from 'react';
import {
  CC_BY_4, ENVIRONMENT_CREDITS, ENVIRONMENT_SOURCE, FONT_CREDITS, FONT_LICENSE, MODEL_CHANGES, MODEL_CREDITS, SOFTWARE_CREDITS
} from '../../../utils/credits.js';

const muted = { fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', lineHeight: '1.5', margin: '0 0 10px' };
const list = { margin: '0 0 8px', paddingLeft: '18px', fontSize: '13px', color: 'rgba(255, 255, 255, 0.85)', lineHeight: '1.6' };
const link = { color: 'inherit', textDecoration: 'underline' };

const External = ({ href, children }) => <a style={link} href={href} target="_blank" rel="noopener noreferrer">{children}</a>;

export function AboutPanel() {
  return (
    <>
      <section className="settings-section">
        <h3 className="settings-section-title">WORM³</h3>
        <p style={muted}>Made by Mac Mayo. Thank you to everyone whose work is in the game.</p>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-title">3D models</h3>
        <p style={muted}>
          The biome backdrops use these models from Sketchfab, licensed under{' '}
          <External href={CC_BY_4.url}>{CC_BY_4.name}</External>. {MODEL_CHANGES}
        </p>
        <ul style={list}>
          {MODEL_CREDITS.map(model => (
            <li key={model.file}>
              <External href={model.source}>{model.title}</External> by <External href={model.authorUrl}>{model.author}</External>
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-title">Skies</h3>
        <p style={muted}>
          {ENVIRONMENT_CREDITS.map(map => map.title).join(' and ')} environment maps from{' '}
          <External href={ENVIRONMENT_SOURCE.url}>{ENVIRONMENT_SOURCE.name}</External> ({ENVIRONMENT_SOURCE.license}).
        </p>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-title">Type and code</h3>
        <p style={muted}>
          Set in {FONT_CREDITS.join(', ')} under the <External href={FONT_LICENSE.url}>{FONT_LICENSE.name}</External>.
          Built with {SOFTWARE_CREDITS.join(', ')} and other open-source libraries, each under its own licence.
        </p>
      </section>
    </>
  );
}
