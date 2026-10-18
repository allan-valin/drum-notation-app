import { describe, it, expect } from 'vitest';
import { NoteValue } from '../src/core/noteValue.js';
import { newScore, note, leaf } from '../src/core/score.js';
import { toFull, addPart, partView } from '../src/core/parts.js';
import { cursor, leafAt } from '../src/core/cursor.js';
import { setLength, toggleTie, placeNote, addBar, splitBeat } from '../src/core/edit.js';
import { layoutBar } from '../src/core/layout.js';
import { Glyphs } from '../src/core/glyphs.js';
import { performance } from '../src/core/schedule.js';
import { encode, decodeFull } from '../src/core/json.js';
import { initialState, reduce } from '../src/core/editorState.js';
import { profileById } from '../src/core/profile.js';
import { PPQ } from '../src/core/ticks.js';

const keys = () => {
  const full = addPart(toFull(newScore({ id: 'k', title: 't', defaultBpm: 120 })), 'keys');
  return partView(full, full.parts[1].id);
};
const staff = profileById('keys').staves[0];
const A4 = (extra = {}) => ({ ...note('A4', extra), alter: 0 });
const cfg = { width: 800, staffSpacing: 10 };
const heads = (r) => r.glyphs.filter((g) => g.kind === 'note');
const conts = (s, b = 0) => s.bars[b].beats.map((bt) => bt.cells.map((c) => (c.cont ? 'c' : c.notes?.length ? 'n' : '-')).join(''));

describe('setLength (pitched)', () => {
  it('a half note on beat 1 continues into beat 2', () => {
    const s = setLength(placeNote(keys(), cursor(0, 0, 0), A4()), cursor(0, 0, 0), NoteValue.HALF, false);
    expect(conts(s)).toEqual(['n', 'c', '-', '-']);
  });
  it('a whole note fills the bar', () => {
    const s = setLength(placeNote(keys(), cursor(0, 0, 0), A4()), cursor(0, 0, 0), NoteValue.WHOLE, false);
    expect(conts(s)).toEqual(['n', 'c', 'c', 'c']);
  });
  it('a dotted half lasts three beats', () => {
    const s = setLength(placeNote(keys(), cursor(0, 1, 0), A4()), cursor(0, 1, 0), NoteValue.HALF, true);
    expect(conts(s)).toEqual(['-', 'n', 'c', 'c']);
  });
  it('a dotted quarter splits the next beat into eighths and takes the first', () => {
    const s = setLength(placeNote(keys(), cursor(0, 0, 0), A4()), cursor(0, 0, 0), NoteValue.QUARTER, true);
    expect(conts(s)).toEqual(['n', 'c-', '-', '-']);
  });
  it('a dotted eighth inside a beat: three sixteenths, the last one free', () => {
    const s = setLength(placeNote(keys(), cursor(0, 0, 0), A4()), cursor(0, 0, 0), NoteValue.EIGHTH, true);
    expect(conts(s)).toEqual(['ncc-', '-', '-', '-']);
  });
  it('refuses to cover notes, or to run past the bar', () => {
    let s = placeNote(placeNote(keys(), cursor(0, 0, 0), A4()), cursor(0, 1, 0), A4());
    expect(setLength(s, cursor(0, 0, 0), NoteValue.HALF, false)).toEqual({ refused: 'wouldLoseNotes' });
    s = placeNote(keys(), cursor(0, 3, 0), A4());
    expect(setLength(s, cursor(0, 3, 0), NoteValue.HALF, false)).toEqual({ refused: 'doesNotFit' });
  });
  it('a shorter value frees the beats the long note held', () => {
    let s = setLength(placeNote(keys(), cursor(0, 0, 0), A4()), cursor(0, 0, 0), NoteValue.WHOLE, false);
    s = setLength(s, cursor(0, 0, 0), NoteValue.QUARTER, false);
    expect(conts(s)).toEqual(['n', '-', '-', '-']);
  });
});

describe('ties', () => {
  it('toggleTie makes an empty cell continue the note before it, across a bar line too', () => {
    let s = addBar(placeNote(keys(), cursor(0, 3, 0), A4()));
    s = toggleTie(s, cursor(1, 0, 0));
    expect(s.bars[1].beats[0].cells[0].cont).toBe(true);
    expect(toggleTie(s, cursor(1, 0, 0)).bars[1].beats[0].cells[0].cont).toBeFalsy();
  });
  it('writing a note into a continuation makes it a new note', () => {
    let s = setLength(placeNote(keys(), cursor(0, 0, 0), A4()), cursor(0, 0, 0), NoteValue.HALF, false);
    s = placeNote(s, cursor(0, 1, 0), A4());
    expect(conts(s)).toEqual(['n', 'n', '-', '-']);
  });
});

describe('drawing lengths', () => {
  it('a half note is one hollow head, and the held beat draws nothing', () => {
    const s = setLength(placeNote(keys(), cursor(0, 0, 0), A4()), cursor(0, 0, 0), NoteValue.HALF, false);
    const r = layoutBar(s.bars[0], staff, cfg);
    expect(heads(r).length).toBe(1);
    expect(heads(r)[0].glyph).toBe(Glyphs.notehead('normal', NoteValue.HALF));
    expect(r.glyphs.filter((g) => g.kind === 'rest').length).toBe(2);
  });
  it('a whole note has no stem', () => {
    const s = setLength(placeNote(keys(), cursor(0, 0, 0), A4()), cursor(0, 0, 0), NoteValue.WHOLE, false);
    const r = layoutBar(s.bars[0], staff, cfg);
    expect(heads(r)[0].glyph).toBe(Glyphs.notehead('normal', NoteValue.WHOLE));
    expect(r.stems.length).toBe(0);
  });
  it('dotted values get a dot', () => {
    const s = setLength(placeNote(keys(), cursor(0, 0, 0), A4()), cursor(0, 0, 0), NoteValue.QUARTER, true);
    const r = layoutBar(s.bars[0], staff, cfg);
    expect(heads(r).length).toBe(1);
    expect(r.glyphs.filter((g) => g.kind === 'dot').length).toBe(1);
  });
  it('a dotted eighth and a sixteenth beam together with a stub', () => {
    let s = setLength(placeNote(keys(), cursor(0, 0, 0), A4()), cursor(0, 0, 0), NoteValue.EIGHTH, true);
    s = placeNote(s, cursor(0, 0, 3), A4());
    const r = layoutBar(s.bars[0], staff, cfg);
    expect(heads(r).length).toBe(2);
    expect(r.beams.map((b) => b.level).sort()).toEqual([1, 2]);
  });
  it('a tie that does not make a standard value is drawn as two heads and an arc', () => {
    let s = placeNote(keys(), cursor(0, 1, 0), A4());
    s = toggleTie(s, cursor(0, 2, 0)); // beat 2 + beat 3: a half on beat 2, allowed as one note
    s = splitBeat(s, cursor(0, 3, 0), NoteValue.EIGHTH, null);
    s = toggleTie(s, cursor(0, 3, 0));  // and on into an eighth: three beats' worth, not standard
    const r = layoutBar(s.bars[0], staff, cfg);
    expect(r.ties.length).toBeGreaterThan(0);
  });
  it('a note held into the next bar gets a tie running to the bar line', () => {
    let s = addBar(placeNote(keys(), cursor(0, 3, 0), A4()));
    s = toggleTie(s, cursor(1, 0, 0));
    const r = layoutBar(s.bars[0], staff, { ...cfg, tieOut: true });
    expect(r.ties.length).toBe(1);
    expect(r.ties[0].x2).toBeGreaterThan(cfg.width - 10);
  });
  it('a tie from the previous bar starts at the bar line', () => {
    let s = addBar(placeNote(keys(), cursor(0, 3, 0), A4()));
    s = toggleTie(s, cursor(1, 0, 0));
    const r = layoutBar(s.bars[1], staff, { ...cfg, carry: [A4()] });
    expect(heads(r).length).toBe(1);
    expect(r.ties[0].x1).toBeLessThanOrEqual(1);
  });
});

describe('playing lengths', () => {
  it('a half note is one hit, two beats long', () => {
    const s = setLength(placeNote(keys(), cursor(0, 0, 0), A4()), cursor(0, 0, 0), NoteValue.HALF, false);
    const hits = performance(s, 0, 0, 'keys').hits;
    expect(hits.length).toBe(1);
    expect(hits[0].length).toBe(2 * PPQ);
  });
  it('a tie across the bar line extends the note into the next bar', () => {
    let s = addBar(placeNote(keys(), cursor(0, 3, 0), A4()));
    s = toggleTie(s, cursor(1, 0, 0));
    const hits = performance(s, 0, 1, 'keys').hits;
    expect(hits.length).toBe(1);
    expect(hits[0].length).toBe(2 * PPQ);
  });
});

describe('lengths in the file and the editor', () => {
  it('continuations survive a round trip', () => {
    let full = addPart(toFull(newScore({ id: 'k', title: 't' })), 'keys');
    const id = full.parts[1].id;
    let st = reduce(initialState(full), { type: 'setPart', part: id });
    st = reduce(st, { type: 'tap', staffPosition: 5 });
    st = reduce(st, { type: 'selectValue', value: NoteValue.HALF });
    expect(conts(st.score)).toEqual(['n', 'c', '-', '-']);
    const f2 = { ...st.full, updatedAt: 1 };
    expect(decodeFull(encode(f2))).toEqual(f2);
  });
  it('the dot toggle makes the next value dotted', () => {
    let st = initialState(addPart(toFull(newScore({ title: 't' })), 'keys'));
    st = reduce(st, { type: 'setPart', part: st.full.parts[1].id });
    st = reduce(st, { type: 'tap', staffPosition: 5 });
    st = reduce(reduce(st, { type: 'toggleDot' }), { type: 'selectValue', value: NoteValue.HALF });
    expect(conts(st.score)).toEqual(['n', 'c', 'c', '-']);
  });
  it('drums now have lengths too: a half on a beat holds the next beat (Allan, round 5)', () => {
    let st = initialState(newScore({ title: 't' }));
    st = reduce(reduce(st, { type: 'tap', staffPosition: 4 }), { type: 'selectValue', value: NoteValue.HALF });
    expect(st.score.bars[0].beats[1].cells[0].cont).toBe(true);
  });
});
