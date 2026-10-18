import { describe, it, expect } from 'vitest';
import { NoteValue } from '../src/core/noteValue.js';
import { note, emptyBar, newScore, Articulation } from '../src/core/score.js';
import { cursor, beatAt } from '../src/core/cursor.js';
import { placeNote, deleteNote, subdivide, addBar, removeBar } from '../src/core/edit.js';

const score = () => ({ ...newScore({ title: 't' }), bars: [emptyBar(4, 4)] });
const notesAt = (s, c) => beatAt(s, c).cells[c.cell].notes;
const c0 = cursor(0, 0, 0);

describe('editing rules', () => {
  it('placing a note puts it in the cell', () => {
    const s = placeNote(score(), c0, note('snare'));
    expect(notesAt(s, c0)).toEqual([note('snare')]);
  });
  it('a different slot in the same cell sounds together', () => {
    const s = placeNote(placeNote(score(), c0, note('kick')), c0, note('hihat'));
    expect(new Set(notesAt(s, c0).map((n) => n.slotId))).toEqual(new Set(['kick', 'hihat']));
  });
  it('placing on the same slot overwrites instead of duplicating', () => {
    const s = placeNote(
      placeNote(score(), c0, note('snare')),
      c0,
      note('snare', { articulations: [Articulation.ACCENT] }),
    );
    expect(notesAt(s, c0).length).toBe(1);
    expect(notesAt(s, c0)[0].articulations).toEqual([Articulation.ACCENT]);
  });
  it('deleting removes only that slot', () => {
    const s = deleteNote(placeNote(placeNote(score(), c0, note('kick')), c0, note('hihat')), c0, 'kick');
    expect(notesAt(s, c0).map((n) => n.slotId)).toEqual(['hihat']);
  });
  it('deleting a slot that is not there changes nothing', () => {
    const s = placeNote(score(), c0, note('kick'));
    expect(deleteNote(s, c0, 'ride')).toBe(s);
  });
  it('subdividing a beat gives it the right number of cells', () => {
    const s = subdivide(score(), c0, NoteValue.EIGHTH, null);
    expect(s.bars[0].beats[0].cells.length).toBe(2);
    expect(s.bars[0].beats[0].division).toBe(NoteValue.EIGHTH);
  });
  it('subdividing into a triplet gives three cells', () => {
    const s = subdivide(score(), c0, NoteValue.EIGHTH, 3);
    expect(s.bars[0].beats[0].cells.length).toBe(3);
    expect(s.bars[0].beats[0].tuplet).toBe(3);
  });
  it('subdividing keeps notes that still fit', () => {
    const s = subdivide(placeNote(score(), c0, note('snare')), c0, NoteValue.EIGHTH, null);
    expect(notesAt(s, c0).map((n) => n.slotId)).toEqual(['snare']);
  });
  it('subdividing smaller drops notes that no longer fit', () => {
    let s = subdivide(score(), c0, NoteValue.SIXTEENTH, null);
    s = placeNote(s, cursor(0, 0, 3), note('snare'));
    s = subdivide(s, c0, NoteValue.EIGHTH, null);
    expect(s.bars[0].beats[0].cells.length).toBe(2);
    expect(s.bars[0].beats[0].cells.every((c) => c.notes.length === 0)).toBe(true);
  });
  it('subdividing one beat leaves its neighbours alone', () => {
    const s = subdivide(score(), c0, NoteValue.SIXTEENTH, null);
    expect(s.bars[0].beats[1].cells.length).toBe(1);
  });
  it('editing returns a new score and leaves the original untouched', () => {
    const before = score();
    placeNote(before, c0, note('snare'));
    expect(before.bars[0].beats[0].cells[0].notes.length).toBe(0);
  });
  it('addBar appends an empty bar in the score time signature', () => {
    const s = addBar({ ...score(), timeSigNum: 3 });
    expect(s.bars.length).toBe(2);
    expect(s.bars[1].beats.length).toBe(3);
  });
  it('removeBar drops the bar but never the last one', () => {
    const s = removeBar(addBar(score()), 1);
    expect(s.bars.length).toBe(1);
    expect(removeBar(s, 0).bars.length).toBe(1);
  });
});
