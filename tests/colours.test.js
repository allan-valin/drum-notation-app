import { describe, it, expect } from 'vitest';
import { DEFAULT_COLOURS, colourFor, withColour } from '../src/core/colours.js';
import { NoteValue, NOTE_VALUES } from '../src/core/noteValue.js';

describe('colour per note value', () => {
  it('has a default for every value', () => {
    NOTE_VALUES.forEach((v) => expect(colourFor(v, DEFAULT_COLOURS)).toMatch(/^#[0-9a-f]{6}$/i));
  });
  it('eighths and sixteenths differ by default', () => {
    expect(colourFor(NoteValue.EIGHTH, DEFAULT_COLOURS)).not.toBe(colourFor(NoteValue.SIXTEENTH, DEFAULT_COLOURS));
  });
  it('a user override wins and the defaults stay untouched', () => {
    const mine = withColour(DEFAULT_COLOURS, NoteValue.EIGHTH, '#ff0000');
    expect(colourFor(NoteValue.EIGHTH, mine)).toBe('#ff0000');
    expect(colourFor(NoteValue.EIGHTH, DEFAULT_COLOURS)).not.toBe('#ff0000');
  });
  it('a partial map falls back to the default', () => {
    expect(colourFor(NoteValue.HALF, { eighth: '#ff0000' })).toBe(DEFAULT_COLOURS.half);
  });
});
