import { leafSpans } from './tree.js';
import { barTimeSig } from './score.js';

/** Pulses per quarter note. 960 divides by 2, 3, 4, 5, 6 and 8, so tuplets stay whole. */
export const PPQ = 960;

export function beatTicks(beatUnit) {
  return (PPQ * 4) / beatUnit;
}

/** Each leaf of a beat with its tick offset and length. Derived, never stored. */
export function leafTicks(beat, beatUnit) {
  const total = beatTicks(beatUnit);
  return leafSpans(beat).map((l) => ({ path: l.path, tick: Math.round(l.start * total), length: Math.round(l.size * total), leaf: l.leaf }));
}

/** Tick offsets of the leaves in a beat (flat beats: one per cell). */
export function cellTicks(beat, beatUnit) {
  return leafTicks(beat, beatUnit).map((l) => l.tick);
}

export function barTicks(score, index = 0) {
  const [num, den] = barTimeSig(score, index);
  return num * beatTicks(den);
}
