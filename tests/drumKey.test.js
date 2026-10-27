import { describe, it, expect } from 'vitest';
import { DRUM_PROFILE, slotFor, slotById, Notehead } from '../src/core/profile.js';
import { soundFor } from '../src/core/schedule.js';
import { note, Mark } from '../src/core/score.js';
import { initialState, reduce } from '../src/core/editorState.js';
import { leafAt } from '../src/core/cursor.js';
import { newScore } from '../src/core/score.js';

const staff = DRUM_PROFILE.staves[0];
const at = (id) => slotById(staff, id);

/** docs/drum-key-reference.png (Rock Band drum key), measured from the image: 0 = bottom line. */
describe('drum key positions', () => {
  it.each([
    ['hihatPedal', -1, Notehead.CROSS], ['hihatSplash', -1, Notehead.CIRCLE_X],
    ['kickLeft', 0, Notehead.NORMAL], ['kick', 1, Notehead.NORMAL],
    ['floorTom', 2, Notehead.NORMAL], ['tom4', 3, Notehead.NORMAL], ['tom3', 4, Notehead.NORMAL],
    ['snare', 5, Notehead.NORMAL], ['midTom', 6, Notehead.NORMAL], ['highTom', 7, Notehead.NORMAL],
    ['hihat', 8, Notehead.CROSS], ['hihatOpen', 8, Notehead.CIRCLE_X],
    ['ride', 9, Notehead.CROSS], ['rideBell', 9, Notehead.DIAMOND],
    ['crash', 10, Notehead.CROSS],
    ['china', 11, Notehead.CIRCLE_X], ['splash', 11, Notehead.DIAMOND_OPEN], ['cowbell', 11, Notehead.TRIANGLE],
  ])('%s sits at %i with its head', (id, pos, head) => {
    expect(at(id).staffPosition).toBe(pos);
    expect(at(id).notehead).toBe(head);
  });

  it('a tap height and the chosen head pick the instrument among those sharing a position', () => {
    expect(slotFor(staff, 11, null).id).toBe('china');
    expect(slotFor(staff, 11, Notehead.DIAMOND_OPEN).id).toBe('splash');
    expect(slotFor(staff, 11, Notehead.TRIANGLE).id).toBe('cowbell');
    expect(slotFor(staff, 9, Notehead.DIAMOND).id).toBe('rideBell');
    expect(slotFor(staff, 8, Notehead.CIRCLE_X).id).toBe('hihatOpen');
    expect(slotFor(staff, -1, Notehead.CIRCLE_X).id).toBe('hihatSplash');
    // a head nobody at that height has stays an override on the main instrument there
    expect(slotFor(staff, 5, Notehead.CROSS).id).toBe('snare');
  });

  it('tapping with a head that names an instrument writes that instrument with its own head', () => {
    let st = initialState(newScore());
    st = reduce(st, { type: 'setHead', head: Notehead.TRIANGLE });
    st = reduce(st, { type: 'tap', staffPosition: 11 });
    expect(leafAt(st.score, st.cursor).notes[0]).toMatchObject({ slotId: 'cowbell', head: null });
    st = reduce(st, { type: 'setHead', head: Notehead.CROSS });
    st = reduce(st, { type: 'tap', staffPosition: 5 });
    expect(leafAt(st.score, st.cursor).notes.find((n) => n.slotId === 'snare').head).toBe(Notehead.CROSS);
  });

  it('every new piece has a sound', () => {
    expect(soundFor(note('kickLeft'))).toBe('kick');
    expect(soundFor(note('hihatOpen'))).toBe('hihatOpen');
    expect(soundFor(note('hihatSplash'))).toBe('hihatSplash');
    expect(soundFor(note('rideBell'))).toBe('rideBell');
    expect(soundFor(note('china'))).toBe('china');
    expect(soundFor(note('splash'))).toBe('splash');
    expect(soundFor(note('cowbell'))).toBe('cowbell');
    expect(soundFor(note('tom3'))).toBe('tom3');
    expect(soundFor(note('tom4'))).toBe('tom4');
    expect(soundFor(note('crash', { marks: [Mark.CHOKE] }))).toBe('crashChoke');
  });
});
