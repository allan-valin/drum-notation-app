/** Written note values, by how many of them fill a whole note. Order matters: the palette lists them this way. */
export const NoteValue = Object.freeze({
  WHOLE: Object.freeze({ id: 'whole', divisionsPerWhole: 1 }),
  HALF: Object.freeze({ id: 'half', divisionsPerWhole: 2 }),
  QUARTER: Object.freeze({ id: 'quarter', divisionsPerWhole: 4 }),
  EIGHTH: Object.freeze({ id: 'eighth', divisionsPerWhole: 8 }),
  SIXTEENTH: Object.freeze({ id: 'sixteenth', divisionsPerWhole: 16 }),
  THIRTY_SECOND: Object.freeze({ id: 'thirtySecond', divisionsPerWhole: 32 }),
});

export const NOTE_VALUES = Object.freeze(Object.values(NoteValue));

/** Look a value up by its id (what JSON stores). */
export function noteValueById(id) {
  const v = NOTE_VALUES.find((n) => n.id === id);
  if (!v) throw new Error(`unknown note value: ${id}`);
  return v;
}

/** The value whose length is one beat of a time signature with denominator `den`. */
export function noteValueFor(den) {
  return NOTE_VALUES.find((n) => n.divisionsPerWhole === den) ?? NoteValue.QUARTER;
}

/**
 * How many cells a beat is split into when it is subdivided by `value`.
 *
 * A tuplet replaces the count outright: a triplet is three cells whatever value is written
 * inside it. Values at or longer than the beat collapse to a single cell, so choosing a half
 * note in 4/4 does not produce a fractional grid.
 */
export function cellsPerBeat(value, beatUnit, tuplet = null) {
  if (tuplet) return tuplet;
  const cells = Math.floor(value.divisionsPerWhole / beatUnit);
  return cells < 1 ? 1 : cells;
}
