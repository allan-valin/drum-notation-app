import { Glyphs } from './glyphs.js';

/**
 * Written pitch on a staff. A pitched instrument's slots are its lines and spaces, named by
 * written letter and octave ("E4"); the sounding pitch adds the note's `alter` (semitones,
 * halves allowed for quarter tones), the clef's octave shift and the instrument's
 * transposition. Positions count half staff-spaces from the bottom line, like the drum staff.
 */
export const STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const SEMITONE = [0, 2, 4, 5, 7, 9, 11];

/** bottom: the bottom line's pitch; glyphPosition: the line the clef sign sits on; octave: sounding shift. */
export const CLEFS = Object.freeze({
  treble: { bottom: 'E4', glyphPosition: 2, glyph: Glyphs.G_CLEF, octave: 0 },
  treble8vb: { bottom: 'E4', glyphPosition: 2, glyph: Glyphs.G_CLEF_8VB, octave: -1 },
  bass: { bottom: 'G2', glyphPosition: 6, glyph: Glyphs.F_CLEF, octave: 0 },
  bass8vb: { bottom: 'G2', glyphPosition: 6, glyph: Glyphs.F_CLEF_8VB, octave: -1 },
  alto: { bottom: 'F3', glyphPosition: 4, glyph: Glyphs.C_CLEF, octave: 0 },
  tenor: { bottom: 'D3', glyphPosition: 6, glyph: Glyphs.C_CLEF, octave: 0 },
  percussion: { bottom: null, glyphPosition: 4, glyph: Glyphs.PERCUSSION_CLEF, octave: 0 },
});

export function parseSlot(id) {
  const m = /^([A-G])(-?\d)$/.exec(id);
  if (!m) throw new Error(`not a pitch slot: ${id}`);
  return { step: STEPS.indexOf(m[1]), octave: Number(m[2]) };
}

export function slotOf(step, octave) {
  return `${STEPS[step]}${octave}`;
}

const diatonic = ({ step, octave }) => octave * 7 + step;

export function staffPositionOf(slot, clef) {
  return diatonic(parseSlot(slot)) - diatonic(parseSlot(CLEFS[clef].bottom));
}

/** A staff whose slots are every line and space from `low` to `high`, written pitch. */
export function makePitchedStaff(clef, low, high) {
  const from = diatonic(parseSlot(low));
  const to = diatonic(parseSlot(high));
  const slots = [];
  for (let d = from; d <= to; d++) {
    const id = slotOf(((d % 7) + 7) % 7, Math.floor(d / 7));
    slots.push(Object.freeze({ id, name: id, staffPosition: staffPositionOf(id, clef), notehead: 'normal' }));
  }
  return Object.freeze({ lineCount: 5, clef, pitched: true, slots: Object.freeze(slots) });
}

const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6]; // F C G D A E B
const FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3];  // B E A D G C F

/**
 * Maqam key signatures as Arabic editions print them, on the usual tonic: half-flats (−0.5)
 * where the scale has quarter tones. Other alterations of a maqam (Saba's G♭, Nahawand's B♮
 * going up) are written as accidentals, as in those editions.
 */
export const MAQAMAT = Object.freeze({
  rast: { tonic: 'C', signs: [['B', -0.5], ['E', -0.5]] },
  bayati: { tonic: 'D', signs: [['B', -1], ['E', -0.5]] },
  saba: { tonic: 'D', signs: [['B', -1], ['E', -0.5]] },
  hijaz: { tonic: 'D', signs: [['B', -1], ['E', -1], ['F', 1]] },
  nahawand: { tonic: 'C', signs: [['B', -1], ['E', -1], ['A', -1]] },
  kurd: { tonic: 'D', signs: [['B', -1], ['E', -1]] },
  sikah: { tonic: 'E', signs: [['B', -0.5], ['E', -0.5]] },
});

/** The alteration a key signature gives a step: fifths (+sharps, −flats) or a maqam name. */
export function keyAlter(fifths, step) {
  if (typeof fifths === 'string') return MAQAMAT[fifths]?.signs.find(([l]) => l === STEPS[step])?.[1] ?? 0;
  if (fifths > 0) return SHARP_ORDER.slice(0, fifths).includes(step) ? 1 : 0;
  if (fifths < 0) return FLAT_ORDER.slice(0, -fifths).includes(step) ? -1 : 0;
  return 0;
}

/**
 * Where each key-signature accidental is written for a clef, in the standard order. Tenor clef
 * sharps rise and fall inside the staff instead of the treble pattern (Dorico's placement rules).
 */
const KEY_PLACES = {
  treble: { sharp: ['F5', 'C5', 'G5', 'D5', 'A4', 'E5', 'B4'], flat: ['B4', 'E5', 'A4', 'D5', 'G4', 'C5', 'F4'] },
  bass: { sharp: ['F3', 'C3', 'G3', 'D3', 'A2', 'E3', 'B2'], flat: ['B2', 'E3', 'A2', 'D3', 'G2', 'C3', 'F2'] },
  alto: { sharp: ['F4', 'C4', 'G4', 'D4', 'A3', 'E4', 'B3'], flat: ['B3', 'E4', 'A3', 'D4', 'G3', 'C4', 'F3'] },
  tenor: { sharp: ['F3', 'C4', 'G3', 'D4', 'A3', 'E4', 'B3'], flat: ['B3', 'E4', 'A3', 'D4', 'G3', 'C4', 'F3'] },
};
KEY_PLACES.treble8vb = KEY_PLACES.treble;
KEY_PLACES.bass8vb = KEY_PLACES.bass;

export function keyAccidentals(fifths, clef) {
  const places = KEY_PLACES[clef];
  if (!places || !fifths) return [];
  if (typeof fifths === 'string') {
    // each sign at the place its letter has in the flat (or sharp) order for this clef
    return (MAQAMAT[fifths]?.signs ?? []).map(([letter, alter]) => ({
      slot: (alter > 0 ? places.sharp : places.flat).find((x) => x[0] === letter),
      alter,
    }));
  }
  return fifths > 0
    ? places.sharp.slice(0, fifths).map((slot) => ({ slot, alter: 1 }))
    : places.flat.slice(0, -fifths).map((slot) => ({ slot, alter: -1 }));
}

/** Sounding MIDI number (fractional for quarter tones). `transpose`: semitones written → sounding. */
export function midiOf(note, { clef, transpose = 0 }) {
  const { step, octave } = parseSlot(note.slotId);
  return 12 * (octave + 1) + SEMITONE[step] + (note.alter ?? 0) + 12 * (CLEFS[clef]?.octave ?? 0) + transpose;
}

export function frequencyOf(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

/**
 * The written key of a part: concert key (fifths) plus the instrument's shift (a B♭ trumpet
 * reads two sharps more), wrapped to the enharmonic key with at most seven signs.
 */
export function partKey(concertFifths, profile) {
  if (typeof concertFifths === 'string') return concertFifths; // maqam keys are not transposed
  let f = concertFifths + (profile?.keyShift ?? 0);
  while (f > 7) f -= 12;
  while (f < -7) f += 12;
  return f;
}
