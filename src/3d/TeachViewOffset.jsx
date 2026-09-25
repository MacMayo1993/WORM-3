// TeachViewOffset — keeps the cube in the open sky above the Teach lesson sheet.
//
// On a phone the lesson sheet docks along the bottom, and a camera centred on the
// whole screen put half the puzzle behind it. While a lesson is open on a narrow
// screen the projection is shifted up by half the sheet's height, so the cube is
// centred in the space that is still visible. Picking stays exact: raycasts use
// the same shifted projection. Nothing moves in the world and the orbit is
// unchanged; closing the sheet clears the offset.
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useGameStore } from '../hooks/useGameStore.js';

const NARROW_MAX = 640;
const SHEET = '.teach-course:not(.teach-course-map)';

export default function TeachViewOffset() {
  const active = useGameStore(s => s.teachCourseActive);
  const camera = useThree(s => s.camera);
  const width = useThree(s => s.size.width);
  const height = useThree(s => s.size.height);

  useEffect(() => {
    if (!active || width > NARROW_MAX) return undefined;
    let lift = -1;
    // The sheet is lazy-loaded and changes height with each lesson and with
    // Explain, so it is sampled a few times a second rather than every frame.
    const apply = () => {
      const sheet = document.querySelector(SHEET);
      const next = sheet ? Math.round(Math.min(sheet.getBoundingClientRect().height, height * 0.6) / 2) : 0;
      if (next === lift) return;
      lift = next;
      if (lift) camera.setViewOffset(width, height, 0, lift, width, height);
      else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    };
    apply();
    const timer = setInterval(apply, 250);
    return () => {
      clearInterval(timer);
      camera.clearViewOffset();
      camera.updateProjectionMatrix();
    };
  }, [active, camera, width, height]);

  return null;
}
