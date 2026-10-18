import { describe, it, expect } from 'vitest';
import { NoteValue } from '../src/core/noteValue.js';
import { note, cell, emptyBeat, emptyBar, newScore } from '../src/core/score.js';

describe('score model', () => {
  it('an empty beat has one cell per subdivision, all silent', () => {
    const beat = emptyBeat(NoteValue.EIGHTH, 4);
    expect(beat.cells.length).toBe(2);
    expect(beat.cells.every((c) => c.notes.length === 0)).toBe(true);
  });
  it('an empty triplet beat has three cells', () => {
    expect(emptyBeat(NoteValue.EIGHTH, 4, 3).cells.length).toBe(3);
  });
  it('an empty 4/4 bar has four unsubdivided beats', () => {
    const bar = emptyBar(4, 4);
    expect(bar.beats.length).toBe(4);
    expect(bar.beats.every((b) => b.cells.length === 1)).toBe(true);
  });
  it('an empty 3/4 bar has three beats', () => {
    expect(emptyBar(3, 4).beats.length).toBe(3);
  });
  it('notes in one cell sound together', () => {
    expect(cell([note('kick'), note('hihat')]).notes.length).toBe(2);
  });
  it('a new score starts with one empty bar and sane defaults', () => {
    const s = newScore({ title: 'Paradiddle' });
    expect(s.bars.length).toBe(1);
    expect(s.timeSigNum).toBe(4);
    expect(s.timeSigDen).toBe(4);
    expect(s.defaultBpm).toBe(80);
    expect(s.profileId).toBe('drums');
    expect(typeof s.id).toBe('string');
  });
});
