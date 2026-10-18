import { Notehead, NOTEHEADS } from './notehead.js';
import { makePitchedStaff } from './pitch.js';

export { Notehead, NOTEHEADS };

/**
 * One instrument's place on the staff. `staffPosition` counts half-steps from the bottom
 * line: 0 is the bottom line, 1 the space above it, negatives sit below the staff.
 * There is no voice field: on a drum staff the position *is* the instrument.
 */
function slot(id, name, staffPosition, notehead) {
  return Object.freeze({ id, name, staffPosition, notehead });
}

/** The slot whose position is closest to `position`: how a tap height becomes an instrument. */
export function slotNearest(staff, position) {
  return staff.slots.reduce((best, s) =>
    Math.abs(s.staffPosition - position) < Math.abs(best.staffPosition - position) ? s : best,
  );
}

export function slotById(staff, id) {
  const s = staff.slots.find((x) => x.id === id);
  if (!s) throw new Error(`unknown slot: ${id}`);
  return s;
}

const ALL_HEADS = ['cross', 'diamond', 'triangle', 'circleX', 'slashed'];
const ALL_TECHS = ['open', 'closed', 'halfOpen', 'choke', 'buzz', 'tremolo', 'flam', 'drag'];

/**
 * An instrument: its staff, and which palette groups, noteheads, techniques and legend rows it
 * uses. A profile only hides what the instrument does not use; nothing is removed from the app.
 * `staves` is a list so a two-staff instrument fits later.
 */
export const DRUM_PROFILE = Object.freeze({
  id: 'drums',
  name: 'Bateria',
  family: 'rock',
  palette: ['edit', 'figure', 'tuplet', 'tapMode', 'articulation', 'dynamics', 'hand', 'head', 'technique'],
  articulations: ['accent', 'ghost'],
  heads: ALL_HEADS,
  techniques: ALL_TECHS,
  hands: true,
  legend: ['cross', 'diamond', 'triangle', 'circleX', 'crossStick', 'slashed', 'open', 'closed', 'halfOpen', 'choke', 'buzz', 'tremolo', 'flam', 'drag', 'ghost', 'accent', 'dynamics', 'wedges', 'simile', 'repeat'],
  staves: Object.freeze([
    Object.freeze({
      lineCount: 5,
      slots: Object.freeze([
        slot('hihatPedal', 'Chimbal (pé)', -4, Notehead.CROSS),
        slot('kick', 'Bumbo', -2, Notehead.NORMAL),
        slot('floorTom', 'Surdo', 1, Notehead.NORMAL),
        slot('snare', 'Caixa', 4, Notehead.NORMAL),
        slot('midTom', 'Tom médio', 6, Notehead.NORMAL),
        slot('highTom', 'Tom agudo', 7, Notehead.NORMAL),
        slot('hihat', 'Chimbal', 9, Notehead.CROSS),
        slot('ride', 'Ride', 10, Notehead.CROSS),
        slot('crash', 'Crash', 11, Notehead.CROSS),
      ]),
    }),
  ]),
});

/**
 * Congas (quinto, conga, tumba), as most method books write them on a five-line staff: open
 * tone with a normal head, slap with an X head, muted tone with + above. No sticks, so no
 * cymbal heads, rolls or chokes; hands R/L stay.
 */
export const CONGAS_PROFILE = Object.freeze({
  id: 'congas',
  name: 'Congas',
  family: 'rock',
  palette: ['edit', 'figure', 'tuplet', 'tapMode', 'articulation', 'dynamics', 'hand', 'head', 'technique'],
  articulations: ['accent', 'ghost'],
  heads: ['cross'],
  techniques: ['closed', 'flam'],
  hands: true,
  labels: { cross: 'slap', closed: 'mute' },
  legend: ['congaSlap', 'congaMute', 'flam', 'ghost', 'accent', 'dynamics', 'wedges', 'simile', 'repeat'],
  staves: Object.freeze([
    Object.freeze({
      lineCount: 5,
      slots: Object.freeze([
        slot('tumba', 'Tumba', 2, Notehead.NORMAL),
        slot('conga', 'Conga', 4, Notehead.NORMAL),
        slot('quinto', 'Quinto', 6, Notehead.NORMAL),
      ]),
    }),
  ]),
});


/**
 * Pitched instruments: the staff is every line and space in the written range. They use
 * accidentals and articulations; no sticks, so no drum heads, techniques or hands.
 */
const PITCHED_PALETTE = ['edit', 'figure', 'length', 'tuplet', 'tapMode', 'accidental', 'articulation', 'dynamics'];
const PITCHED_ARTS = ['accent', 'staccato', 'tenuto', 'marcato', 'fermata'];
const PITCHED_LEGEND = ['sharp', 'flat', 'natural', 'doubleSharp', 'doubleFlat', 'staccato', 'tenuto', 'accent', 'marcato', 'fermata', 'dynamics', 'wedges', 'simile', 'repeat'];
function pitchedProfile(id, family, clef, low, high, voice, extra = {}) {
  return Object.freeze({
    id, name: id, family, palette: PITCHED_PALETTE, articulations: PITCHED_ARTS,
    heads: [], techniques: [], hands: false, legend: PITCHED_LEGEND, voice, transpose: 0,
    staves: Object.freeze([makePitchedStaff(clef, low, high)]),
    ...extra,
  });
}

/**
 * Rhythm section (keys, guitar, bass, vibes): chord symbols, and for keys and guitar the rhythm
 * slash ("comp the chord in this rhythm"). Horns: falls, doits, scoops and plops, slurs and breaths.
 */
const RHYTHM_EXTRA = {
  palette: [...PITCHED_PALETTE, 'chords', 'head'],
  heads: ['slash'],
  legend: [...PITCHED_LEGEND, 'chord', 'slashHead'],
};
const BASS_EXTRA = { palette: [...PITCHED_PALETTE, 'chords'], legend: [...PITCHED_LEGEND, 'chord'] };
const HORN_EXTRA = {
  palette: [...PITCHED_PALETTE, 'phrasing', 'technique'],
  articulations: [...PITCHED_ARTS, 'breath'],
  techniques: ['fall', 'doit', 'scoop', 'plop'],
  legend: [...PITCHED_LEGEND, 'breath', 'slur', 'fall', 'doit', 'scoop', 'plop'],
};

/** Rock band. Guitar and bass are written an octave above where they sound (the 8 under the clef). */
export const ELECTRIC_GUITAR_PROFILE = pitchedProfile('electricGuitar', 'rock', 'treble8vb', 'D3', 'E6', 'guitar', RHYTHM_EXTRA);
export const BASS_GUITAR_PROFILE = pitchedProfile('bassGuitar', 'rock', 'bass8vb', 'C2', 'G4', 'bass', BASS_EXTRA);
export const KEYS_PROFILE = pitchedProfile('keys', 'rock', 'treble', 'F3', 'C7', 'keys', RHYTHM_EXTRA);

/**
 * Jazz. Transposing horns are written where the player reads: B♭ trumpet a tone above concert
 * pitch, E♭ alto sax a major sixth above, B♭ tenor sax a major ninth above; `transpose` takes
 * the written note to concert pitch and `keyShift` gives the written key signature.
 */
export const TRUMPET_PROFILE = pitchedProfile('trumpet', 'jazz', 'treble', 'F3', 'D6', 'brass', { ...HORN_EXTRA, transpose: -2, keyShift: 2 });
export const ALTO_SAX_PROFILE = pitchedProfile('altoSax', 'jazz', 'treble', 'A3', 'F6', 'sax', { ...HORN_EXTRA, transpose: -9, keyShift: 3 });
export const TENOR_SAX_PROFILE = pitchedProfile('tenorSax', 'jazz', 'treble', 'A3', 'F6', 'sax', { ...HORN_EXTRA, transpose: -14, keyShift: 2 });
export const TROMBONE_PROFILE = pitchedProfile('trombone', 'jazz', 'bass', 'E2', 'F4', 'brass', HORN_EXTRA);
export const DOUBLE_BASS_PROFILE = pitchedProfile('doubleBass', 'jazz', 'bass8vb', 'E2', 'G4', 'upright', BASS_EXTRA);
export const VIBRAPHONE_PROFILE = pitchedProfile('vibraphone', 'jazz', 'treble', 'F3', 'F6', 'vibes', { palette: [...PITCHED_PALETTE, 'chords'], legend: [...PITCHED_LEGEND, 'chord'] });
/**
 * Voices: lyrics, breath marks and slurs; dynamics above the staff so lyrics have the space
 * below (the choral convention). Tenor is written in treble clef, sounding an octave lower.
 */
const VOICE_EXTRA = {
  palette: [...PITCHED_PALETTE, 'phrasing', 'lyrics'],
  articulations: [...PITCHED_ARTS, 'breath'],
  legend: [...PITCHED_LEGEND, 'breath', 'slur', 'lyric'],
  dynamicsAbove: true,
};
export const VOCAL_PROFILE = pitchedProfile('vocal', 'rock', 'treble', 'E3', 'C6', 'voice', VOICE_EXTRA);
export const SOPRANO_PROFILE = pitchedProfile('soprano', 'choir', 'treble', 'A3', 'C6', 'voice', VOICE_EXTRA);
export const ALTO_PROFILE = pitchedProfile('alto', 'choir', 'treble', 'E3', 'F5', 'voice', VOICE_EXTRA);
export const TENOR_PROFILE = pitchedProfile('tenor', 'choir', 'treble8vb', 'A3', 'C6', 'voice', VOICE_EXTRA);
export const BASS_PROFILE = pitchedProfile('bass', 'choir', 'bass', 'C2', 'F4', 'voice', VOICE_EXTRA);

/**
 * Grand-staff instruments are two linked parts, one per hand, so each hand keeps its own
 * rhythm: right hand on a treble staff, left hand on a bass staff.
 */
const KEYBOARD_EXTRA = { palette: [...PITCHED_PALETTE, 'chords', 'phrasing'], articulations: [...PITCHED_ARTS], legend: [...PITCHED_LEGEND, 'chord', 'slur'] };
export const PIANO_RH_PROFILE = pitchedProfile('pianoRH', 'orchestra', 'treble', 'A3', 'C8', 'piano', KEYBOARD_EXTRA);
export const PIANO_LH_PROFILE = pitchedProfile('pianoLH', 'orchestra', 'bass', 'A0', 'E4', 'piano', KEYBOARD_EXTRA);
export const HARP_RH_PROFILE = pitchedProfile('harpRH', 'orchestra', 'treble', 'A3', 'G7', 'harp', KEYBOARD_EXTRA);
export const HARP_LH_PROFILE = pitchedProfile('harpLH', 'orchestra', 'bass', 'C1', 'E4', 'harp', KEYBOARD_EXTRA);

/**
 * Orchestra. Strings bow (down/up), pluck (pizz.) and return (arco), play harmonics, tremolo and
 * trills; winds and brass trill and breathe; mallets and timpani roll. Clarinet (B♭) and horn
 * (F) are written transposed; glockenspiel sounds two octaves and xylophone one octave above
 * the written note.
 */
const STRINGS_EXTRA = {
  palette: [...PITCHED_PALETTE, 'phrasing', 'technique'],
  articulations: [...PITCHED_ARTS],
  techniques: ['pizz', 'arco', 'downBow', 'upBow', 'harmonic', 'tremolo', 'trill'],
  legend: [...PITCHED_LEGEND, 'slur', 'pizz', 'downBow', 'upBow', 'harmonic', 'stringTremolo', 'trill'],
};
const WIND_EXTRA = {
  palette: [...PITCHED_PALETTE, 'phrasing', 'technique'],
  articulations: [...PITCHED_ARTS, 'breath'],
  techniques: ['trill', 'tremolo'],
  legend: [...PITCHED_LEGEND, 'breath', 'slur', 'trill'],
};
const MALLET_EXTRA = { palette: [...PITCHED_PALETTE, 'technique'], techniques: ['tremolo'], labels: { tremolo: 'roll' }, legend: [...PITCHED_LEGEND, 'stringTremolo'] };
export const VIOLIN_PROFILE = pitchedProfile('violin', 'orchestra', 'treble', 'G3', 'E7', 'strings', STRINGS_EXTRA);
export const VIOLA_PROFILE = pitchedProfile('viola', 'orchestra', 'alto', 'C3', 'E6', 'strings', STRINGS_EXTRA);
export const CELLO_PROFILE = pitchedProfile('cello', 'orchestra', 'bass', 'C2', 'A5', 'strings', STRINGS_EXTRA);
export const CONTRABASS_PROFILE = pitchedProfile('contrabass', 'orchestra', 'bass8vb', 'E2', 'G4', 'strings', STRINGS_EXTRA);
export const FLUTE_PROFILE = pitchedProfile('flute', 'orchestra', 'treble', 'C4', 'C7', 'flute', WIND_EXTRA);
export const OBOE_PROFILE = pitchedProfile('oboe', 'orchestra', 'treble', 'A3', 'A6', 'oboe', WIND_EXTRA);
export const CLARINET_PROFILE = pitchedProfile('clarinet', 'orchestra', 'treble', 'E3', 'C7', 'clarinet', { ...WIND_EXTRA, transpose: -2, keyShift: 2 });
export const BASSOON_PROFILE = pitchedProfile('bassoon', 'orchestra', 'bass', 'B1', 'E5', 'bassoon', WIND_EXTRA);
export const HORN_PROFILE = pitchedProfile('horn', 'orchestra', 'treble', 'F3', 'C6', 'horn', { ...WIND_EXTRA, transpose: -7, keyShift: 1 });
export const TUBA_PROFILE = pitchedProfile('tuba', 'orchestra', 'bass', 'D1', 'F4', 'tuba', WIND_EXTRA);
export const TIMPANI_PROFILE = pitchedProfile('timpani', 'orchestra', 'bass', 'D2', 'A3', 'timpani', MALLET_EXTRA);
export const GLOCKENSPIEL_PROFILE = pitchedProfile('glockenspiel', 'orchestra', 'treble', 'G3', 'C6', 'glock', { ...MALLET_EXTRA, transpose: 24 });
export const XYLOPHONE_PROFILE = pitchedProfile('xylophone', 'orchestra', 'treble', 'F3', 'C7', 'xylo', { ...MALLET_EXTRA, transpose: 12 });
export const MARIMBA_PROFILE = pitchedProfile('marimba', 'orchestra', 'treble', 'C3', 'C7', 'marimba', MALLET_EXTRA);

/**
 * Arabic music on a Western staff: quarter tones and maqam key signatures. Oud is written an
 * octave above where it sounds. Darbuka, riq and daf: dum (low, centre of the skin) below,
 * tak (rim) above, ka (the other hand's tak) higher with an X head.
 */
const ARABIC_EXTRA = { palette: [...PITCHED_PALETTE, 'phrasing'], articulations: [...PITCHED_ARTS, 'breath'], legend: [...PITCHED_LEGEND, 'quarterFlat', 'quarterSharp', 'slur'], quarterTones: true };
export const OUD_PROFILE = pitchedProfile('oud', 'arabic', 'treble8vb', 'C3', 'G6', 'oud', ARABIC_EXTRA);
export const QANUN_PROFILE = pitchedProfile('qanun', 'arabic', 'treble', 'G3', 'F6', 'qanun', ARABIC_EXTRA);
export const NEY_PROFILE = pitchedProfile('ney', 'arabic', 'treble', 'C4', 'D7', 'ney', ARABIC_EXTRA);
function frameDrum(id) {
  return Object.freeze({
    id, name: id, family: 'arabic',
    palette: ['edit', 'figure', 'tuplet', 'tapMode', 'articulation', 'dynamics', 'hand'],
    articulations: ['accent', 'ghost'], heads: [], techniques: [], hands: true,
    legend: ['dumTak', 'ghost', 'accent', 'dynamics', 'wedges', 'simile', 'repeat'],
    staves: Object.freeze([Object.freeze({ lineCount: 5, slots: Object.freeze([
      slot('dum', 'Dum', 2, Notehead.NORMAL),
      slot('tak', 'Tak', 6, Notehead.NORMAL),
      slot('ka', 'Ka', 8, Notehead.CROSS),
    ]) })]),
  });
}
export const DARBUKA_PROFILE = frameDrum('darbuka');
export const RIQ_PROFILE = frameDrum('riq');
export const DAF_PROFILE = frameDrum('daf');

/**
 * Japanese instruments written on a Western staff (traditional vertical notation is not
 * supported). Taiko strokes go by their kuchishōga syllables: don (centre), tsu (light centre),
 * ka (rim, X head).
 */
const JAPANESE_EXTRA = { palette: [...PITCHED_PALETTE, 'phrasing'], articulations: [...PITCHED_ARTS, 'breath'], legend: [...PITCHED_LEGEND, 'slur'] };
export const KOTO_PROFILE = pitchedProfile('koto', 'japanese', 'treble', 'D3', 'D6', 'koto', JAPANESE_EXTRA);
export const SHAMISEN_PROFILE = pitchedProfile('shamisen', 'japanese', 'treble8vb', 'B3', 'C6', 'shamisen', JAPANESE_EXTRA);
export const SHAKUHACHI_PROFILE = pitchedProfile('shakuhachi', 'japanese', 'treble', 'D4', 'D7', 'shakuhachi', JAPANESE_EXTRA);
export const TAIKO_PROFILE = Object.freeze({
  id: 'taiko', name: 'taiko', family: 'japanese',
  palette: ['edit', 'figure', 'tuplet', 'tapMode', 'articulation', 'dynamics', 'hand'],
  articulations: ['accent', 'ghost'], heads: [], techniques: [], hands: true,
  legend: ['taiko', 'ghost', 'accent', 'dynamics', 'wedges', 'simile', 'repeat'],
  staves: Object.freeze([Object.freeze({ lineCount: 5, slots: Object.freeze([
    slot('don', 'Don', 2, Notehead.NORMAL),
    slot('tsu', 'Tsu', 4, Notehead.NORMAL),
    slot('ka', 'Ka', 7, Notehead.CROSS),
  ]) })]),
});

/** Instruments made of several linked parts, by the name offered in the dropdowns. */
export const GROUPS = Object.freeze({ piano: ['pianoRH', 'pianoLH'], harp: ['harpRH', 'harpLH'] });

export const PROFILES = Object.freeze({
  drums: DRUM_PROFILE,
  congas: CONGAS_PROFILE,
  electricGuitar: ELECTRIC_GUITAR_PROFILE,
  bassGuitar: BASS_GUITAR_PROFILE,
  keys: KEYS_PROFILE,
  vocal: VOCAL_PROFILE,
  soprano: SOPRANO_PROFILE,
  alto: ALTO_PROFILE,
  tenor: TENOR_PROFILE,
  bass: BASS_PROFILE,
  trumpet: TRUMPET_PROFILE,
  altoSax: ALTO_SAX_PROFILE,
  tenorSax: TENOR_SAX_PROFILE,
  trombone: TROMBONE_PROFILE,
  doubleBass: DOUBLE_BASS_PROFILE,
  vibraphone: VIBRAPHONE_PROFILE,
  pianoRH: PIANO_RH_PROFILE,
  pianoLH: PIANO_LH_PROFILE,
  harpRH: HARP_RH_PROFILE,
  harpLH: HARP_LH_PROFILE,
  violin: VIOLIN_PROFILE,
  viola: VIOLA_PROFILE,
  cello: CELLO_PROFILE,
  contrabass: CONTRABASS_PROFILE,
  flute: FLUTE_PROFILE,
  oboe: OBOE_PROFILE,
  clarinet: CLARINET_PROFILE,
  bassoon: BASSOON_PROFILE,
  horn: HORN_PROFILE,
  tuba: TUBA_PROFILE,
  timpani: TIMPANI_PROFILE,
  glockenspiel: GLOCKENSPIEL_PROFILE,
  xylophone: XYLOPHONE_PROFILE,
  marimba: MARIMBA_PROFILE,
  oud: OUD_PROFILE,
  qanun: QANUN_PROFILE,
  ney: NEY_PROFILE,
  darbuka: DARBUKA_PROFILE,
  riq: RIQ_PROFILE,
  daf: DAF_PROFILE,
  koto: KOTO_PROFILE,
  shamisen: SHAMISEN_PROFILE,
  shakuhachi: SHAKUHACHI_PROFILE,
  taiko: TAIKO_PROFILE,
});

/** Instruments offered in the dropdowns, in order: hands of a grand staff come as their instrument. */
const GROUPED = new Set(Object.values(GROUPS).flat());
export const INSTRUMENTS = Object.freeze([
  ...Object.keys(PROFILES).filter((id) => !GROUPED.has(id) && !id.startsWith('piano') && !id.startsWith('harp')),
  ...Object.keys(GROUPS),
]);

/** The group name ("piano") whose members are exactly these instruments, if any. */
export function groupName(instruments) {
  return Object.keys(GROUPS).find((g) => GROUPS[g].length === instruments.length && GROUPS[g].every((m, i) => m === instruments[i])) ?? null;
}

export function profileById(id) {
  return PROFILES[id] ?? DRUM_PROFILE;
}

/** Instruments for the dropdowns, grouped by family in a fixed order (section headers). */
export const FAMILIES = ['rock', 'choir', 'jazz', 'orchestra', 'arabic', 'japanese'];
export function familyOf(instrument) {
  return profileById(GROUPS[instrument]?.[0] ?? instrument).family;
}
export const INSTRUMENTS_BY_FAMILY = Object.freeze(FAMILIES.map((f) => [f, INSTRUMENTS.filter((id) => familyOf(id) === f)]));
