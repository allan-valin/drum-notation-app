import { describe, it, expect } from 'vitest';
import { layoutBar, staffPositionAt, yOf } from '../src/core/layout.js';
import { Glyphs } from '../src/core/glyphs.js';
import { DRUM_PROFILE } from '../src/core/profile.js';
import { NoteValue } from '../src/core/noteValue.js';
import { note, cell, beat, bar, emptyBeat, emptyBar, Articulation, Sticking } from '../src/core/score.js';

const staff = DRUM_PROFILE.staves[0];
const config = { width: 1000, staffSpacing: 10 };
const snareBeat = (division, count) => beat(division, null, Array.from({ length: count }, () => cell([note('snare')])));
const snareOf = (r) => r.glyphs.filter((g) => g.slotId === 'snare');

describe('layoutBar', () => {
  it('an empty bar still lays out its bar line', () => {
    const r = layoutBar(emptyBar(4, 4), staff, config);
    expect(r.glyphs.some((g) => g.glyph === Glyphs.BARLINE)).toBe(true);
  });
  it('a note lands at the vertical position of its slot', () => {
    const r = layoutBar(bar([snareBeat(NoteValue.QUARTER, 1)]), staff, config);
    const snare = staff.slots.find((s) => s.id === 'snare');
    expect(snareOf(r)[0].y).toBeCloseTo((4 - snare.staffPosition * 0.5) * config.staffSpacing);
  });
  it('cells inside a beat are evenly spaced', () => {
    const r = layoutBar(bar([snareBeat(NoteValue.SIXTEENTH, 4)]), staff, config);
    const xs = snareOf(r).map((g) => g.x).sort((a, b) => a - b);
    expect(xs.length).toBe(4);
    const gaps = xs.slice(1).map((x, i) => x - xs[i]);
    gaps.forEach((g) => expect(g).toBeCloseTo(gaps[0]));
  });
  it('simultaneous notes share an x', () => {
    const r = layoutBar(bar([beat(NoteValue.QUARTER, null, [cell([note('kick'), note('hihat')])])]), staff, config);
    expect(r.glyphs.find((g) => g.slotId === 'kick').x).toBeCloseTo(r.glyphs.find((g) => g.slotId === 'hihat').x);
  });
  it('the focused beat is wider than the others', () => {
    const r = layoutBar(emptyBar(4, 4), staff, { ...config, focusedBeat: 0 });
    const w = (b) => b[1] - b[0];
    expect(w(r.beatBounds[0])).toBeGreaterThan(w(r.beatBounds[1]));
  });
  it('beat bounds tile the bar without gaps or overlap', () => {
    const r = layoutBar(emptyBar(4, 4), staff, { ...config, focusedBeat: 2 });
    r.beatBounds.slice(1).forEach((b, i) => expect(b[0]).toBeCloseTo(r.beatBounds[i][1]));
    expect(r.beatBounds[r.beatBounds.length - 1][1]).toBeLessThanOrEqual(config.width);
  });
  it('beamed sixteenths produce a beam line and no flags', () => {
    const r = layoutBar(bar([snareBeat(NoteValue.SIXTEENTH, 4)]), staff, config);
    expect(r.beams.length).toBeGreaterThanOrEqual(1);
    expect(r.glyphs.some((g) => g.glyph === Glyphs.flag(NoteValue.SIXTEENTH))).toBe(false);
  });
  it('a lone eighth gets a flag, not a beam', () => {
    const r = layoutBar(bar([beat(NoteValue.EIGHTH, null, [cell([note('snare')]), cell()])]), staff, config);
    expect(r.beams.length).toBe(0);
    expect(r.glyphs.some((g) => g.glyph === Glyphs.flag(NoteValue.EIGHTH))).toBe(true);
  });
  it('every sounding cell has a stem', () => {
    const r = layoutBar(bar([snareBeat(NoteValue.EIGHTH, 2)]), staff, config);
    expect(r.stems.length).toBe(2);
  });
  it('an empty cell lays out a rest', () => {
    const r = layoutBar(bar([beat(NoteValue.EIGHTH, null, [cell([note('snare')]), cell()])]), staff, config);
    expect(r.glyphs.some((g) => g.glyph === Glyphs.rest(NoteValue.EIGHTH))).toBe(true);
  });
  it('a tuplet digit is laid out over the beat', () => {
    const r = layoutBar(bar([beat(NoteValue.EIGHTH, 3, Array.from({ length: 3 }, () => cell([note('snare')])))]), staff, config);
    expect(r.glyphs.some((g) => g.glyph === Glyphs.tupletDigit(3))).toBe(true);
  });
  it('an accent is drawn above the note, a ghost in parentheses, sticking as text', () => {
    const b = beat(NoteValue.QUARTER, null, [
      cell([note('snare', { articulations: [Articulation.ACCENT, Articulation.GHOST], sticking: Sticking.R })]),
    ]);
    const r = layoutBar(bar([b]), staff, config);
    expect(r.glyphs.some((g) => g.glyph === Glyphs.ACCENT)).toBe(true);
    expect(r.glyphs.some((g) => g.glyph === Glyphs.PAREN_LEFT)).toBe(true);
    expect(r.texts.some((t) => t.text === 'R')).toBe(true);
  });
  it('noteheads carry their cell and beat so a tap can be traced back', () => {
    const r = layoutBar(bar([emptyBeat(NoteValue.QUARTER, 4), snareBeat(NoteValue.EIGHTH, 2)]), staff, config);
    const heads = snareOf(r);
    expect(heads.map((g) => [g.beat, g.cell])).toEqual([[1, 0], [1, 1]]);
  });
  it('noteheads carry the note value for colouring', () => {
    const r = layoutBar(bar([snareBeat(NoteValue.SIXTEENTH, 4)]), staff, config);
    expect(snareOf(r).every((g) => g.value === NoteValue.SIXTEENTH)).toBe(true);
  });
  it('reports a height that contains every glyph', () => {
    const r = layoutBar(bar([beat(NoteValue.QUARTER, null, [cell([note('crash'), note('hihatPedal')])])]), staff, config);
    r.glyphs.forEach((g) => {
      expect(g.y).toBeGreaterThanOrEqual(r.top);
      expect(g.y).toBeLessThanOrEqual(r.bottom);
    });
  });
});

describe('staffPositionAt', () => {
  it('inverts yOf on the lines and spaces', () => {
    for (let p = -4; p <= 11; p++) expect(staffPositionAt(yOf(p, 10), 10)).toBe(p);
  });
  it('rounds to the nearest half-step', () => {
    expect(staffPositionAt(yOf(4, 10) + 2, 10)).toBe(4);
    expect(staffPositionAt(yOf(4, 10) - 3, 10)).toBe(5);
  });
});

describe('layout over nested cells and bar marks', () => {
  const nestedBar = () => bar([
    beat(NoteValue.EIGHTH, null, [cell([note('snare')]), beat(NoteValue.SIXTEENTH, null, [cell([note('snare')]), cell([note('snare')])])]),
  ]);
  it('places leaves at the centre of their share of the beat', () => {
    const r = layoutBar(nestedBar(), staff, config);
    const xs = r.leaves.map((l) => (l.x0 + l.x1) / 2);
    expect(xs[1] - xs[0]).toBeCloseTo(1.5 * (xs[2] - xs[1]));
  });
  it('reports each leaf with its path for hit-testing', () => {
    const r = layoutBar(nestedBar(), staff, config);
    expect(r.leaves.map((l) => l.path)).toEqual([[0], [1, 0], [1, 1]]);
  });
  it('draws a long beam and a short one', () => {
    const r = layoutBar(nestedBar(), staff, config);
    expect(r.beams.map((b) => b.level).sort()).toEqual([1, 2]);
    const [l1, l2] = [r.beams.find((b) => b.level === 1), r.beams.find((b) => b.level === 2)];
    expect(l1.x2 - l1.x1).toBeGreaterThan(l2.x2 - l2.x1);
  });
  it('noteheads take the value of their own group', () => {
    const r = layoutBar(nestedBar(), staff, config);
    expect(r.glyphs.filter((g) => g.kind === 'note').map((g) => g.value)).toEqual([NoteValue.EIGHTH, NoteValue.SIXTEENTH, NoteValue.SIXTEENTH]);
  });
  it('a simile bar shows the % sign and no notes or rests', () => {
    const b = { ...bar([snareBeat(NoteValue.QUARTER, 1)]), simile: true };
    const r = layoutBar(b, staff, config);
    expect(r.glyphs.some((g) => g.glyph === Glyphs.SIMILE)).toBe(true);
    expect(r.glyphs.some((g) => g.kind === 'note' || g.kind === 'rest')).toBe(false);
  });
  it('repeat marks replace the plain bar lines', () => {
    const b = { ...emptyBar(4, 4), repeatStart: true, repeatEnd: true };
    const r = layoutBar(b, staff, config);
    expect(r.glyphs.some((g) => g.glyph === Glyphs.REPEAT_LEFT)).toBe(true);
    expect(r.glyphs.some((g) => g.glyph === Glyphs.REPEAT_RIGHT)).toBe(true);
    expect(r.glyphs.some((g) => g.glyph === Glyphs.BARLINE)).toBe(false);
  });
});
