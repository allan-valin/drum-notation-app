import { cellsPerBeat, noteValueFor } from './noteValue.js';

export const Articulation = Object.freeze({
  ACCENT: 'accent',
  GHOST: 'ghost',
  STACCATO: 'staccato',
  TENUTO: 'tenuto',
  MARCATO: 'marcato',
  FERMATA: 'fermata',
  BREATH: 'breath',
  CRESCENDO: 'crescendo',
  FORTISSIMO: 'ff',
  PIANISSIMO: 'pp',
});

export const Sticking = Object.freeze({ R: 'R', L: 'L' });

/** Technique marks drawn above the note. */
export const Mark = Object.freeze({
  OPEN: 'open', CLOSED: 'closed', HALF_OPEN: 'halfOpen', CHOKE: 'choke',
  // jazz horn effects
  FALL: 'fall', DOIT: 'doit', SCOOP: 'scoop', PLOP: 'plop',
  // strings and ornaments
  PIZZ: 'pizz', ARCO: 'arco', DOWN_BOW: 'downBow', UP_BOW: 'upBow', HARMONIC: 'harmonic', TRILL: 'trill',
});
export const Roll = Object.freeze({ BUZZ: 'buzz', TREMOLO: 'tremolo' });
export const Grace = Object.freeze({ FLAM: 'flam', DRAG: 'drag' });

/**
 * One hit. `slotId` says which instrument, by naming a slot on the staff. `head` overrides the
 * slot's notehead (diamond for a bell, X on the snare line for cross-stick); `marks` sit above,
 * `roll` on the stem, `grace` before the head.
 */
export function note(slotId, { articulations = [], sticking = null, head = null, marks = [], roll = null, grace = null, alter } = {}) {
  const n = { slotId, articulations: [...articulations], sticking, head, marks: [...marks], roll, grace };
  // pitched notes only: semitones from the written letter (halves are quarter tones)
  if (alter !== undefined && alter !== null) n.alter = alter;
  return n;
}

/**
 * A cell is either a leaf (one point in time: the notes in it sound together) or a group
 * (a span split into equal cells, each of which can be split again). A beat is a group.
 */
export function leaf(notes = [], { cont = false } = {}) {
  // cont: this cell continues the note before it (a tie); it has no notes of its own
  return cont ? { notes: [], cont: true } : { notes: [...notes] };
}

export function group(division, tuplet, cells) {
  return { division, tuplet: tuplet ?? null, cells: [...cells] };
}

/** Old names, kept because a beat is a group and a flat cell is a leaf. */
export const cell = leaf;
export const beat = group;

export function bar(beats, { timeSig = null, key = null, simile = false, repeatStart = false, repeatEnd = false, text = '' } = {}) {
  return { beats: [...beats], timeSig, key, simile, repeatStart, repeatEnd, text };
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

/** The key signature (fifths: + sharps, − flats) in force at bar `index`; C major before any. */
export function barKey(score, index) {
  for (let i = index; i >= 0; i--) {
    const k = score.bars[i]?.key;
    if (k !== null && k !== undefined) return k;
  }
  return 0;
}

/** True where the key signature must be printed: the first bar if not C, and wherever it changes. */
export function showsKey(score, index) {
  if (index === 0) return barKey(score, 0) !== 0;
  return barKey(score, index - 1) !== barKey(score, index);
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
  swing = false,
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
    swing,
    bars: bars ?? [emptyBar(timeSigNum, timeSigDen)],
    createdAt,
    updatedAt,
  };
}
