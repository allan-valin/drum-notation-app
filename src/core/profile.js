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
  palette: ['edit', 'figure', 'tuplet', 'tapMode', 'articulation', 'hand', 'head', 'technique'],
  articulations: ['accent', 'ghost'],
  heads: ALL_HEADS,
  techniques: ALL_TECHS,
  hands: true,
  legend: ['cross', 'diamond', 'triangle', 'circleX', 'crossStick', 'slashed', 'open', 'closed', 'halfOpen', 'choke', 'buzz', 'tremolo', 'flam', 'drag', 'ghost', 'accent', 'simile', 'repeat'],
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
  palette: ['edit', 'figure', 'tuplet', 'tapMode', 'articulation', 'hand', 'head', 'technique'],
  articulations: ['accent', 'ghost'],
  heads: ['cross'],
  techniques: ['closed', 'flam'],
  hands: true,
  labels: { cross: 'slap', closed: 'mute' },
  legend: ['congaSlap', 'congaMute', 'flam', 'ghost', 'accent', 'simile', 'repeat'],
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
const PITCHED_PALETTE = ['edit', 'figure', 'tuplet', 'tapMode', 'accidental', 'articulation'];
const PITCHED_ARTS = ['accent', 'staccato', 'tenuto', 'marcato', 'fermata'];
const PITCHED_LEGEND = ['sharp', 'flat', 'natural', 'doubleSharp', 'doubleFlat', 'staccato', 'tenuto', 'accent', 'marcato', 'fermata', 'simile', 'repeat'];
function pitchedProfile(id, family, clef, low, high, voice, extra = {}) {
  return Object.freeze({
    id, name: id, family, palette: PITCHED_PALETTE, articulations: PITCHED_ARTS,
    heads: [], techniques: [], hands: false, legend: PITCHED_LEGEND, voice, transpose: 0,
    staves: Object.freeze([makePitchedStaff(clef, low, high)]),
    ...extra,
  });
}

/** Rock band. Guitar and bass are written an octave above where they sound (the 8 under the clef). */
export const ELECTRIC_GUITAR_PROFILE = pitchedProfile('electricGuitar', 'rock', 'treble8vb', 'D3', 'E6', 'guitar');
export const BASS_GUITAR_PROFILE = pitchedProfile('bassGuitar', 'rock', 'bass8vb', 'C2', 'G4', 'bass');
export const KEYS_PROFILE = pitchedProfile('keys', 'rock', 'treble', 'F3', 'C7', 'keys');
export const VOCAL_PROFILE = pitchedProfile('vocal', 'rock', 'treble', 'E3', 'C6', 'voice');

export const PROFILES = Object.freeze({
  drums: DRUM_PROFILE,
  congas: CONGAS_PROFILE,
  electricGuitar: ELECTRIC_GUITAR_PROFILE,
  bassGuitar: BASS_GUITAR_PROFILE,
  keys: KEYS_PROFILE,
  vocal: VOCAL_PROFILE,
});

/** Instruments offered in the dropdowns, in order. */
export const INSTRUMENTS = Object.freeze(Object.keys(PROFILES));

export function profileById(id) {
  return PROFILES[id] ?? DRUM_PROFILE;
}
