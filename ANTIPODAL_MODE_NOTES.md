# Antipodal Mode Technical Notes

## Echo Rotation Animation

As of the latest update, echo rotations now display **animated rotation** instead of instant state updates. This provides visual feedback that the antipodal layer is rotating automatically.

### Visual Indicators

1. **Echo Rotation Indicator**: A colored, pulsing overlay appears during echo rotations
   - Green for X-axis (col)
   - Blue for Y-axis (row)
   - Red for Z-axis (depth)
   - Label shows which layer is rotating (e.g., "Echo: Top", "Echo: Back")

2. **Animation Queueing**: If a user initiates a rotation while an echo is pending, the echo will be queued and play after the user's rotation completes

3. **Sound Differentiation**: Echo rotations play at 70% volume to distinguish them from user-initiated rotations

## Parity Considerations

### Important: Flip Parity is Always Even

In WORM-3's implementation, **flip operations always flip BOTH antipodal stickers simultaneously**. This is mathematically consistent with RP² topology where antipodal points are identified.

**Implications:**
- When you flip one sticker, its antipodal pair is automatically flipped too
- Each flip operation increments the flip counter by **2** (one for each sticker)
- Therefore, the total flip count (parity) will **always be even** (0, 2, 4, 6, ...)
- The parity indicator showing "ODD" or "EVEN" refers to whether the flip count is divisible by 2, which in this implementation is always EVEN

**Code Reference:**
```javascript
// src/game/manifoldLogic.js lines 156-157
applyFlip(sticker1Loc);  // Flip first sticker
applyFlip(sticker2Loc);  // Flip antipodal pair
```

**Why This Makes Sense:**
- RP² topology identifies antipodal points as the same point
- Flipping one means flipping both (they're the same in the quotient space)
- This maintains topological consistency

### Antipodal Mode and Parity

When **Antipodal Mode** is enabled:
- Rotations trigger echo rotations on antipodal layers
- These echo rotations do NOT increment the move counter
- Only user-initiated rotations count toward the move total
- Flip parity remains always even regardless of Antipodal Mode setting

## Performance Notes

- Echo animations use the same animation system as user rotations
- GSAP handles timing for echo delays (default: 0.2s, range: 0.05s - 0.8s)
- Visual effects are GPU-accelerated via Three.js
- Low intensity mode disables effects for better performance on lower-end devices
