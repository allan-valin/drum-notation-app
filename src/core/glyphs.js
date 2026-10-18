import { Notehead } from './notehead.js';
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
  [Notehead.SLASH]: { whole: cp(0xe102), half: cp(0xe103), black: cp(0xe101) },
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

const FLAG_DOWN = { eighth: cp(0xe241), sixteenth: cp(0xe243), thirtySecond: cp(0xe245) };

const FLAG_UP = { eighth: cp(0xe240), sixteenth: cp(0xe242), thirtySecond: cp(0xe244) };

export const Glyphs = Object.freeze({
  STAFF5: cp(0xe014),
  G_CLEF: cp(0xe050),
  G_CLEF_8VB: cp(0xe052),
  F_CLEF: cp(0xe062),
  F_CLEF_8VB: cp(0xe064),
  C_CLEF: cp(0xe05c),
  SHARP: cp(0xe262),
  FLAT: cp(0xe260),
  NATURAL: cp(0xe261),
  DOUBLE_SHARP: cp(0xe263),
  DOUBLE_FLAT: cp(0xe264),
  QUARTER_FLAT: cp(0xed33),        // accidentalQuarterToneFlatArabic
  QUARTER_SHARP: cp(0xed35),       // accidentalQuarterToneSharpArabic
  THREE_QUARTER_FLAT: cp(0xed31),
  THREE_QUARTER_SHARP: cp(0xed37),
  STACCATO: cp(0xe4a2),
  TENUTO: cp(0xe4a4),
  MARCATO: cp(0xe4ac),
  FERMATA: cp(0xe4c0),
  BREATH: cp(0xe4ce),
  DOT: cp(0xe1e7),
  FALL: cp(0xe5d7),   // brassFallLipShort
  DOIT: cp(0xe5d4),   // brassDoitShort
  SCOOP: cp(0xe5d0),  // brassScoop
  PLOP: cp(0xe5e0),   // brassPlop
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
  flag(value, dir = 'up') {
    return (dir === 'down' ? FLAG_DOWN : FLAG_UP)[value.id] ?? '';
  },
  /** Dynamics as single SMuFL glyphs (verified 2026-10-18: pp E52B … sfz E539). */
  dynamic(name) {
    return { pp: cp(0xe52b), p: cp(0xe520), mp: cp(0xe52c), mf: cp(0xe52d), f: cp(0xe522), ff: cp(0xe52f), fp: cp(0xe534), sfz: cp(0xe539) }[name] ?? '';
  },
  /** Sign for an alteration in semitones (halves are quarter tones); 0 is a natural. */
  accidental(alter) {
    return {
      '-2': cp(0xe264), '-1.5': cp(0xed31), '-1': cp(0xe260), '-0.5': cp(0xed33), 0: cp(0xe261),
      0.5: cp(0xed35), 1: cp(0xe262), 1.5: cp(0xed37), 2: cp(0xe263),
    }[String(alter)];
  },
  /** Articulation sign, above or below the note. Verified against glyphnames.json 2026-10-18. */
  artic(name, above) {
    const t = {
      accent: [0xe4a0, 0xe4a1], staccato: [0xe4a2, 0xe4a3], tenuto: [0xe4a4, 0xe4a5], marcato: [0xe4ac, 0xe4ad],
    }[name];
    return t ? cp(above ? t[0] : t[1]) : '';
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
