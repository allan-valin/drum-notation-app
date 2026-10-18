import { describe, it, expect } from 'vitest';
import { newScore, note } from '../src/core/score.js';
import { toFull, addPart, partView } from '../src/core/parts.js';
import { cursor, leafAt } from '../src/core/cursor.js';
import { placeNote, setChord, setKey } from '../src/core/edit.js';
import { layoutBar } from '../src/core/layout.js';
import { Glyphs } from '../src/core/glyphs.js';
import { performance, performanceAll } from '../src/core/schedule.js';
import { encode, decodeFull } from '../src/core/json.js';
import { initialState, reduce } from '../src/core/editorState.js';
import { profileById } from '../src/core/profile.js';
import { partKey, midiOf } from '../src/core/pitch.js';
import { parseChord, prettyChord } from '../src/core/chords.js';
import { PPQ } from '../src/core/ticks.js';

const part = (id) => {
  const full = addPart(toFull(newScore({ id: 'j', title: 't', defaultBpm: 120 })), id);
  return { full, id: full.parts[1].id, view: partView(full, full.parts[1].id) };
};
const n = (slot, alter = 0, extra = {}) => ({ ...note(slot, extra), alter });

describe('jazz instruments', () => {
  it('transposing horns: written above concert pitch, key signature shifted', () => {
    expect(profileById('trumpet')).toMatchObject({ transpose: -2, keyShift: 2 });
    expect(profileById('altoSax')).toMatchObject({ transpose: -9, keyShift: 3 });
    expect(profileById('tenorSax')).toMatchObject({ transpose: -14, keyShift: 2 });
    expect(profileById('trombone').staves[0].clef).toBe('bass');
    expect(profileById('doubleBass').staves[0].clef).toBe('bass8vb');
    expect(profileById('vibraphone').voice).toBe('vibes');
  });
  it('written D5 on trumpet sounds concert C5', () => {
    const p = profileById('trumpet');
    expect(midiOf({ slotId: 'D5', alter: 0 }, { clef: p.staves[0].clef, transpose: p.transpose })).toBe(72);
  });
  it('concert keys become written keys, wrapping past seven sharps', () => {
    expect(partKey(0, profileById('trumpet'))).toBe(2);
    expect(partKey(0, profileById('altoSax'))).toBe(3);
    expect(partKey(5, profileById('altoSax'))).toBe(-4);
    expect(partKey(-3, profileById('keys'))).toBe(-3);
  });
  it('a tap on a transposing horn follows its written key', () => {
    let st = initialState(addPart(toFull(newScore({ title: 't' })), 'trumpet'));
    st = reduce(st, { type: 'setPart', part: st.full.parts[1].id });
    st = reduce(st, { type: 'tap', staffPosition: 1 }); // F4 written; concert C major → trumpet D major: F#
    expect(leafAt(st.score, st.cursor).notes[0]).toMatchObject({ slotId: 'F4', alter: 1 });
  });
});

describe('chord symbols', () => {
  it('parse into a root and intervals', () => {
    expect(parseChord('C7')).toEqual({ root: 0, intervals: [0, 4, 7, 10], bass: null });
    expect(parseChord('Bbmaj7')).toEqual({ root: 10, intervals: [0, 4, 7, 11], bass: null });
    expect(parseChord('F#m7b5').intervals).toEqual([0, 3, 6, 10]);
    expect(parseChord('Am').intervals).toEqual([0, 3, 7]);
    expect(parseChord('Gsus4').intervals).toEqual([0, 5, 7]);
    expect(parseChord('Ddim7').intervals).toEqual([0, 3, 6, 9]);
    expect(parseChord('C/E').bass).toBe(4);
    expect(parseChord('H7')).toBe(null);
  });
  it('print with real accidentals', () => {
    expect(prettyChord('Bbmaj7')).toBe('B♭maj7');
    expect(prettyChord('F#m7b5')).toBe('F♯m7♭5');
  });
  it('sit on the cell, above the staff, and survive a round trip', () => {
    const { full, id, view } = part('keys');
    const s = setChord(view, cursor(0, 0, 0), 'Dm7');
    const r = layoutBar(s.bars[0], profileById('keys').staves[0], { width: 800, staffSpacing: 10 });
    const t = r.texts.find((x) => x.kind === 'chord');
    expect(t.text).toBe('Dm7');
    expect(t.y).toBeLessThan(0);
    const f = { ...partView({ ...full }, id), updatedAt: 1 };
    expect(decodeFull(encode(toFull(s))).bars[0].parts.p1.beats[0].cells[0].chord).toBe('Dm7');
  });
  it('read along one line in a bar', () => {
    const { view } = part('doubleBass');
    let s = placeNote(placeNote(view, cursor(0, 0, 0), n('D3')), cursor(0, 2, 0), n('G3'));
    s = setChord(setChord(s, cursor(0, 0, 0), 'Dm7'), cursor(0, 2, 0), 'G7');
    const r = layoutBar(s.bars[0], profileById('doubleBass').staves[0], { width: 800, staffSpacing: 10 });
    const ys = r.texts.filter((x) => x.kind === 'chord').map((x) => x.y);
    expect(ys[0]).toBe(ys[1]);
  });
  it('refuse what they cannot read', () => {
    const { view } = part('keys');
    expect(setChord(view, cursor(0, 0, 0), 'Xyz')).toEqual({ refused: 'badChord' });
  });
});

describe('slash rhythm', () => {
  it('a slash head on a rhythm instrument goes on the middle line whatever the tap', () => {
    let st = initialState(addPart(toFull(newScore({ title: 't' })), 'keys'));
    st = reduce(st, { type: 'setPart', part: st.full.parts[1].id });
    st = reduce(reduce(st, { type: 'setHead', head: 'slash' }), { type: 'tap', staffPosition: 9 });
    expect(leafAt(st.score, st.cursor).notes[0]).toMatchObject({ slotId: 'B4', head: 'slash' });
  });
  it('draws the slash glyph', () => {
    const { view } = part('keys');
    const s = placeNote(view, cursor(0, 0, 0), n('B4', 0, { head: 'slash' }));
    const r = layoutBar(s.bars[0], profileById('keys').staves[0], { width: 800, staffSpacing: 10 });
    expect(r.glyphs.find((g) => g.kind === 'note').glyph).toBe(Glyphs.notehead('slash', s.bars[0].beats[0].division));
  });
  it('slashes play the chord symbol in force, on the instrument', () => {
    const { view } = part('keys');
    let s = setChord(view, cursor(0, 0, 0), 'C');
    s = placeNote(s, cursor(0, 0, 0), n('B4', 0, { head: 'slash' }));
    s = placeNote(s, cursor(0, 1, 0), n('B4', 0, { head: 'slash' }));
    const hits = performance(s, 0, 0, 'keys').hits;
    const first = hits.filter((h) => h.tick === 0).map((h) => Math.round(12 * Math.log2(h.freq / 440) + 69) % 12).sort((a, b) => a - b);
    expect(first).toEqual([0, 4, 7]);
    expect(hits.filter((h) => h.tick === PPQ).length).toBe(3);
  });
  it('slashes with no chord yet stay silent', () => {
    const { view } = part('keys');
    const s = placeNote(view, cursor(0, 0, 0), n('B4', 0, { head: 'slash' }));
    expect(performance(s, 0, 0, 'keys').hits).toEqual([]);
  });
});

describe('swing and horn effects', () => {
  it('swing pushes off-beat eighths to the last third of the beat', () => {
    let s = newScore({ title: 't' });
    s = { ...s, swing: true };
    const eighths = { division: 'eighth', cells: [['hihat'], ['hihat']] };
    const full = decodeFull({ schema_version: 2, swing: true, bars: [{ beats: [eighths, eighths, eighths, eighths] }] });
    const hits = performanceAll(full, 0, 0).hits;
    expect(hits.map((h) => h.tick).slice(0, 2)).toEqual([0, (2 * PPQ) / 3]);
  });
  it('fall, doit, scoop and plop are drawn and passed to the sound', () => {
    const { view } = part('trumpet');
    const s = placeNote(view, cursor(0, 0, 0), n('C5', 0, { marks: ['fall'] }));
    const r = layoutBar(s.bars[0], profileById('trumpet').staves[0], { width: 800, staffSpacing: 10 });
    expect(r.glyphs.some((g) => g.glyph === Glyphs.FALL)).toBe(true);
    expect(performance(s, 0, 0, 'trumpet').hits[0].bend).toBe('fall');
  });
});
