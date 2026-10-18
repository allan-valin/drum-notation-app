import { Notehead } from './profile.js';
import { NoteValue } from './noteValue.js';

/**
 * SMuFL codepoints for the Bravura font (SIL OFL). Verified against the SMuFL
 * glyphnames.json on 2026-10-18 (see docs/superpowers/plans/2026-10-18-v1-web-editor.md).
 *
 * Hollow versus filled is the note value itself, not decoration, which is exactly the thing
 * that costs 5-10 seconds a note to fill in by hand on paper.
 */
const cp = (hex) => String.fromCodePoint(hex);

const NOTEHEAD = {
  [Notehead.NORMAL]: { whole: cp(0xe0a2), half: cp(0xe0a3), black: cp(0xe0a4) },
  [Notehead.CROSS]: { whole: cp(0xe0a7), half: cp(0xe0a8), black: cp(0xe0a9) },
  [Notehead.DIAMOND]: { whole: cp(0xe0d8), half: cp(0xe0d9), black: cp(0xe0db) },
  [Notehead.TRIANGLE]: { whole: cp(0xe0bb), half: cp(0xe0bc), black: cp(0xe0be) },
  [Notehead.CIRCLE_X]: { whole: cp(0xe0b1), half: cp(0xe0b2), black: cp(0xe0b3) },
  [Notehead.SLASHED]: { whole: cp(0xe0d3), half: cp(0xe0d1), black: cp(0xe0cf) },
};

const REST = {
  whole: cp(0xe4e3), half: cp(0xe4e4), quarter: cp(0xe4e5),
  eighth: cp(0xe4e6), sixteenth: cp(0xe4e7), thirtySecond: cp(0xe4e8),
};

/** Whole note symbols with stem and flag, for the palette (metNote* in SMuFL, verified 2026-10-18). */
const MET_NOTE = {
  whole: cp(0xeca2), half: cp(0xeca3), quarter: cp(0xeca5),
  eighth: cp(0xeca7), sixteenth: cp(0xeca9), thirtySecond: cp(0xecab),
};

const FLAG_UP = { eighth: cp(0xe240), sixteenth: cp(0xe242), thirtySecond: cp(0xe244) };

export const Glyphs = Object.freeze({
  STAFF5: cp(0xe014),
  BARLINE: cp(0xe030),
  PERCUSSION_CLEF: cp(0xe069),
  ACCENT: cp(0xe4a0),
  PAREN_LEFT: cp(0xe0f5),
  PAREN_RIGHT: cp(0xe0f6),
  FF: cp(0xe52f),
  PP: cp(0xe52b),
  CRESCENDO: cp(0xe53e),
  SIMILE: cp(0xe500),        // repeat1Bar
  OPEN: cp(0xe5e7),          // brassMuteOpen: open hi-hat
  CLOSED: cp(0xe5e5),        // brassMuteClosed: closed hi-hat
  HALF_OPEN: cp(0xe5e6),     // brassMuteHalfClosed
  CHOKE: cp(0xe805),         // pictChokeCymbal
  BUZZ: cp(0xe217),          // stemBuzzRoll: z on the stem
  TREMOLO3: cp(0xe222),      // tremolo3: three strokes
  GRACE_SLASH: cp(0xe560),   // graceNoteAcciaccaturaStemUp: flam
  GRACE: cp(0xe562),         // graceNoteAppoggiaturaStemUp: each note of a drag
  REPEAT_LEFT: cp(0xe040),   // repeatLeft  ||:
  REPEAT_RIGHT: cp(0xe041),  // repeatRight :||

  notehead(head, value) {
    const set = NOTEHEAD[head] ?? NOTEHEAD[Notehead.NORMAL];
    if (value === NoteValue.WHOLE) return set.whole;
    if (value === NoteValue.HALF) return set.half;
    return set.black;
  },
  rest(value) {
    return REST[value.id];
  },
  /** A complete note symbol (head, stem, flags) for buttons and labels. */
  metNote(value) {
    return MET_NOTE[value.id];
  },
  /** Empty for values that carry no flag. */
  flag(value) {
    return FLAG_UP[value.id] ?? '';
  },
  /** tuplet0..tuplet9 are consecutive from U+E880. */
  tupletDigit(n) {
    return cp(0xe880 + n);
  },
  /** timeSig0..timeSig9 are consecutive from U+E080. */
  timeSigDigit(n) {
    return cp(0xe080 + n);
  },
});

/**
 * Metrics in staff spaces, from Bravura's metadata (bravura_metadata.json, 2026-10-18).
 * The font's em is four staff spaces, so `fontSize = 4 * staffSpacing`.
 */
export const Metrics = Object.freeze({
  noteheadWidth: 1.18,       // noteheadBlack bBoxNE.x; cross heads are 1.16, close enough to share a stem
  stemUpSE: { x: 1.18, y: 0.168 }, // where an up-stem leaves a black notehead, y positive = up
  stemThickness: 0.12,
  beamThickness: 0.5,
  beamSpacing: 0.25,
  staffLineThickness: 0.13,
  barlineThickness: 0.16,
  legerLineExtension: 0.4,
  stemLength: 3.5,
  flagStemLength: 3.5,
});
