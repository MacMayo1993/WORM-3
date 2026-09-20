import React from 'react';
import WormPreviewCanvas from '../3d/WormPreviewCanvas.jsx';
import CubePreviewCanvas from '../3d/CubePreviewCanvas.jsx';
import { COLOR_SCHEMES } from '../utils/colorSchemes.js';
import { getStoreItem } from '../utils/storeCatalog.js';
import { CHEST_TIERS } from './chests.js';

function RewardPreview({ item }) {
  if (item.type === 'scheme' || item.type === 'tile') {
    return <CubePreviewCanvas px={88} size={3} animated={false} interactive={false}
      colors={COLOR_SCHEMES[item.schemeKey] ?? COLOR_SCHEMES.standard} tileStyle={item.tileKey ?? 'solid'} />;
  }
  if (item.type === 'trail') {
    return <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5, 6].map(i => <circle key={i} cx={12 + i * 10} cy={44 + Math.sin(i) * 13}
        r={9 - i} fill={item.body ?? item.glow ?? '#a8db82'} opacity={1 - i * .1} />)}
    </svg>;
  }
  return <WormPreviewCanvas size={88} characterId={item.characterId ?? 'classic'}
    skinId={item.skinId ?? 'slime'} hatId={item.hatId ?? 'none'} framing={item.type === 'hat' ? 'head' : 'body'} />;
}

export default function ChestRewardChoices({ receipt, ownedItems, onChoose }) {
  const tier = CHEST_TIERS[receipt.tier];
  return <section className="chest-choices" aria-labelledby="chest-choice-title" style={{ '--choice-tier': tier.color }}>
    <h2 id="chest-choice-title">CHOOSE YOUR REWARD</h2>
    <p>Pick one to keep. {receipt.reward.itemIds.length < 3 ? 'These are the remaining unowned rewards from your roll.' : 'Three discoveries. One new favorite.'}</p>
    <div className="chest-choice-grid">{receipt.reward.itemIds.map(id => {
      const item = getStoreItem(id), owned = ownedItems.includes(id);
      return <button key={id} className="chest-choice-card" onClick={() => onChoose(id)} aria-label={`Choose ${item.label}`}>
        <span className="chest-choice-art" aria-hidden="true"><RewardPreview item={item} /></span>
        <span className="chest-choice-copy"><strong>{item.label}</strong><small>{owned ? `Already owned · ${tier.compensation} gems instead` : tier.name}</small></span>
        <span className="chest-choice-cta">Choose →</span>
      </button>;
    })}</div>
    <p className="chest-choice-note">Your choices are saved. You can come back to them anytime.</p>
  </section>;
}
