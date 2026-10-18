import { cellsPerBeat, noteValueFor } from './noteValue.js';

export const Articulation = Object.freeze({
  ACCENT: 'accent',
  GHOST: 'ghost',
  CRESCENDO: 'crescendo',
  FORTISSIMO: 'ff',
  PIANISSIMO: 'pp',
});

export const Sticking = Object.freeze({ R: 'R', L: 'L' });

/** One hit. `slotId` says which instrument, by naming a slot on the staff. */
export function note(slotId, { articulations = [], sticking = null } = {}) {
  return { slotId, articulations: [...articulations], sticking };
}

/**
 * A cell is either a leaf (one point in time: the notes in it sound together) or a group
 * (a span split into equal cells, each of which can be split again). A beat is a group.
 */
export function leaf(notes = []) {
  return { notes: [...notes] };
}

export function group(division, tuplet, cells) {
  return { division, tuplet: tuplet ?? null, cells: [...cells] };
}

/** Old names, kept because a beat is a group and a flat cell is a leaf. */
export const cell = leaf;
export const beat = group;

export function bar(beats, { timeSig = null, simile = false, repeatStart = false, repeatEnd = false } = {}) {
  return { beats: [...beats], timeSig, simile, repeatStart, repeatEnd };
}

export function emptyBeat(division, beatUnit, tuplet = null) {
  return group(division, tuplet, Array.from({ length: cellsPerBeat(division, beatUnit, tuplet) }, () => leaf()));
}

/** A fresh bar: one cell per beat, nothing written yet, inheriting its time signature. */
export function emptyBar(timeSigNum, timeSigDen, opts) {
  return bar(Array.from({ length: timeSigNum }, () => emptyBeat(noteValueFor(timeSigDen), timeSigDen)), opts);
}

/**
 * The signature in force at bar `index`: its own, else the nearest earlier explicit one,
 * else the score's.
 */
export function barTimeSig(score, index) {
  for (let i = index; i >= 0; i--) {
    const ts = score.bars[i]?.timeSig;
    if (ts) return ts;
  }
  return [score.timeSigNum, score.timeSigDen];
}

/** True where the printed signature must appear: the first bar, and wherever it changes. */
export function showsTimeSig(score, index) {
  if (index === 0) return true;
  const a = barTimeSig(score, index - 1);
  const b = barTimeSig(score, index);
  return a[0] !== b[0] || a[1] !== b[1];
}

function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newScore({
  id = newId(),
  title = '',
  profileId = 'drums',
  timeSigNum = 4,
  timeSigDen = 4,
  defaultBpm = 80,
  bars = null,
  createdAt = Date.now(),
  updatedAt = createdAt,
} = {}) {
  return {
    id,
    title,
    profileId,
    timeSigNum,
    timeSigDen,
    defaultBpm,
    bars: bars ?? [emptyBar(timeSigNum, timeSigDen)],
    createdAt,
    updatedAt,
  };
}
