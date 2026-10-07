import { accessoryFraming, ACCESSORY_SLOTS, WORM_ACCESSORIES, EMPTY_ACCESSORIES } from '../../worm/handmadeAccessoriesData.js';
import React, { useId, useRef, useState } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { getWormCharacter } from '../../worm/wormCharacterData.js';
import { characterUnlockLevels, WORM_UNLOCK_ORDER } from '../../worm/wormUnlocks.js';
import { WORM_SKINS, WORM_HATS, getSkin, getHat } from '../../worm/wormCosmeticsData.js';
import { RUBIKS_CLASSIC } from '../../utils/constants.js';
import WormPreviewCanvas from '../../3d/WormPreviewCanvas.jsx';
import { wormMenuFeedback } from './wormMenuFeedback.js';
import './wormProfile.css';

const SLOT_ICONS = { face: '◉', neck: '⋈', body: '▧', tail: '〰' };
const CATEGORIES = [
  // Worms appear in the order levels unlock them.
  { id: 'character', label: 'Worm', icon: '∿', title: 'Choose your crawler', items: WORM_UNLOCK_ORDER.map(getWormCharacter) },
  { id: 'skin', label: 'Color', icon: '◐', title: 'Find your color', items: WORM_SKINS },
  { id: 'hat', label: 'Hats', icon: '♧', title: 'Top it off', items: WORM_HATS },
  ...ACCESSORY_SLOTS.map(slot => ({ id: slot, icon: SLOT_ICONS[slot], label: slot[0].toUpperCase() + slot.slice(1),
    title: `${slot[0].toUpperCase() + slot.slice(1)} pieces`, items: [{ id: 'none', label: 'None' }, ...WORM_ACCESSORIES.filter(item => item.slot === slot)] }))
];

// Stats are shown as a strip of five cube stickers, lit in one of the cube's
// face colours, so the character sheet reads as part of the same toy.
const STATS = [
  { key: 'speed', label: 'Speed', color: RUBIKS_CLASSIC.orange },
  { key: 'healing', label: 'Healing', color: RUBIKS_CLASSIC.green },
  { key: 'agility', label: 'Agility', color: RUBIKS_CLASSIC.blue },
  { key: 'glow', label: 'Glow', color: RUBIKS_CLASSIC.yellow }
];
const statStickers = value => Math.max(1, Math.min(5, Math.round((value ?? 0) / 20)));

function StatStickers({ stats }) {
  return <dl className="worm-profile-stats">
    {STATS.map(stat => {
      const lit = statStickers(stats?.[stat.key]);
      return <div key={stat.key} style={{ '--stat-color': stat.color }}>
        <dt>{stat.label}</dt>
        <dd aria-label={`${lit} of 5`}>{[0, 1, 2, 3, 4].map(i => <i key={i} data-lit={i < lit} />)}</dd>
      </div>;
    })}
  </dl>;
}

const pick = list => list[Math.floor(Math.random() * list.length)];

// Both entry paths edit the same persisted equipment; arena settings never own it.
export default function WormProfile({ defaultExpanded = false }) {
  const id = useId();
  const tabs = useRef([]);
  const editButton = useRef(null);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [category, setCategory] = useState('character');
  // Bumped on every change so the stage replays its little "ta-da".
  const [pop, setPop] = useState(0);
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
  const ownedIn = cat => item => item.id === 'none' || !!demoMode || ownedItems.includes(`${ACCESSORY_SLOTS.includes(cat.id) ? 'accessory' : cat.id}_${item.id}`);
  const isOwned = ownedIn(picker);
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
  const equip = (cat, itemId) => {
    if (ACCESSORY_SLOTS.includes(cat)) setAccessory(cat, itemId); else setters[cat](itemId);
  };
  // Dress up at random from what the player owns: one tap, a whole new worm.
  const shuffle = () => {
    wormMenuFeedback();
    for (const cat of CATEGORIES) equip(cat.id, pick(cat.items.filter(ownedIn(cat))).id);
    setPop(value => value + 1);
  };
  const loadout = CATEGORIES.slice(2).filter(cat => selected[cat.id] && selected[cat.id] !== 'none');
  const preview = <div className="worm-profile-preview" aria-hidden="true">
    <WormPreviewCanvas characterId={characterId} skinId={skinId} hatId={hatId} accessories={equipment}
      size={expanded ? 400 : 112} aspect={expanded ? 1.6 : 1} maxRenderPixels={expanded ? 640 : 224} animated={expanded}
      framing={expanded ? 'character' : 'portrait'} style={{ width: '100%', height: 'auto', aspectRatio: expanded ? '1.6' : '1' }} />
  </div>;
  const identity = <div className="worm-profile-identity">
    <strong>{character.label}</strong>
    <span>{skin.label} · {hat.id === 'none' ? 'No hat' : hat.label}</span>
  </div>;

  return <section className={`worm-profile${expanded ? ' worm-profile-expanded' : ''}`} aria-labelledby={`${id}-title`}
    style={{ '--profile-color': skin.body, '--profile-belly': skin.belly, '--profile-light': skin.antenna }}>
    <header className="worm-profile-header">
      <div><h2 id={`${id}-title`}>YOUR WORM</h2></div>
      {expanded && <button type="button" className="worm-profile-shuffle" onClick={shuffle}>
        Shuffle <span aria-hidden="true">⚄</span>
      </button>}
      <button ref={editButton} type="button" className="worm-profile-edit" aria-expanded={expanded} aria-controls={`${id}-editor`}
        onClick={() => { wormMenuFeedback(); setExpanded(value => !value); }}>
        {expanded ? 'Done' : 'Customize'} <span aria-hidden="true">{expanded ? '✓' : '✎'}</span>
      </button>
    </header>
    {!expanded ? <div className="worm-profile-summary">
      {preview}
      <div className="worm-profile-summary-copy">
        <span className="worm-profile-type">{character.type}</span>
        {identity}
      </div>
    </div> :
      <div id={`${id}-editor`} className="worm-profile-editor">
        <div className="worm-profile-hero">
          <div className="worm-profile-stage-art">
            {preview}
            <i className="worm-profile-pop" key={pop} aria-hidden="true" />
          </div>
          <div className="worm-profile-sheet">
            <div className="worm-profile-nameplate">
              <span className="worm-profile-type">{character.type}</span>
              {identity}
            </div>
            <StatStickers stats={character.stats} />
            <p className="worm-profile-ability"><b>{character.special.split(' — ')[0]}</b>{character.special.includes(' — ') && <> — {character.special.split(' — ').slice(1).join(' — ')}</>}</p>
            <div className="worm-profile-loadout" aria-label="Equipped pieces">
              {loadout.map(cat => <span key={cat.id}><i aria-hidden="true">{cat.icon}</i>{equippedLabel(cat)}</span>)}
            </div>
          </div>
        </div>
        <div className="worm-profile-closet">
          <div className="worm-profile-categories" role="tablist" aria-label="Worm profile categories" aria-orientation="vertical">
            {CATEGORIES.map((item, index) => <button key={item.id} ref={el => { tabs.current[index] = el; }} type="button"
              role="tab" id={`${id}-tab-${item.id}`} aria-label={item.label} aria-selected={category === item.id}
              aria-controls={`${id}-panel`} tabIndex={category === item.id ? 0 : -1}
              onKeyDown={event => onTabKeyDown(event, index)} onClick={() => chooseCategory(index)}>
              <i aria-hidden="true">{item.icon}</i><span><strong>{item.label}</strong><small>{equippedLabel(item)}</small></span>
            </button>)}
          </div>
          <div className="worm-profile-panel" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${category}`} tabIndex={0}>
            <div className="worm-profile-panel-heading"><h3>{picker.title}</h3><span>{picker.items.filter(isOwned).length} / {picker.items.length} owned</span></div>
            <div className={`worm-profile-options worm-profile-options-${category === 'skin' ? 'skin' : 'model'}`} role="group" aria-label={`${picker.label} options`} key={category}>
              {picker.items.map(item => {
                const owned = isOwned(item), equipped = selected[category] === item.id;
                return <button type="button" key={item.id} disabled={!owned} aria-pressed={equipped}
                  aria-label={`${item.label}${owned ? '' : ', locked'}`} className="worm-profile-option"
                  style={category === 'skin' ? { '--swatch-body': item.body, '--swatch-belly': item.belly, '--swatch-light': item.antenna } : undefined}
                  onClick={() => { if (owned) { wormMenuFeedback(); equip(category, item.id); setPop(value => value + 1); } }}>
                  <span aria-hidden="true" className="worm-profile-option-art">
                    {category === 'skin' ? <span className="worm-profile-swatch"><i /><i /><i /></span> :
                      item.id === 'none' ? <span className="worm-profile-none">∅</span> :
                      <WormPreviewCanvas characterId={category === 'character' ? item.id : characterId}
                        skinId={skinId} hatId={category === 'hat' ? item.id : hatId} size={84}
                        accessories={accessorySlot ? { ...equipment, [category]: item.id } : equipment}
                        framing={accessorySlot ? accessoryFraming(category) : category === 'hat' ? 'head' : 'portrait'} />}
                    {equipped && <b className="worm-profile-check">✓</b>}
                    {!owned && <b className="worm-profile-lock">🔒</b>}
                  </span>
                  <strong>{item.label}</strong>
                  <small>{!owned ? category === 'character' ? `Clear ${characterUnlockLevels(item.id)} levels` : 'In the Store' : equipped ? 'Equipped' : category === 'character' ? item.type : 'Equip'}</small>
                </button>;
              })}
            </div>
            <p className="worm-profile-note">Unlock more in the Store.</p>
          </div>
        </div>
      </div>}
    {expanded && <footer className="worm-profile-footer"><span><b aria-hidden="true">✓</b> Saved</span>
      <button type="button" onClick={() => { wormMenuFeedback(); setExpanded(false); editButton.current?.focus(); }}>Done <span aria-hidden="true">✓</span></button>
    </footer>}
  </section>;
}
