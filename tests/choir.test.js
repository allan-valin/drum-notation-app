import { describe, it, expect } from 'vitest';
import { newScore, note } from '../src/core/score.js';
import { toFull, addPart, partView } from '../src/core/parts.js';
import { cursor, leafAt } from '../src/core/cursor.js';
import { placeNote, setLyric, setSlur, setDynamic, addBar } from '../src/core/edit.js';
import { layoutBar } from '../src/core/layout.js';
import { Glyphs } from '../src/core/glyphs.js';
import { encode, decodeFull } from '../src/core/json.js';
import { initialState, reduce } from '../src/core/editorState.js';
import { profileById } from '../src/core/profile.js';
import { staffPositionOf } from '../src/core/pitch.js';

const voice = (id = 'soprano') => {
  const full = addPart(toFull(newScore({ id: 'c', title: 't' })), id);
  return partView(full, full.parts[1].id);
};
const n = (slot) => ({ ...note(slot), alter: 0 });
const cfg = (id) => ({ width: 800, staffSpacing: 10, ...(profileById(id).dynamicsAbove ? { dynamicsAbove: true } : {}) });

describe('choir profiles', () => {
  it('SATB: clefs and ranges as choral scores write them', () => {
    expect(profileById('soprano').staves[0].clef).toBe('treble');
    expect(profileById('alto').staves[0].clef).toBe('treble');
    expect(profileById('tenor').staves[0].clef).toBe('treble8vb');
    expect(profileById('bass').staves[0].clef).toBe('bass');
    for (const id of ['soprano', 'alto', 'tenor', 'bass']) {
      const p = profileById(id);
      expect(p.palette, id).toEqual(expect.arrayContaining(['lyrics', 'accidental', 'length', 'dynamics', 'phrasing']));
      expect(p.dynamicsAbove).toBe(true);
      expect(p.voice).toBe('voice');
    }
  });
  it('the rock vocal also gets lyrics, phrasing and dynamics above', () => {
    expect(profileById('vocal').palette).toEqual(expect.arrayContaining(['lyrics', 'phrasing']));
    expect(profileById('vocal').dynamicsAbove).toBe(true);
  });
});

describe('lyrics', () => {
  it('one syllable per cell, kept when the note changes, cleared with empty text', () => {
    let s = setLyric(placeNote(voice(), cursor(0, 0, 0), n('G4')), cursor(0, 0, 0), 'A-');
    s = placeNote(s, cursor(0, 0, 0), n('A4'));
    expect(leafAt(s, cursor(0, 0, 0)).lyric).toBe('A-');
    expect(leafAt(setLyric(s, cursor(0, 0, 0), ''), cursor(0, 0, 0)).lyric).toBeUndefined();
  });
  it('are drawn under the staff, with a hyphen to the next syllable', () => {
    let s = placeNote(placeNote(voice(), cursor(0, 0, 0), n('G4')), cursor(0, 1, 0), n('A4'));
    s = setLyric(setLyric(s, cursor(0, 0, 0), 'A-'), cursor(0, 1, 0), 've');
    const r = layoutBar(s.bars[0], profileById('soprano').staves[0], cfg('soprano'));
    const words = r.texts.filter((x) => x.kind === 'lyric');
    expect(words.map((w) => w.text)).toEqual(['A', 've']);
    expect(r.texts.some((x) => x.kind === 'hyphen')).toBe(true);
    expect(words[0].y).toBeGreaterThan(40);
    expect(r.bottom).toBeGreaterThan(words[0].y); // the drawing's height includes the lyrics
    expect(words[1].y).toBe(words[0].y);           // one line
  });
  it('the reducer writes the lyric and "next" goes to the next note, skipping rests and held cells', () => {
    let st = initialState(addPart(toFull(newScore({ title: 't' })), 'soprano'));
    st = reduce(st, { type: 'setPart', part: st.full.parts[1].id });
    const pos = (x) => staffPositionOf(x, 'treble');
    st = reduce(st, { type: 'tap', staffPosition: pos('G4') });
    st = reduce(st, { type: 'goTo', cursor: cursor(0, 2, 0) });
    st = reduce(st, { type: 'tap', staffPosition: pos('A4') });
    st = reduce(st, { type: 'goTo', cursor: cursor(0, 0, 0) });
    st = reduce(st, { type: 'setLyric', text: 'Glo-', advance: true });
    expect(leafAt(st.score, cursor(0, 0, 0)).lyric).toBe('Glo-');
    expect(st.cursor).toEqual(cursor(0, 2, 0));
  });
});

describe('breath marks and slurs', () => {
  it('a breath mark is drawn after the note, above the staff', () => {
    const s = placeNote(voice(), cursor(0, 0, 0), { ...n('G4'), articulations: ['breath'] });
    const r = layoutBar(s.bars[0], profileById('soprano').staves[0], cfg('soprano'));
    const b = r.glyphs.find((g) => g.glyph === Glyphs.BREATH);
    const head = r.glyphs.find((g) => g.kind === 'note');
    expect(b.x).toBeGreaterThan(head.x);
    expect(b.y).toBeLessThan(0);
  });
  it('a slur joins its start and end notes with an arc', () => {
    let s = placeNote(placeNote(voice(), cursor(0, 0, 0), n('G4')), cursor(0, 2, 0), n('C5'));
    s = setSlur(setSlur(s, cursor(0, 0, 0), 'start'), cursor(0, 2, 0), 'end');
    const r = layoutBar(s.bars[0], profileById('soprano').staves[0], cfg('soprano'));
    expect(r.slurs.length).toBe(1);
    expect(r.slurs[0].x2).toBeGreaterThan(r.slurs[0].x1);
    // G4 stems up (slur below), C5 stems down: the end follows the start's side
    expect(r.slurs[0].below).toBe(true);
    expect(r.slurs[0].y2).toBeGreaterThan(r.glyphs.filter((g) => g.kind === 'note')[1].y);
  });
  it('a slur running into the next bar ends at the bar line, and starts at the next one', () => {
    let s = addBar(placeNote(voice(), cursor(0, 3, 0), n('G4')));
    s = placeNote(s, cursor(1, 0, 0), n('A4'));
    s = setSlur(setSlur(s, cursor(0, 3, 0), 'start'), cursor(1, 0, 0), 'end');
    const st = profileById('soprano').staves[0];
    expect(layoutBar(s.bars[0], st, cfg('soprano')).slurs[0].x2).toBeGreaterThan(780);
    expect(layoutBar(s.bars[1], st, { ...cfg('soprano'), slurIn: true }).slurs[0].x1).toBeLessThan(5);
  });
  it('dynamics go above the staff for voices', () => {
    const s = setDynamic(placeNote(voice(), cursor(0, 0, 0), n('G4')), cursor(0, 0, 0), 'mf');
    const r = layoutBar(s.bars[0], profileById('soprano').staves[0], cfg('soprano'));
    expect(r.glyphs.find((g) => g.kind === 'dynamic').y).toBeLessThan(0);
  });
  it('lyrics, breath and slurs survive a round trip', () => {
    let s = placeNote(placeNote(voice('tenor'), cursor(0, 0, 0), { ...n('C4'), articulations: ['breath'] }), cursor(0, 1, 0), n('D4'));
    s = setLyric(setSlur(setSlur(s, cursor(0, 0, 0), 'start'), cursor(0, 1, 0), 'end'), cursor(0, 0, 0), 'lá');
    const full = { ...toFull(s), updatedAt: 1 };
    expect(decodeFull(encode(full))).toEqual(full);
  });
});
