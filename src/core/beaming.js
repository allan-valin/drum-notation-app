import { NoteValue } from './noteValue.js';

/**
 * Runs of consecutive sounding cells that should share a beam, so a subdivided beat reads as
 * one gesture. Only values shorter than a quarter beam at all; a rest ends the run.
 * Returns [start, end] index pairs, inclusive. A one-cell run means a flag, not a beam.
 */
export function beamGroups(beat) {
  if (beat.division.divisionsPerWhole <= NoteValue.QUARTER.divisionsPerWhole) return [];
  const groups = [];
  let start = null;
  beat.cells.forEach((cell, i) => {
    if (cell.notes.length > 0) {
      if (start === null) start = i;
    } else if (start !== null) {
      groups.push([start, i - 1]);
      start = null;
    }
  });
  if (start !== null) groups.push([start, beat.cells.length - 1]);
  return groups;
}
