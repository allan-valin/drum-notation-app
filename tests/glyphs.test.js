import { describe, it, expect } from 'vitest';
import { Glyphs } from '../src/core/glyphs.js';
import { Notehead } from '../src/core/profile.js';
import { NoteValue } from '../src/core/noteValue.js';

const code = (s) => s.codePointAt(0);

describe('glyph table', () => {
  it('a quarter and shorter use the filled notehead', () => {
    expect(Glyphs.notehead(Notehead.NORMAL, NoteValue.QUARTER)).toBe(Glyphs.notehead(Notehead.NORMAL, NoteValue.SIXTEENTH));
  });
  it('a half is hollow and a quarter is not', () => {
    expect(Glyphs.notehead(Notehead.NORMAL, NoteValue.HALF)).not.toBe(Glyphs.notehead(Notehead.NORMAL, NoteValue.QUARTER));
  });
  it('cymbals use a cross notehead', () => {
    expect(Glyphs.notehead(Notehead.CROSS, NoteValue.QUARTER)).not.toBe(Glyphs.notehead(Notehead.NORMAL, NoteValue.QUARTER));
  });
  it('rests differ per value', () => {
    expect(Glyphs.rest(NoteValue.QUARTER)).not.toBe(Glyphs.rest(NoteValue.EIGHTH));
  });
  it('tuplet digits are consecutive', () => {
    expect(code(Glyphs.tupletDigit(4))).toBe(code(Glyphs.tupletDigit(3)) + 1);
  });
  it('flags exist for eighth and shorter only', () => {
    expect(Glyphs.flag(NoteValue.EIGHTH)).not.toBe('');
    expect(Glyphs.flag(NoteValue.QUARTER)).toBe('');
  });
  it('time signature digits are consecutive from zero', () => {
    expect(code(Glyphs.timeSigDigit(4))).toBe(code(Glyphs.timeSigDigit(0)) + 4);
  });
  it('every glyph lives in the SMuFL private use area', () => {
    const all = [
      Glyphs.notehead(Notehead.NORMAL, NoteValue.QUARTER),
      Glyphs.notehead(Notehead.CROSS, NoteValue.QUARTER),
      Glyphs.notehead(Notehead.CROSS, NoteValue.HALF),
      Glyphs.rest(NoteValue.QUARTER), Glyphs.ACCENT, Glyphs.BARLINE, Glyphs.STAFF5,
      Glyphs.tupletDigit(3), Glyphs.flag(NoteValue.EIGHTH), Glyphs.PERCUSSION_CLEF,
      Glyphs.PAREN_LEFT, Glyphs.PAREN_RIGHT, Glyphs.FF, Glyphs.PP,
    ];
    for (const g of all) {
      expect(code(g)).toBeGreaterThanOrEqual(0xe000);
      expect(code(g)).toBeLessThanOrEqual(0xf8ff);
    }
  });
  it('matches the codepoints verified against glyphnames.json on 2026-10-18', () => {
    expect(code(Glyphs.notehead(Notehead.NORMAL, NoteValue.QUARTER))).toBe(0xe0a4);
    expect(code(Glyphs.notehead(Notehead.CROSS, NoteValue.QUARTER))).toBe(0xe0a9);
    expect(code(Glyphs.rest(NoteValue.EIGHTH))).toBe(0xe4e6);
    expect(code(Glyphs.flag(NoteValue.SIXTEENTH))).toBe(0xe242);
  });
});
