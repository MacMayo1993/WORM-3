import { accessoryFraming, ACCESSORY_SLOTS, WORM_ACCESSORIES, EMPTY_ACCESSORIES } from '../../worm/handmadeAccessoriesData.js';
import React, { useId, useRef, useState } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { WORM_CHARACTERS, getWormCharacter } from '../../worm/wormCharacterData.js';
import { WORM_SKINS, WORM_HATS, getSkin, getHat } from '../../worm/wormCosmeticsData.js';
import WormPreviewCanvas from '../../3d/WormPreviewCanvas.jsx';
import { wormMenuFeedback } from './wormMenuFeedback.js';
import './wormProfile.css';

const SLOT_ICONS = { face: '◉', neck: '⋈', body: '▧', tail: '〰' };
const CATEGORIES = [
  { id: 'character', label: 'Worm', icon: '∿', title: 'Choose your crawler', items: WORM_CHARACTERS },
  { id: 'skin', label: 'Color', icon: '◐', title: 'Find your color', items: WORM_SKINS },
  { id: 'hat', label: 'Hats', icon: '♧', title: 'Top it off', items: WORM_HATS },
  ...ACCESSORY_SLOTS.map(slot => ({ id: slot, icon: SLOT_ICONS[slot], label: slot[0].toUpperCase() + slot.slice(1),
    title: `${slot[0].toUpperCase() + slot.slice(1)} pieces`, items: [{ id: 'none', label: 'None' }, ...WORM_ACCESSORIES.filter(item => item.slot === slot)] }))
];

// Both entry paths edit the same persisted equipment; arena settings never own it.
export default function WormProfile({ defaultExpanded = false }) {
  const id = useId();
  const tabs = useRef([]);
  const editButton = useRef(null);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [category, setCategory] = useState('character');
  const characterId = useGameStore(s => s.wormCharacter ?? 'classic');
  const skinId = useGameStore(s => s.wormSkin ?? 'slime');
  const hatId = useGameStore(s => s.wormHat ?? 'none');
  const equipment = useGameStore(s => s.wormAccessories ?? EMPTY_ACCESSORIES);
  const setAccessory = useGameStore(s => s.setWormAccessory);
  const ownedItems = useGameStore(s => s.ownedItems);
  const demoMode = useGameStore(s => s.demoMode);
  const setCharacter = useGameStore(s => s.setWormCharacter);
  const setSkin = useGameStore(s => s.setWormSkin);
  const setHat = useGameStore(s => s.setWormHat);
  const character = getWormCharacter(characterId);
  const skin = getSkin(skinId);
  const hat = getHat(hatId);
  const selected = { character: characterId, skin: skinId, hat: hatId, ...equipment };
  const setters = { character: setCharacter, skin: setSkin, hat: setHat };
  const accessorySlot = ACCESSORY_SLOTS.includes(category);
  const picker = CATEGORIES.find(item => item.id === category);
  const isOwned = item => item.id === 'none' || !!demoMode || ownedItems.includes(`${accessorySlot ? 'accessory' : category}_${item.id}`);
  const equippedLabel = cat => cat.items.find(item => item.id === selected[cat.id])?.label ?? 'None';
  const chooseCategory = index => { wormMenuFeedback(); setCategory(CATEGORIES[index].id); };
  const onTabKeyDown = (event, index) => {
    let next;
    if (event.key === 'ArrowDown') next = (index + 1) % CATEGORIES.length;
    else if (event.key === 'ArrowUp') next = (index - 1 + CATEGORIES.length) % CATEGORIES.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = CATEGORIES.length - 1;
    else return;
    event.preventDefault(); chooseCategory(next); tabs.current[next]?.focus();
  };
  const preview = <div className="worm-profile-preview" aria-hidden="true">
    <WormPreviewCanvas characterId={characterId} skinId={skinId} hatId={hatId} accessories={equipment}
      size={expanded ? 220 : 112} maxRenderPixels={expanded ? 440 : 224} animated={expanded}
      framing="character" style={{ width: '100%', height: 'auto', aspectRatio: '1' }} />
  </div>;
  const identity = <div className="worm-profile-identity">
    <strong>{character.label}</strong>
    <span>{skin.label} · {hat.id === 'none' ? 'No hat' : hat.label}</span>
    <small>{expanded ? character.type : 'Story & Free Play'}</small>
  </div>;

  return <section className={`worm-profile${expanded ? ' worm-profile-expanded' : ''}`} aria-labelledby={`${id}-title`}
    style={{ '--profile-color': skin.body }}>
    <header className="worm-profile-header">
      <div><h2 id={`${id}-title`}>YOUR WORM</h2>{expanded && <span>Make it yours.</span>}</div>
      <button ref={editButton} type="button" className="worm-profile-edit" aria-expanded={expanded} aria-controls={`${id}-editor`}
        onClick={() => { wormMenuFeedback(); setExpanded(value => !value); }}>
        {expanded ? 'Done' : 'Customize'} <span aria-hidden="true">{expanded ? '✓' : '✎'}</span>
      </button>
    </header>
    {!expanded ? <div className="worm-profile-summary">{preview}{identity}</div> :
      <div id={`${id}-editor`} className="worm-profile-editor">
        <div className="worm-profile-categories" role="tablist" aria-label="Worm profile categories" aria-orientation="vertical">
          {CATEGORIES.map((item, index) => <button key={item.id} ref={el => { tabs.current[index] = el; }} type="button"
            role="tab" id={`${id}-tab-${item.id}`} aria-label={item.label} aria-selected={category === item.id}
            aria-controls={`${id}-panel`} tabIndex={category === item.id ? 0 : -1}
            onKeyDown={event => onTabKeyDown(event, index)} onClick={() => chooseCategory(index)}>
            <i aria-hidden="true">{item.icon}</i><span><strong>{item.label}</strong><small>{equippedLabel(item)}</small></span>
          </button>)}
        </div>
        <div className="worm-profile-workspace">
          <div className="worm-profile-stage">
            <div className="worm-profile-stage-art">{preview}<span className="worm-profile-stage-tag">YOUR LOADOUT</span></div>
            {identity}
            <div className="worm-profile-loadout" aria-label="Equipped pieces">
              {CATEGORIES.slice(2).filter(cat => selected[cat.id] && selected[cat.id] !== 'none').map(cat =>
                <span key={cat.id}>{equippedLabel(cat)}</span>)}
            </div>
            {category === 'character' && <p className="worm-profile-ability">{character.special}</p>}
          </div>
          <div className="worm-profile-panel" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${category}`} tabIndex={0}>
            <div className="worm-profile-panel-heading"><h3>{picker.title}</h3><span>{picker.items.filter(isOwned).length} / {picker.items.length} owned</span></div>
            <div className="worm-profile-options" role="group" aria-label={`${picker.label} options`} key={category}>
              {picker.items.map(item => {
                const owned = isOwned(item), equipped = selected[category] === item.id;
                return <button type="button" key={item.id} disabled={!owned} aria-pressed={equipped}
                  aria-label={`${item.label}${owned ? '' : ', locked'}`} className="worm-profile-option"
                  onClick={() => { if (owned) { wormMenuFeedback(); if (accessorySlot) setAccessory(category, item.id); else setters[category](item.id); } }}>
                  <span aria-hidden="true" className="worm-profile-option-art">
                    {category === 'skin' ? <span className="worm-profile-swatch" style={{ background: item.body, borderColor: item.belly }} /> :
                      <WormPreviewCanvas characterId={category === 'character' ? item.id : characterId}
                        skinId={skinId} hatId={category === 'hat' ? item.id : hatId} size={72}
                        accessories={accessorySlot ? { ...equipment, [category]: item.id } : equipment}
                        framing={accessorySlot ? accessoryFraming(category) : category === 'hat' ? 'head' : 'body'} />}
                  </span>
                  <strong>{item.label}</strong>
                  <small>{!owned ? 'Locked' : equipped ? 'Equipped ✓' : category === 'character' ? item.type : 'Equip'}</small>
                </button>;
              })}
            </div>
            <p className="worm-profile-note">Unlock more in the Store.</p>
          </div>
        </div>
      </div>}
    {expanded && <footer className="worm-profile-footer"><span><b aria-hidden="true">✓</b> Saved for Story & Free Play</span>
      <button type="button" onClick={() => { wormMenuFeedback(); setExpanded(false); editButton.current?.focus(); }}>Ready <span aria-hidden="true">→</span></button>
    </footer>}
  </section>;
}
