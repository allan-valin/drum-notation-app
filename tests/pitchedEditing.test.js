import { describe, it, expect } from 'vitest';
import { newScore, barKey } from '../src/core/score.js';
import { setKey, addBar } from '../src/core/edit.js';
import { toFull, addPart, partView, applyAll } from '../src/core/parts.js';
import { encode, decodeFull } from '../src/core/json.js';
import { initialState, reduce } from '../src/core/editorState.js';
import { leafAt } from '../src/core/cursor.js';
import { PROFILES, profileById } from '../src/core/profile.js';
import { staffPositionOf } from '../src/core/pitch.js';
import { performanceAll } from '../src/core/schedule.js';

const pos = (slot, clef = 'treble') => staffPositionOf(slot, clef);

describe('key signature per bar', () => {
  it('is inherited until it changes, and shared by all parts', () => {
    let full = addPart(toFull(addBar(addBar(newScore({ title: 't' })))), 'keys');
    full = applyAll(full, (v) => setKey(v, 1, 2));
    const v = partView(full, full.parts[1].id);
    expect([0, 1, 2].map((i) => barKey(v, i))).toEqual([0, 2, 2]);
    expect(barKey(partView(full, 'p1'), 2)).toBe(2);
  });
  it('survives a round trip', () => {
    let full = addPart(toFull(newScore({ title: 't' })), 'keys');
    full = applyAll(full, (v) => setKey(v, 0, -3));
    full = { ...full, updatedAt: 1 };
    expect(decodeFull(encode(full))).toEqual(full);
  });
});

describe('rock band pitched profiles', () => {
  for (const id of ['electricGuitar', 'bassGuitar', 'keys', 'vocal']) {
    it(`${id} is pitched, has no drum tools, and has accidentals`, () => {
      const p = profileById(id);
      expect(PROFILES[id]).toBe(p);
      expect(p.staves[0].pitched).toBe(true);
      expect(p.hands).toBe(false);
      expect(p.heads).toEqual([]);
      expect(p.techniques).toEqual([]);
      expect(p.palette).toContain('accidental');
      expect(p.palette).not.toContain('hand');
    });
  }
  it('guitar and bass sound an octave below the written note', () => {
    expect(profileById('electricGuitar').staves[0].clef).toBe('treble8vb');
    expect(profileById('bassGuitar').staves[0].clef).toBe('bass8vb');
  });
});

describe('writing pitches', () => {
  const keysScore = () => {
    const full = addPart(toFull(newScore({ title: 't' })), 'keys');
    return reduce(initialState(full), { type: 'setPart', part: full.parts[1].id });
  };
  it('a tap writes the pitch at that height, following the key', () => {
    let st = keysScore();
    st = reduce(st, { type: 'setKey', key: 2 });
    st = reduce(st, { type: 'tap', staffPosition: pos('F4') });
    expect(leafAt(st.score, st.cursor).notes[0]).toMatchObject({ slotId: 'F4', alter: 1 });
  });
  it('the accidental tool overrides the key', () => {
    let st = keysScore();
    st = reduce(st, { type: 'setAccidental', alter: -1 });
    st = reduce(st, { type: 'tap', staffPosition: pos('B4') });
    expect(leafAt(st.score, st.cursor).notes[0]).toMatchObject({ slotId: 'B4', alter: -1 });
    expect(reduce(st, { type: 'setAccidental', alter: -1 }).tool.accidental).toBe(null);
  });
  it('symbol only changes the alteration of the note already in the cell', () => {
    let st = keysScore();
    st = reduce(st, { type: 'tap', staffPosition: pos('C5') });
    st = reduce(reduce(reduce(st, { type: 'setWithNote', on: false }), { type: 'setAccidental', alter: 1 }), { type: 'tap', staffPosition: pos('A5') });
    expect(leafAt(st.score, st.cursor).notes).toEqual([expect.objectContaining({ slotId: 'C5', alter: 1 })]);
  });
  it('staccato rides on pitched notes', () => {
    let st = keysScore();
    st = reduce(reduce(st, { type: 'toggleArt', art: 'staccato' }), { type: 'tap', staffPosition: pos('G4') });
    expect(leafAt(st.score, st.cursor).notes[0].articulations).toEqual(['staccato']);
  });
  it('switching from keys back to drums drops the accidental tool', () => {
    let st = keysScore();
    st = reduce(st, { type: 'setAccidental', alter: 1 });
    st = reduce(st, { type: 'setPart', part: 'p1' });
    expect(st.tool.accidental).toBe(null);
  });
});

describe('playing pitches', () => {
  it('a pitched part sends its frequency and length to its own voice', () => {
    let st = initialState(addPart(toFull(newScore({ title: 't', defaultBpm: 120 })), 'keys'));
    st = reduce(st, { type: 'setPart', part: st.full.parts[1].id });
    st = reduce(st, { type: 'tap', staffPosition: pos('A4') });
    const hit = performanceAll(st.full, 0, 0).hits[0];
    expect(hit.sound).toBe('voice:keys');
    expect(hit.freq).toBeCloseTo(440);
    expect(hit.length).toBe(960);
  });
  it('the guitar sounds an octave lower than written', () => {
    let st = initialState(addPart(toFull(newScore({ title: 't' })), 'electricGuitar'));
    st = reduce(st, { type: 'setPart', part: st.full.parts[1].id });
    st = reduce(st, { type: 'tap', staffPosition: pos('A4', 'treble8vb') });
    expect(performanceAll(st.full, 0, 0).hits[0].freq).toBeCloseTo(220);
  });
});
