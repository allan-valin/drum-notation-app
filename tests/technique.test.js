import { describe, it, expect } from 'vitest';
import { NoteValue } from '../src/core/noteValue.js';
import { note, cell, beat, bar, newScore, Mark, Roll, Grace } from '../src/core/score.js';
import { Notehead, DRUM_PROFILE } from '../src/core/profile.js';
import { Glyphs } from '../src/core/glyphs.js';
import { layoutBar } from '../src/core/layout.js';
import { encode, decode } from '../src/core/json.js';
import { initialState, reduce } from '../src/core/editorState.js';
import { leafAt } from '../src/core/cursor.js';
import { setBarText } from '../src/core/edit.js';

const staff = DRUM_PROFILE.staves[0];
const cfg = { width: 600, staffSpacing: 10 };
const one = (n) => bar([beat(NoteValue.QUARTER, null, [cell([n])])]);
const cp = (s) => s.codePointAt(0);

describe('noteheads', () => {
  it('has diamond, triangle, circled X and slashed heads, verified codepoints', () => {
    expect(cp(Glyphs.notehead(Notehead.DIAMOND, NoteValue.QUARTER))).toBe(0xe0db);
    expect(cp(Glyphs.notehead(Notehead.TRIANGLE, NoteValue.QUARTER))).toBe(0xe0be);
    expect(cp(Glyphs.notehead(Notehead.CIRCLE_X, NoteValue.QUARTER))).toBe(0xe0b3);
    expect(cp(Glyphs.notehead(Notehead.SLASHED, NoteValue.QUARTER))).toBe(0xe0cf);
  });
  it('half notes get the hollow version of each head', () => {
    expect(Glyphs.notehead(Notehead.DIAMOND, NoteValue.HALF)).not.toBe(Glyphs.notehead(Notehead.DIAMOND, NoteValue.QUARTER));
  });
  it('a note head overrides the slot default', () => {
    const r = layoutBar(one(note('ride', { head: Notehead.DIAMOND })), staff, cfg);
    expect(r.glyphs.find((g) => g.kind === 'note').glyph).toBe(Glyphs.notehead(Notehead.DIAMOND, NoteValue.QUARTER));
  });
  it('cross-stick is an X head on the snare line', () => {
    const r = layoutBar(one(note('snare', { head: Notehead.CROSS })), staff, cfg);
    expect(r.glyphs.find((g) => g.kind === 'note').glyph).toBe(Glyphs.notehead(Notehead.CROSS, NoteValue.QUARTER));
  });
});

describe('technique marks', () => {
  it('open, closed, half-open and choke (a dot, as the Rock Band key draws it) sit above the note', () => {
    for (const [m, g] of [[Mark.OPEN, Glyphs.OPEN], [Mark.CLOSED, Glyphs.CLOSED], [Mark.HALF_OPEN, Glyphs.HALF_OPEN], [Mark.CHOKE, Glyphs.STACCATO]]) {
      const r = layoutBar(one(note('hihat', { marks: [m] })), staff, cfg);
      const mark = r.glyphs.find((x) => x.glyph === g);
      const head = r.glyphs.find((x) => x.kind === 'note');
      expect(mark, m).toBeTruthy();
      expect(mark.y).toBeLessThan(head.y);
    }
  });
  it('a buzz roll sits on the stem, a tremolo too', () => {
    for (const [roll, g] of [[Roll.BUZZ, Glyphs.BUZZ], [Roll.TREMOLO, Glyphs.TREMOLO3]]) {
      const r = layoutBar(one(note('snare', { roll })), staff, cfg);
      const glyph = r.glyphs.find((x) => x.glyph === g);
      const stem = r.stems[0];
      // between the stem's two ends, whichever way it points (the snare stems down)
      expect(glyph.y).toBeLessThan(Math.max(stem.y1, stem.y2));
      expect(glyph.y).toBeGreaterThan(Math.min(stem.y1, stem.y2));
    }
  });
  it('a flam draws one grace note before the head, a drag two', () => {
    const flam = layoutBar(one(note('snare', { grace: Grace.FLAM })), staff, cfg);
    const drag = layoutBar(one(note('snare', { grace: Grace.DRAG })), staff, cfg);
    const head = (r) => r.glyphs.find((x) => x.kind === 'note');
    expect(flam.glyphs.filter((x) => x.kind === 'grace').length).toBe(1);
    expect(drag.glyphs.filter((x) => x.kind === 'grace').length).toBe(2);
    flam.glyphs.filter((x) => x.kind === 'grace').forEach((g) => expect(g.x).toBeLessThan(head(flam).x));
  });
});

describe('JSON and editor state carry techniques', () => {
  it('round-trips head, marks, roll, grace and bar text', () => {
    let s = newScore({ id: 'x', title: 't', createdAt: 1, updatedAt: 1 });
    s = { ...s, bars: [{ ...one(note('hihat', { head: Notehead.DIAMOND, marks: [Mark.OPEN], roll: Roll.BUZZ, grace: Grace.FLAM })), timeSig: [1, 4] }] };
    s = setBarText(s, 0, 'vassouras');
    s = { ...s, updatedAt: 1 };
    expect(decode(encode(s))).toEqual(s);
  });
  it('rejects an unknown head', () => {
    const j = { schema_version: 2, timeSigNum: 1, bars: [{ beats: [{ division: 'quarter', cells: [[{ slot: 'snare', head: 'star' }]] }] }] };
    expect(() => decode(JSON.stringify(j))).toThrow(/star/);
  });
  it('head and technique ride on the next placed note', () => {
    let st = initialState(newScore({ title: 't' }));
    st = reduce(st, { type: 'setHead', head: Notehead.TRIANGLE });
    st = reduce(st, { type: 'setTech', tech: Mark.OPEN });
    st = reduce(st, { type: 'tap', staffPosition: 8 });
    expect(leafAt(st.score, st.cursor).notes[0]).toMatchObject({ slotId: 'hihat', head: Notehead.TRIANGLE, marks: [Mark.OPEN], roll: null, grace: null });
  });
  it('choosing the same head again clears it back to the slot default', () => {
    let st = initialState(newScore({ title: 't' }));
    st = reduce(reduce(st, { type: 'setHead', head: Notehead.DIAMOND }), { type: 'setHead', head: Notehead.DIAMOND });
    expect(st.tool.head).toBe(null);
  });
});

describe('bar text', () => {
  it('sits above every other glyph in the bar', () => {
    const b = { ...one(note('hihat', { marks: [Mark.OPEN], articulations: ['accent'] })), text: 'vassouras' };
    const r = layoutBar(b, staff, cfg);
    const text = r.texts.find((x) => x.kind === 'barText');
    for (const g of r.glyphs) expect(text.y).toBeLessThan(g.y);
    expect(r.top).toBeLessThan(text.y);
  });
});
