import { describe, it, expect } from 'vitest';
import { NoteValue, cellsPerBeat } from '../src/core/noteValue.js';

describe('cellsPerBeat', () => {
  it('a quarter beat divided into eighths holds two cells', () => {
    expect(cellsPerBeat(NoteValue.EIGHTH, 4, null)).toBe(2);
  });
  it('a quarter beat divided into sixteenths holds four cells', () => {
    expect(cellsPerBeat(NoteValue.SIXTEENTH, 4, null)).toBe(4);
  });
  it('a beat at its own value is a single cell', () => {
    expect(cellsPerBeat(NoteValue.QUARTER, 4, null)).toBe(1);
  });
  it('a tuplet overrides the written value', () => {
    expect(cellsPerBeat(NoteValue.EIGHTH, 4, 3)).toBe(3);
    expect(cellsPerBeat(NoteValue.SIXTEENTH, 4, 5)).toBe(5);
  });
  it('a value longer than the beat still occupies one cell', () => {
    expect(cellsPerBeat(NoteValue.HALF, 4, null)).toBe(1);
  });
  it('an eighth beat divided into sixteenths holds two cells', () => {
    expect(cellsPerBeat(NoteValue.SIXTEENTH, 8, null)).toBe(2);
  });
  it('note values are ordered whole to thirty-second', () => {
    expect(NoteValue.WHOLE.divisionsPerWhole).toBe(1);
    expect(NoteValue.THIRTY_SECOND.divisionsPerWhole).toBe(32);
  });
});
