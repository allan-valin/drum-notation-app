/** Pulses per quarter note. 960 divides by 2, 3, 4, 5, 6 and 8, so tuplets stay whole. */
export const PPQ = 960;

/** Tick offset of each cell from the start of the beat. Derived, never stored. */
export function cellTicks(beat, beatUnit) {
  const beatTicks = (PPQ * 4) / beatUnit;
  const step = beatTicks / beat.cells.length;
  return beat.cells.map((_, i) => i * step);
}

export function barTicks(score) {
  return score.timeSigNum * ((PPQ * 4) / score.timeSigDen);
}
