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
};

const REST = {
  whole: cp(0xe4e3), half: cp(0xe4e4), quarter: cp(0xe4e5),
  eighth: cp(0xe4e6), sixteenth: cp(0xe4e7), thirtySecond: cp(0xe4e8),
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

  notehead(head, value) {
    const set = NOTEHEAD[head] ?? NOTEHEAD[Notehead.NORMAL];
    if (value === NoteValue.WHOLE) return set.whole;
    if (value === NoteValue.HALF) return set.half;
    return set.black;
  },
  rest(value) {
    return REST[value.id];
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
