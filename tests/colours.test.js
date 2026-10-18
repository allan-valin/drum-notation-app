import { describe, it, expect } from 'vitest';
import { DEFAULT_COLOURS, INK, colourFor, withColour, normaliseColours } from '../src/core/colours.js';
import { NoteValue, NOTE_VALUES } from '../src/core/noteValue.js';

describe('colour per note value', () => {
  it('has a default for every value: a hex or the theme ink', () => {
    NOTE_VALUES.forEach((v) => expect(DEFAULT_COLOURS[v.id]).toMatch(/^(#[0-9a-f]{6}|ink)$/i));
  });
  it('quarters and longer follow the theme ink, so they match the staff lines', () => {
    expect(DEFAULT_COLOURS.quarter).toBe(INK);
    expect(DEFAULT_COLOURS.half).toBe(INK);
    expect(colourFor(NoteValue.QUARTER, DEFAULT_COLOURS)).toBe('currentColor');
  });
  it('eighths and sixteenths are coloured and differ', () => {
    expect(colourFor(NoteValue.EIGHTH)).toMatch(/^#/);
    expect(colourFor(NoteValue.EIGHTH)).not.toBe(colourFor(NoteValue.SIXTEENTH));
  });
  it('a user override wins and the defaults stay untouched', () => {
    const mine = withColour(DEFAULT_COLOURS, NoteValue.EIGHTH, '#ff0000');
    expect(colourFor(NoteValue.EIGHTH, mine)).toBe('#ff0000');
    expect(colourFor(NoteValue.EIGHTH, DEFAULT_COLOURS)).not.toBe('#ff0000');
  });
  it('a partial map falls back to the default', () => {
    expect(colourFor(NoteValue.HALF, { eighth: '#ff0000' })).toBe('currentColor');
  });
  it('migrates the old hard-coded black to ink and keeps real overrides', () => {
    const old = { whole: '#1c1c1e', half: '#1c1c1e', quarter: '#1c1c1e', eighth: '#ff0000' };
    const n = normaliseColours(old);
    expect(n.quarter).toBe(INK);
    expect(n.eighth).toBe('#ff0000');
    expect(n.sixteenth).toBe(DEFAULT_COLOURS.sixteenth);
  });
});
