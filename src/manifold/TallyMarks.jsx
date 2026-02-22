import React from 'react';
import { Line, Text } from '@react-three/drei';

const TallyMarks = ({ flips, radius, origColor }) => {
  // Calculate full cycles and half cycles
  // Each flip is a half-cycle through the antipodal tunnel
  // 2 flips = 1 complete round-trip cycle
  const halfCycles = flips; // Each flip is a half-cycle
  const fullTallies = Math.floor(halfCycles / 2); // Full tally = 2 half-cycles
  const hasHalfTally = halfCycles % 2 === 1; // Odd parity = half tally

  // Determine contrasting color for tally marks
  // Use dark marks on light colors, light marks on dark colors
  const isLightColor = ['#ffffff', '#eab308', '#f97316'].includes(origColor);
  const tallyColor = isLightColor ? '#1a1a1a' : '#ffffff';

  // Scale tallies to fit within the tracker circle
  const baseScale = Math.min(radius * 1.4, 0.28);
  const lineHeight = baseScale * 0.7;
  const lineSpacing = baseScale * 0.18;
  const strokeWidth = 1.8;

  // Group tallies in sets of 5 (traditional tally: |||| with diagonal)
  const tallyGroups = [];
  let remaining = fullTallies;
  while (remaining > 0) {
    const groupSize = Math.min(remaining, 5);
    tallyGroups.push(groupSize);
    remaining -= groupSize;
  }

  // If no full tallies but has half, we still show something
  if (tallyGroups.length === 0 && hasHalfTally) {
    tallyGroups.push(0);
  }

  // Calculate total width to center the tallies
  const groupWidth = lineSpacing * 5;
  const totalGroups = tallyGroups.length;
  const totalWidth = totalGroups * groupWidth;
  const startX = -totalWidth / 2 + lineSpacing;

  return (
    <group position={[0, 0, 0.015]}>
      {tallyGroups.map((count, groupIndex) => {
        const groupX = startX + groupIndex * groupWidth;
        const lines = [];

        // Draw vertical tally lines for this group
        for (let i = 0; i < count; i++) {
          const x = groupX + i * lineSpacing;
          lines.push(
            <Line
              key={`tally-${groupIndex}-${i}`}
              points={[[x, -lineHeight / 2, 0], [x, lineHeight / 2, 0]]}
              color={tallyColor}
              lineWidth={strokeWidth}
              transparent
              opacity={0.9}
            />
          );
        }

        // Draw diagonal line for groups of 5
        if (count === 5) {
          lines.push(
            <Line
              key={`diag-${groupIndex}`}
              points={[
                [groupX - lineSpacing * 0.3, -lineHeight / 2 - 0.01, 0],
                [groupX + lineSpacing * 4.3, lineHeight / 2 + 0.01, 0]
              ]}
              color={tallyColor}
              lineWidth={strokeWidth}
              transparent
              opacity={0.9}
            />
          );
        }

        return <group key={`group-${groupIndex}`}>{lines}</group>;
      })}

      {/* Half tally - shown as a shorter, slightly faded line */}
      {hasHalfTally && (
        <group>
          <Line
            points={[
              [startX + fullTallies % 5 * lineSpacing + (fullTallies >= 5 ? Math.floor(fullTallies / 5) * groupWidth : 0),
               -lineHeight / 4, 0],
              [startX + fullTallies % 5 * lineSpacing + (fullTallies >= 5 ? Math.floor(fullTallies / 5) * groupWidth : 0),
               lineHeight / 4, 0]
            ]}
            color={tallyColor}
            lineWidth={strokeWidth * 0.8}
            transparent
            opacity={0.6}
          />
          {/* Small dot at top to indicate "incomplete" journey */}
          <mesh position={[
            startX + fullTallies % 5 * lineSpacing + (fullTallies >= 5 ? Math.floor(fullTallies / 5) * groupWidth : 0),
            lineHeight / 4 + 0.02,
            0
          ]}>
            <circleGeometry args={[0.015, 8]} />
            <meshBasicMaterial color={tallyColor} transparent opacity={0.6} />
          </mesh>
        </group>
      )}

      {/* Show flip count as small text for higher counts (keeps marks within tile) */}
      {flips > 6 && (
        <Text
          position={[0, -radius * 0.6, 0.005]}
          fontSize={0.06}
          color={tallyColor}
          anchorX="center"
          anchorY="middle"
          fontWeight="bold"
        >
          ×{flips}
        </Text>
      )}
    </group>
  );
};

export default TallyMarks;
