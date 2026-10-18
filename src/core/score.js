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

/** One point in time. Several notes here sound together: kick plus hi-hat. */
export function cell(notes = []) {
  return { notes: [...notes] };
}

/**
 * One beat, carrying its own subdivision. Subdivision is per beat and not a bar-wide grid,
 * because that is how a page reads: a triplet on beat 1 and two eighths on beat 2.
 */
export function beat(division, tuplet, cells) {
  return { division, tuplet: tuplet ?? null, cells: [...cells] };
}

export function bar(beats) {
  return { beats: [...beats] };
}

export function emptyBeat(division, beatUnit, tuplet = null) {
  return beat(division, tuplet, Array.from({ length: cellsPerBeat(division, beatUnit, tuplet) }, () => cell()));
}

/** A fresh bar: one cell per beat, nothing written yet. */
export function emptyBar(timeSigNum, timeSigDen) {
  return bar(Array.from({ length: timeSigNum }, () => emptyBeat(noteValueFor(timeSigDen), timeSigDen)));
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
