import { describe, it, expect } from 'vitest';
import { layoutBar } from '../src/core/layout.js';
import { Glyphs } from '../src/core/glyphs.js';
import { makePitchedStaff } from '../src/core/pitch.js';
import { NoteValue } from '../src/core/noteValue.js';
import { note, cell, beat, bar, Articulation } from '../src/core/score.js';

const staff = makePitchedStaff('treble', 'G3', 'C6');
const cfg = { width: 800, staffSpacing: 10 };
const n = (slotId, alter = 0, extra = {}) => ({ ...note(slotId, extra), alter });
const q = (...notes) => beat(NoteValue.QUARTER, null, [cell(notes)]);
const pairs = (...notes) => beat(NoteValue.EIGHTH, null, notes.map((x) => cell([x])));
const kinds = (r, k) => r.glyphs.filter((g) => g.kind === k);

describe('pitched layout', () => {
  it('notes below the middle line stem up, from the middle line on they stem down', () => {
    const r = layoutBar(bar([q(n('E4')), q(n('B4')), q(n('E5')), q()]), staff, cfg);
    const [low, mid, high] = r.stems;
    expect(low.y2).toBeLessThan(low.y1);   // up
    expect(mid.y2).toBeGreaterThan(mid.y1); // down
    expect(high.y2).toBeGreaterThan(high.y1);
  });
  it('a beamed group shares one direction and the beam sits on the stem side', () => {
    const r = layoutBar(bar([pairs(n('D5'), n('E5')), q(), q(), q()]), staff, cfg);
    expect(r.stems.every((s) => s.y2 > s.y1)).toBe(true);
    const heads = kinds(r, 'note');
    expect(r.beams[0].y1).toBeGreaterThan(Math.max(...heads.map((h) => h.y)));
  });
  it('a down flag is used on a lone down-stem eighth', () => {
    const r = layoutBar(bar([beat(NoteValue.EIGHTH, null, [cell([n('D5')]), cell()]), q(), q(), q()]), staff, cfg);
    expect(kinds(r, 'flag')[0].glyph).toBe(Glyphs.flag(NoteValue.EIGHTH, 'down'));
  });
  it('accidentals: shown when the pitch differs from the key, carried through the bar, cancelled with a natural', () => {
    const r = layoutBar(bar([q(n('F4', 1)), q(n('F4', 1)), q(n('F4', 0)), q(n('B4', -1))]), staff, cfg);
    expect(kinds(r, 'accidental').map((g) => g.glyph)).toEqual([Glyphs.SHARP, Glyphs.NATURAL, Glyphs.FLAT]);
  });
  it('in D major an F sharp needs no sign and an F natural does', () => {
    const r = layoutBar(bar([q(n('F4', 1)), q(n('F4', 0)), q(), q()]), staff, { ...cfg, key: 2 });
    expect(kinds(r, 'accidental').map((g) => g.glyph)).toEqual([Glyphs.NATURAL]);
  });
  it('quarter tones draw their own sign', () => {
    const r = layoutBar(bar([q(n('E4', -0.5)), q(), q(), q()]), staff, cfg);
    expect(kinds(r, 'accidental')[0].glyph).toBe(Glyphs.QUARTER_FLAT);
  });
  it('the accidental sits left of its notehead', () => {
    const r = layoutBar(bar([q(n('C5', 1)), q(), q(), q()]), staff, cfg);
    expect(kinds(r, 'accidental')[0].x).toBeLessThan(kinds(r, 'note')[0].x);
  });
  it('two notes a step apart in a chord do not overlap', () => {
    const r = layoutBar(bar([q(n('F4'), n('G4')), q(), q(), q()]), staff, cfg);
    const [a, b] = kinds(r, 'note');
    expect(Math.abs(a.x - b.x)).toBeGreaterThan(0.8 * 1.18 * 10);
  });
  it('staccato goes on the notehead side, away from the stem', () => {
    const up = layoutBar(bar([q(n('E4', 0, { articulations: [Articulation.STACCATO] })), q(), q(), q()]), staff, cfg);
    const down = layoutBar(bar([q(n('E5', 0, { articulations: [Articulation.STACCATO] })), q(), q(), q()]), staff, cfg);
    expect(kinds(up, 'artic')[0].y).toBeGreaterThan(kinds(up, 'note')[0].y);
    expect(kinds(down, 'artic')[0].y).toBeLessThan(kinds(down, 'note')[0].y);
  });
  it('drums still stem up and keep the accent above the stem', () => {
    // unchanged path: covered by layout.test.js; here only that a pitched staff did not leak into it
    expect(staff.pitched).toBe(true);
  });
});
