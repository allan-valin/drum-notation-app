import { describe, it, expect } from 'vitest';
import { newScore, note } from '../src/core/score.js';
import { toFull, addPart, partView } from '../src/core/parts.js';
import { cursor, leafAt } from '../src/core/cursor.js';
import { placeNote, setPedal } from '../src/core/edit.js';
import { layoutBar } from '../src/core/layout.js';
import { Glyphs } from '../src/core/glyphs.js';
import { performance } from '../src/core/schedule.js';
import { encode, decodeFull } from '../src/core/json.js';
import { initialState, reduce } from '../src/core/editorState.js';
import { NoteValue } from '../src/core/noteValue.js';
import { profileById, DRUM_PROFILE } from '../src/core/profile.js';
import { PPQ } from '../src/core/ticks.js';

const piano = () => { const f = addPart(toFull(newScore({ id: 'h', title: 't', defaultBpm: 120 })), 'piano'); return partView(f, f.parts[1].id); };
const n = (s, extra = {}) => ({ ...note(s, extra), alter: 0 });
const kinds = (s) => s.bars[0].beats.map((b) => b.cells.map((c) => (c.cont ? 'c' : c.notes.length ? 'n' : '-')).join(''));

describe('dots and ties on drums', () => {
  it('the dot (and tie) is general notation: every instrument has it', async () => {
    const { PROFILES } = await import('../src/core/profile.js');
    for (const p of Object.values(PROFILES)) expect(p.palette, p.id).toContain('length');
  });
  it('drums and hand percussion have the length tools', () => {
    for (const id of ['drums', 'congas', 'darbuka', 'taiko']) expect(profileById(id).palette, id).toContain('length');
  });
  it('a dotted quarter on the snare holds into the next beat and is drawn with a dot', () => {
    let st = initialState(newScore({ title: 't' }));
    st = reduce(st, { type: 'tap', staffPosition: 4 });
    st = reduce(reduce(st, { type: 'toggleDot' }), { type: 'selectValue', value: NoteValue.QUARTER });
    expect(kinds(st.score)).toEqual(['n', 'c-', '-', '-']);
    const r = layoutBar(st.score.bars[0], DRUM_PROFILE.staves[0], { width: 800, staffSpacing: 10 });
    expect(r.glyphs.filter((g) => g.kind === 'dot').length).toBe(1);
  });
  it('a held drum note is struck once', () => {
    let st = initialState(newScore({ title: 't' }));
    st = reduce(reduce(st, { type: 'tap', staffPosition: 4 }), { type: 'selectValue', value: NoteValue.HALF });
    expect(performance(st.score, 0, 0).hits.length).toBe(1);
  });
});

describe('sustain pedal', () => {
  it('Ped. and * sit on cells, are drawn below, and survive a round trip', () => {
    let s = placeNote(piano(), cursor(0, 0, 0), n('C4'));
    s = setPedal(setPedal(s, cursor(0, 0, 0), 'down'), cursor(0, 3, 0), 'up');
    expect(leafAt(s, cursor(0, 0, 0)).ped).toBe('down');
    const r = layoutBar(s.bars[0], profileById('pianoRH').staves[0], { width: 800, staffSpacing: 10 });
    const ped = r.glyphs.find((g) => g.glyph === Glyphs.PED);
    expect(ped.y).toBeGreaterThan(40);
    expect(r.glyphs.some((g) => g.glyph === Glyphs.PED_UP)).toBe(true);
    const full = { ...toFull(s), updatedAt: 1 };
    expect(decodeFull(encode(full))).toEqual(full);
  });
  it('notes played with the pedal down ring until it comes up', () => {
    let s = placeNote(placeNote(piano(), cursor(0, 0, 0), n('C4')), cursor(0, 1, 0), n('E4'));
    s = setPedal(setPedal(s, cursor(0, 0, 0), 'down'), cursor(0, 3, 0), 'up');
    const [c, e] = performance(s, 0, 0, 'pianoRH').hits;
    expect(c.length).toBe(3 * PPQ);
    expect(e.length).toBe(2 * PPQ);
  });
  it('a pedal never released holds to the end of what is played', () => {
    let s = setPedal(placeNote(piano(), cursor(0, 0, 0), n('C4')), cursor(0, 0, 0), 'down');
    expect(performance(s, 0, 0, 'pianoRH').hits[0].length).toBe(4 * PPQ);
  });
  it('piano, harp, keyboard and vibraphone have the pedal; violin does not', () => {
    for (const id of ['pianoRH', 'pianoLH', 'harpRH', 'keys', 'vibraphone']) expect(profileById(id).palette, id).toContain('pedal');
    expect(profileById('violin').palette).not.toContain('pedal');
  });
});

describe('let ring (l.v.)', () => {
  it('draws a short open tie and makes a pitched note ring longer', () => {
    const s = placeNote(piano(), cursor(0, 0, 0), n('C4', { marks: ['lv'] }));
    const r = layoutBar(s.bars[0], profileById('pianoRH').staves[0], { width: 800, staffSpacing: 10 });
    expect(r.ties.length).toBe(1);
    expect(r.ties[0].open).toBe(true);
    expect(performance(s, 0, 0, 'pianoRH').hits[0].length).toBeGreaterThan(PPQ);
  });
  it('drums can let a cymbal ring', () => {
    expect(DRUM_PROFILE.techniques).toContain('lv');
  });
});
