import { describe, it, expect } from 'vitest';
import { newScore, note } from '../src/core/score.js';
import { toFull, addPart, partView } from '../src/core/parts.js';
import { cursor, leafAt } from '../src/core/cursor.js';
import { placeNote, deleteNote, setDynamic, setWedge } from '../src/core/edit.js';
import { layoutBar } from '../src/core/layout.js';
import { Glyphs } from '../src/core/glyphs.js';
import { performance } from '../src/core/schedule.js';
import { encode, decodeFull } from '../src/core/json.js';
import { initialState, reduce } from '../src/core/editorState.js';
import { DRUM_PROFILE, PROFILES } from '../src/core/profile.js';

const snare = () => note('snare');
const bar4 = () => {
  let s = newScore({ id: 'd', title: 't' });
  for (let b = 0; b < 4; b++) s = placeNote(s, cursor(0, b, 0), snare());
  return s;
};

describe('dynamics on cells', () => {
  it('a dynamic sits on the cell and survives editing its notes', () => {
    let s = setDynamic(bar4(), cursor(0, 0, 0), 'p');
    s = placeNote(s, cursor(0, 0, 0), note('kick'));
    s = deleteNote(s, cursor(0, 0, 0), 'snare');
    expect(leafAt(s, cursor(0, 0, 0))).toMatchObject({ dyn: 'p' });
  });
  it('setting the same dynamic again removes it', () => {
    const s = setDynamic(setDynamic(bar4(), cursor(0, 0, 0), 'f'), cursor(0, 0, 0), 'f');
    expect(leafAt(s, cursor(0, 0, 0)).dyn).toBeUndefined();
  });
  it('round-trips with cresc. and dim.', () => {
    let s = setWedge(setDynamic(bar4(), cursor(0, 0, 0), 'mp'), cursor(0, 1, 0), 'cresc');
    let full = { ...toFull(s), updatedAt: 1 };
    expect(decodeFull(encode(full))).toEqual(full);
  });
  it('is drawn below the staff, with the right glyph', () => {
    const s = setDynamic(bar4(), cursor(0, 1, 0), 'mf');
    const r = layoutBar(s.bars[0], DRUM_PROFILE.staves[0], { width: 600, staffSpacing: 10 });
    const g = r.glyphs.find((x) => x.kind === 'dynamic');
    expect(g.glyph).toBe(Glyphs.dynamic('mf'));
    expect(g.y).toBeGreaterThan(40);
  });
  it('cresc. and dim. are written as words', () => {
    const s = setWedge(bar4(), cursor(0, 0, 0), 'dim');
    const r = layoutBar(s.bars[0], DRUM_PROFILE.staves[0], { width: 600, staffSpacing: 10 });
    expect(r.texts.some((t) => t.kind === 'wedge' && t.text === 'dim.')).toBe(true);
  });
});

describe('dynamics in playback', () => {
  it('p is softer than f, and the level holds until the next mark', () => {
    let s = setDynamic(setDynamic(bar4(), cursor(0, 0, 0), 'p'), cursor(0, 2, 0), 'f');
    const v = performance(s, 0, 0).hits.map((h) => h.velocity);
    expect(v[0]).toBe(v[1]);
    expect(v[2]).toBeGreaterThan(v[1]);
    expect(v[2]).toBe(v[3]);
  });
  it('an accent is louder than the level around it', () => {
    let s = setDynamic(bar4(), cursor(0, 0, 0), 'mp');
    s = placeNote(s, cursor(0, 1, 0), note('snare', { articulations: ['accent'] }));
    const v = performance(s, 0, 0).hits.map((h) => h.velocity);
    expect(v[1]).toBeGreaterThan(v[0]);
  });
  it('cresc. rises from one mark to the next', () => {
    let s = setDynamic(bar4(), cursor(0, 0, 0), 'p');
    s = setWedge(s, cursor(0, 0, 0), 'cresc');
    s = setDynamic(s, cursor(0, 3, 0), 'f');
    const v = performance(s, 0, 0).hits.map((h) => h.velocity);
    expect(v[1]).toBeGreaterThan(v[0]);
    expect(v[2]).toBeGreaterThan(v[1]);
  });
  it('sfz is one loud hit, then back to the level', () => {
    let s = setDynamic(bar4(), cursor(0, 0, 0), 'p');
    s = setDynamic(s, cursor(0, 1, 0), 'sfz');
    const v = performance(s, 0, 0).hits.map((h) => h.velocity);
    expect(v[1]).toBeGreaterThan(v[0]);
    expect(v[2]).toBe(v[0]);
  });
});

describe('dynamics in the editor', () => {
  it('every instrument has the dynamics group', () => {
    for (const p of Object.values(PROFILES)) expect(p.palette, p.id).toContain('dynamics');
  });
  it('with Note + symbol, the chosen dynamic goes on the note written', () => {
    let st = initialState(newScore({ title: 't' }));
    st = reduce(reduce(st, { type: 'setDyn', dyn: 'pp' }), { type: 'tap', staffPosition: 4 });
    expect(leafAt(st.score, st.cursor).dyn).toBe('pp');
  });
  it('one undo takes back the note and its dynamic together; a dynamic alone is one undo step too', () => {
    let st = initialState(newScore({ title: 't' }));
    st = reduce(reduce(st, { type: 'setDyn', dyn: 'f' }), { type: 'tap', staffPosition: 4 });
    expect(st.history.length).toBe(1);
    st = reduce(st, { type: 'undo' });
    expect(leafAt(st.score, st.cursor)).toEqual({ notes: [] });
    st = reduce(reduce(st, { type: 'setWithNote', on: false }), { type: 'tap', staffPosition: 4 });
    expect(st.history.length).toBe(1);
    expect(leafAt(st.score, st.cursor).dyn).toBe('f');
  });
  it('with Symbol only, a dynamic goes on the selected cell even if it is empty', () => {
    let st = initialState(newScore({ title: 't' }));
    st = reduce(reduce(reduce(st, { type: 'setWithNote', on: false }), { type: 'setWedge', wedge: 'cresc' }), { type: 'tap', staffPosition: 4 });
    expect(leafAt(st.score, st.cursor)).toMatchObject({ wedge: 'cresc', notes: [] });
  });
});
