import { describe, it, expect } from 'vitest';
import { NoteValue } from '../src/core/noteValue.js';
import { emptyBeat, bar, newScore } from '../src/core/score.js';
import { cursor, next, prev, beatAt } from '../src/core/cursor.js';

const score = (...beats) => ({ ...newScore({ title: 't' }), bars: [bar(beats)] });

describe('cursor', () => {
  it('next walks the cells inside a subdivided beat', () => {
    const s = score(emptyBeat(NoteValue.SIXTEENTH, 4), emptyBeat(NoteValue.QUARTER, 4));
    expect(next(s, cursor(0, 0, 0))).toEqual(cursor(0, 0, 1));
    expect(next(s, cursor(0, 0, 1))).toEqual(cursor(0, 0, 2));
  });
  it('next rolls from the last cell of a beat into the next beat', () => {
    const s = score(emptyBeat(NoteValue.EIGHTH, 4), emptyBeat(NoteValue.QUARTER, 4));
    expect(next(s, cursor(0, 0, 1))).toEqual(cursor(0, 1, 0));
  });
  it('next stops at the very end', () => {
    const s = score(emptyBeat(NoteValue.QUARTER, 4));
    expect(next(s, cursor(0, 0, 0))).toEqual(cursor(0, 0, 0));
  });
  it('prev rolls back into the last cell of the previous beat', () => {
    const s = score(emptyBeat(NoteValue.SIXTEENTH, 4), emptyBeat(NoteValue.QUARTER, 4));
    expect(prev(s, cursor(0, 1, 0))).toEqual(cursor(0, 0, 3));
  });
  it('prev stops at the very start', () => {
    const s = score(emptyBeat(NoteValue.QUARTER, 4));
    expect(prev(s, cursor(0, 0, 0))).toEqual(cursor(0, 0, 0));
  });
  it('next crosses a bar line and prev crosses back', () => {
    const s = {
      ...newScore({ title: 't' }),
      bars: [bar([emptyBeat(NoteValue.QUARTER, 4)]), bar([emptyBeat(NoteValue.EIGHTH, 4)])],
    };
    expect(next(s, cursor(0, 0, 0))).toEqual(cursor(1, 0, 0));
    expect(prev(s, cursor(1, 0, 0))).toEqual(cursor(0, 0, 0));
  });
  it('beatAt returns the beat under the cursor', () => {
    const s = score(emptyBeat(NoteValue.QUARTER, 4), emptyBeat(NoteValue.EIGHTH, 4));
    expect(beatAt(s, cursor(0, 1, 0)).cells.length).toBe(2);
  });
});
