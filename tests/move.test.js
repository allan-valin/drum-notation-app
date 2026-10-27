import { describe, it, expect } from 'vitest';
import { note, newScore, emptyBar } from '../src/core/score.js';
import { NoteValue } from '../src/core/noteValue.js';
import { placeNote, splitBeat } from '../src/core/edit.js';
import { cursor, leafAt } from '../src/core/cursor.js';
import { moveNotes, moveBeats, absTick } from '../src/core/move.js';
import { DRUM_PROFILE } from '../src/core/profile.js';
import { initialState, reduce } from '../src/core/editorState.js';

const staff = DRUM_PROFILE.staves[0];
const two = () => newScore({ bars: [emptyBar(4, 4), emptyBar(4, 4)] });
const slots = (s, c) => leafAt(s, c).notes.map((n) => n.slotId).sort();

describe('moving notes', () => {
  it('beats 2 and 4 dragged back one beat land on 1 and 3: the spacing is kept', () => {
    let s = placeNote(placeNote(two(), cursor(0, 1, 0), note('snare')), cursor(0, 3, 0), note('snare'));
    s = moveNotes(s, [cursor(0, 1, 0), cursor(0, 3, 0)], absTick(s, cursor(0, 0, 0)) - absTick(s, cursor(0, 1, 0)), 0, staff);
    expect([0, 1, 2, 3].map((b) => slots(s, cursor(0, b, 0)))).toEqual([['snare'], [], ['snare'], []]);
  });
  it('one note moves to another height: another instrument, the rest of the cell stays', () => {
    let s = placeNote(placeNote(two(), cursor(0, 0, 0), note('snare', { articulations: ['accent'] })), cursor(0, 0, 0), note('hihat'));
    s = moveNotes(s, [{ ...cursor(0, 0, 0), slotIds: ['snare'] }], 0, 2, staff);
    expect(slots(s, cursor(0, 0, 0))).toEqual(['highTom', 'hihat']);
    expect(leafAt(s, cursor(0, 0, 0)).notes.find((n) => n.slotId === 'highTom').articulations).toEqual(['accent']);
  });
  it('a note can cross into the next bar', () => {
    let s = placeNote(two(), cursor(0, 3, 0), note('kick'));
    s = moveNotes(s, [cursor(0, 3, 0)], 960, 0, staff);
    expect(slots(s, cursor(1, 0, 0))).toEqual(['kick']);
    expect(slots(s, cursor(0, 3, 0))).toEqual([]);
  });
  it('is refused when no cell starts at the target, or it runs off the score', () => {
    const s = placeNote(two(), cursor(0, 0, 0), note('kick'));
    expect(moveNotes(s, [cursor(0, 0, 0)], 480, 0, staff).refused).toBe('noCellThere');
    expect(moveNotes(s, [cursor(0, 0, 0)], -960, 0, staff).refused).toBe('outOfScore');
  });
});

describe('moving whole beats', () => {
  it('a beat moves with its subdivision; the place it left is an empty beat', () => {
    let s = splitBeat(two(), cursor(0, 1, 0), NoteValue.SIXTEENTH, null);
    s = placeNote(s, cursor(0, 1, 2), note('snare'));
    s = moveBeats(s, [{ bar: 0, beat: 1 }], 2);
    expect(s.bars[0].beats[3].cells.length).toBe(4);
    expect(slots(s, cursor(0, 3, 2))).toEqual(['snare']);
    expect(s.bars[0].beats[1].cells.length).toBe(1);
  });
  it('across the bar line too, but not between different beat units', () => {
    let s = placeNote(two(), cursor(0, 3, 0), note('crash'));
    s = moveBeats(s, [{ bar: 0, beat: 3 }], 1);
    expect(slots(s, cursor(1, 0, 0))).toEqual(['crash']);
    const mixed = newScore({ bars: [emptyBar(4, 4), { ...emptyBar(6, 8), timeSig: [6, 8] }] });
    expect(moveBeats(mixed, [{ bar: 0, beat: 3 }], 1).refused).toBe('beatsDiffer');
  });
});

describe('editor actions', () => {
  it('right click deletes the note nearest the click in that cell, without the delete toggle', () => {
    let st = initialState(newScore());
    st = reduce(reduce(st, { type: 'tap', staffPosition: 5 }), { type: 'tap', staffPosition: 8 });
    st = reduce(st, { type: 'eraseAt', beat: 0, path: [0], staffPosition: 6 });
    expect(slots(st.score, st.cursor)).toEqual(['hihat']);
    expect(st.tool.delete).toBe(false);
  });
  it('a drag moves the note and the cursor follows it; one undo puts it back', () => {
    let st = reduce(initialState(newScore()), { type: 'tap', staffPosition: 5 });
    st = reduce(st, { type: 'moveNotes', from: cursor(0, 0, 0), slotId: 'snare', to: cursor(0, 2, 0), staffPosition: 5 });
    expect(slots(st.score, cursor(0, 2, 0))).toEqual(['snare']);
    expect(st.cursor).toMatchObject({ beat: 2 });
    st = reduce(st, { type: 'undo' });
    expect(slots(st.score, cursor(0, 0, 0))).toEqual(['snare']);
  });
  it('a selection moves by the distance the dragged cell went', () => {
    let st = initialState(newScore());
    st = reduce(reduce(st, { type: 'tapAt', beat: 1, path: [0], staffPosition: 5 }), { type: 'tapAt', beat: 1, path: [0], staffPosition: 5 });
    st = reduce(reduce(st, { type: 'tapAt', beat: 3, path: [0], staffPosition: 5 }), { type: 'tapAt', beat: 3, path: [0], staffPosition: 5 });
    st = reduce(st, { type: 'moveSelection', mode: 'cells', items: [cursor(0, 1, 0), cursor(0, 3, 0)], from: cursor(0, 1, 0), to: cursor(0, 0, 0) });
    expect([0, 1, 2, 3].map((b) => slots(st.score, cursor(0, b, 0)))).toEqual([['snare'], [], ['snare'], []]);
    expect(st.moved).toEqual({ items: [cursor(0, 0, 0), cursor(0, 2, 0)], count: 2 });
  });
});
