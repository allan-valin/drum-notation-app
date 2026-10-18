import { describe, it, expect } from 'vitest';
import { newScore, note, barKey } from '../src/core/score.js';
import { toFull, addPart, partView, applyAll } from '../src/core/parts.js';
import { cursor, leafAt } from '../src/core/cursor.js';
import { placeNote, setKey } from '../src/core/edit.js';
import { layoutBar } from '../src/core/layout.js';
import { Glyphs } from '../src/core/glyphs.js';
import { performance } from '../src/core/schedule.js';
import { encode, decodeFull } from '../src/core/json.js';
import { initialState, reduce } from '../src/core/editorState.js';
import { profileById } from '../src/core/profile.js';
import { keyAlter, keyAccidentals, MAQAMAT, parseSlot, staffPositionOf } from '../src/core/pitch.js';
import { soundFor } from '../src/core/schedule.js';

const view = (id) => { const f = addPart(toFull(newScore({ id: 'a', title: 't', defaultBpm: 120 })), id); return partView(f, f.parts[1].id); };

describe('maqam key signatures', () => {
  it('Rast on C lowers E and B by a quarter tone; Bayati on D adds B flat', () => {
    expect(keyAlter('rast', parseSlot('E4').step)).toBe(-0.5);
    expect(keyAlter('rast', parseSlot('B4').step)).toBe(-0.5);
    expect(keyAlter('rast', parseSlot('F4').step)).toBe(0);
    expect(keyAlter('bayati', parseSlot('B4').step)).toBe(-1);
    expect(keyAlter('hijaz', parseSlot('F4').step)).toBe(1);
  });
  it('draws the half-flat signs in the key signature', () => {
    expect(keyAccidentals('rast', 'treble').map((k) => k.alter)).toEqual([-0.5, -0.5]);
    expect(Object.keys(MAQAMAT)).toEqual(expect.arrayContaining(['rast', 'bayati', 'saba', 'hijaz', 'nahawand', 'kurd', 'sikah']));
  });
  it('a key can be a maqam, shared by every part, and saved', () => {
    let full = addPart(toFull(newScore({ id: 'a', title: 't' })), 'oud');
    full = applyAll(full, (v) => setKey(v, 0, 'rast'));
    expect(barKey(partView(full, full.parts[1].id), 0)).toBe('rast');
    full = { ...full, updatedAt: 1 };
    expect(decodeFull(encode(full))).toEqual(full);
  });
  it('a tap in Rast writes E half-flat, and it plays a quarter tone low', () => {
    let st = initialState(addPart(toFull(newScore({ title: 't' })), 'ney'));
    st = reduce(st, { type: 'setPart', part: st.full.parts[1].id });
    st = reduce(st, { type: 'setKey', key: 'rast' });
    st = reduce(st, { type: 'tap', staffPosition: staffPositionOf('E4', 'treble') });
    expect(leafAt(st.score, st.cursor).notes[0]).toMatchObject({ slotId: 'E4', alter: -0.5 });
    const f = performance(st.score, 0, 0, 'ney').hits[0].freq;
    expect(12 * Math.log2(f / 440) + 69).toBeCloseTo(63.5);
  });
  it('in Rast a plain E needs a natural sign, an E half-flat none', () => {
    let s = placeNote(view('oud'), cursor(0, 0, 0), { ...note('E4'), alter: -0.5 });
    s = placeNote(s, cursor(0, 1, 0), { ...note('E4'), alter: 0 });
    const r = layoutBar(s.bars[0], profileById('oud').staves[0], { width: 800, staffSpacing: 10, key: 'rast' });
    expect(r.glyphs.filter((g) => g.kind === 'accidental').map((g) => g.glyph)).toEqual([Glyphs.NATURAL]);
  });
});

describe('Arabic instruments', () => {
  it('oud, qanun and ney have quarter tones in the palette', () => {
    for (const id of ['oud', 'qanun', 'ney']) expect(profileById(id).quarterTones, id).toBe(true);
    expect(profileById('oud').staves[0].clef).toBe('treble8vb');
  });
  it('darbuka, riq and daf: dum below, tak above, own sounds', () => {
    for (const id of ['darbuka', 'riq', 'daf']) {
      const staff = profileById(id).staves[0];
      const pos = (s) => staff.slots.find((x) => x.id === s).staffPosition;
      expect(pos('dum')).toBeLessThan(pos('tak'));
      expect(soundFor(note('dum'), id)).toBe(`${id}Dum`);
      expect(soundFor(note('tak'), id)).toBe(`${id}Tak`);
    }
  });
});
