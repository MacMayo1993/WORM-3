// Meaning belongs to the action, never to a tile's palette or visual skin.
// Shapes and words accompany every colour so the cues survive Random mode.
export const ACTION_CUES = Object.freeze({
  link: { label: 'Linked pair', symbol: '↔', color: '#80dfff', deep: '#338fb5', description: 'Double rings mark a pair. These two tile identities stay linked when layers turn. A flip changes both.' },
  turn: { label: 'Layer turn', symbol: '↻', color: '#ffe7ae', deep: '#ff9c1c', description: 'Arrows show the layer and direction of travel. Pieces move with that layer.' },
  target: { label: 'Your target', symbol: '◇', color: '#e8ff9a', deep: '#91b544', description: 'Diamond outlines mark the tile or route the challenge asks you to reach.' },
  danger: { label: 'Danger', symbol: '△', color: '#ff9494', deep: '#c84b55', description: 'Read the warning before entering. A marked route can be unsafe even when it is linked.' },
  complete: { label: 'Complete', symbol: '✓', color: '#9ce8b1', deep: '#468d5a', description: 'The game has confirmed the goal. Linked or highlighted alone does not mean complete.' },
});

export const actionCue = kind => ACTION_CUES[kind] ?? ACTION_CUES.target;
