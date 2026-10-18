export const Notehead = Object.freeze({
  NORMAL: 'normal', CROSS: 'cross', DIAMOND: 'diamond', TRIANGLE: 'triangle', CIRCLE_X: 'circleX', SLASHED: 'slashed',
});
export const NOTEHEADS = Object.freeze(Object.values(Notehead));

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

export const PROFILES = Object.freeze({ drums: DRUM_PROFILE, congas: CONGAS_PROFILE });

/** Instruments offered in the dropdowns, in order. */
export const INSTRUMENTS = Object.freeze(Object.keys(PROFILES));

export function profileById(id) {
  return PROFILES[id] ?? DRUM_PROFILE;
}
