import { leafSpans } from './tree.js';

/** How many beams (or flag strokes) a value carries. */
export function beamLevel(value) {
  const n = value.divisionsPerWhole;
  if (n >= 32) return 3;
  if (n >= 16) return 2;
  if (n >= 8) return 1;
  return 0;
}

/**
 * Beams of a beat, nested cells included. Leaves are numbered depth first. A beam at level L
 * spans each run of consecutive sounding leaves whose value carries at least L beams. A run
 * of one at level 1 is a flag, not a beam. A run of one at a deeper level sits under a longer
 * beam and gets a stub pointing at its neighbour in that beam.
 */
export function beams(beat) {
  const leaves = leafSpans(beat).map((l) => ({ sounding: l.leaf.notes.length > 0, level: beamLevel(l.parent.division) }));
  const out = [];
  const maxLevel = Math.max(0, ...leaves.map((l) => l.level));
  const level1 = runs(leaves, 1);
  for (let L = 1; L <= maxLevel; L++) {
    for (const [from, to] of runs(leaves, L)) {
      if (from !== to) { out.push({ level: L, from, to }); continue; }
      if (L === 1) continue;
      const host = level1.find(([a, b]) => from >= a && from <= b && a !== b);
      if (!host) continue;
      out.push({ level: L, from, to, stub: from > host[0] ? 'left' : 'right' });
    }
  }
  return out;
}

function runs(leaves, level) {
  const out = [];
  let start = null;
  leaves.forEach((l, i) => {
    if (l.sounding && l.level >= level) {
      if (start === null) start = i;
    } else if (start !== null) {
      out.push([start, i - 1]);
      start = null;
    }
  });
  if (start !== null) out.push([start, leaves.length - 1]);
  return out;
}

/** Level-1 runs as [from, to] leaf indices, flags included (a run of one). */
export function beamGroups(beat) {
  const leaves = leafSpans(beat).map((l) => ({ sounding: l.leaf.notes.length > 0, level: beamLevel(l.parent.division) }));
  return runs(leaves, 1);
}
