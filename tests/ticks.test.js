import { describe, it, expect } from 'vitest';
import { NoteValue } from '../src/core/noteValue.js';
import { emptyBeat, newScore } from '../src/core/score.js';
import { PPQ, cellTicks, barTicks } from '../src/core/ticks.js';

describe('ticks', () => {
  it('an unsubdivided quarter beat starts at zero', () => {
    expect(cellTicks(emptyBeat(NoteValue.QUARTER, 4), 4)).toEqual([0]);
  });
  it('eighths split the beat in half', () => {
    expect(cellTicks(emptyBeat(NoteValue.EIGHTH, 4), 4)).toEqual([0, PPQ / 2]);
  });
  it('a triplet divides evenly with no remainder', () => {
    expect(cellTicks(emptyBeat(NoteValue.EIGHTH, 4, 3), 4)).toEqual([0, 320, 640]);
  });
  it('a quintuplet divides evenly with no remainder', () => {
    expect(cellTicks(emptyBeat(NoteValue.SIXTEENTH, 4, 5), 4)).toEqual([0, 192, 384, 576, 768]);
  });
  it('a 4/4 bar is four quarters of ticks', () => {
    expect(barTicks(newScore({ title: 't' }))).toBe(PPQ * 4);
  });
});
