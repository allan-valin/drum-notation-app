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

/** `staves` is a list so a two-staff instrument fits later; v1 only ever builds one. */
export const DRUM_PROFILE = Object.freeze({
  id: 'drums',
  name: 'Bateria',
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

export const PROFILES = Object.freeze({ drums: DRUM_PROFILE });

export function profileById(id) {
  return PROFILES[id] ?? DRUM_PROFILE;
}
