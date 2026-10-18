import { describe, it, expect } from 'vitest';
import { newScore, note } from '../src/core/score.js';
import { toFull, addPart, partView } from '../src/core/parts.js';
import { cursor } from '../src/core/cursor.js';
import { placeNote, setLength } from '../src/core/edit.js';
import { layoutBar } from '../src/core/layout.js';
import { Glyphs } from '../src/core/glyphs.js';
import { performance } from '../src/core/schedule.js';
import { profileById, PROFILES } from '../src/core/profile.js';
import { midiOf } from '../src/core/pitch.js';
import { NoteValue } from '../src/core/noteValue.js';
import { PPQ } from '../src/core/ticks.js';

const view = (id) => { const f = addPart(toFull(newScore({ id: 'o', title: 't' })), id); return partView(f, f.parts[1].id); };
const n = (slot, extra = {}) => ({ ...note(slot, extra), alter: 0 });
const sounding = (id, slot) => { const p = profileById(id); return midiOf({ slotId: slot, alter: 0 }, { clef: p.staves[0].clef, transpose: p.transpose }); };

describe('orchestral instruments', () => {
  it('clefs as orchestral parts are written', () => {
    expect(profileById('violin').staves[0].clef).toBe('treble');
    expect(profileById('viola').staves[0].clef).toBe('alto');
    expect(profileById('cello').staves[0].clef).toBe('bass');
    expect(profileById('contrabass').staves[0].clef).toBe('bass8vb');
    expect(profileById('bassoon').staves[0].clef).toBe('bass');
    expect(profileById('timpani').staves[0].clef).toBe('bass');
  });
  it('transposing instruments sound where they should', () => {
    expect(sounding('clarinet', 'D4')).toBe(60);     // B♭ clarinet: written D sounds C
    expect(sounding('horn', 'G4')).toBe(60);         // horn in F: written G sounds C
    expect(sounding('glockenspiel', 'C4')).toBe(84); // glockenspiel: two octaves up
    expect(sounding('xylophone', 'C4')).toBe(72);    // xylophone: one octave up
    expect(profileById('clarinet').keyShift).toBe(2);
    expect(profileById('horn').keyShift).toBe(1);
  });
  it('strings have bowings, pizz./arco, harmonics, tremolo and trills; winds have trills, not bowings', () => {
    expect(profileById('violin').techniques).toEqual(expect.arrayContaining(['pizz', 'arco', 'downBow', 'upBow', 'harmonic', 'tremolo', 'trill']));
    expect(profileById('flute').techniques).toContain('trill');
    expect(profileById('flute').techniques).not.toContain('downBow');
  });
});

describe('string and ornament marks', () => {
  const staff = profileById('violin').staves[0];
  const cfg = { width: 800, staffSpacing: 10 };
  it('bowings, harmonic and trill are drawn above; pizz. and arco as words', () => {
    let s = view('violin');
    s = placeNote(s, cursor(0, 0, 0), n('G4', { marks: ['downBow'] }));
    s = placeNote(s, cursor(0, 1, 0), n('A4', { marks: ['upBow'] }));
    s = placeNote(s, cursor(0, 2, 0), n('B4', { marks: ['trill'] }));
    s = placeNote(s, cursor(0, 3, 0), n('C5', { marks: ['pizz'] }));
    const r = layoutBar(s.bars[0], staff, cfg);
    for (const g of [Glyphs.DOWN_BOW, Glyphs.UP_BOW, Glyphs.TRILL]) expect(r.glyphs.some((x) => x.glyph === g)).toBe(true);
    expect(r.texts.some((t) => t.text === 'pizz.')).toBe(true);
  });
});

describe('orchestral playback', () => {
  it('pizz. plucks, arco bows', () => {
    let s = placeNote(view('violin'), cursor(0, 0, 0), n('G4', { marks: ['pizz'] }));
    s = placeNote(s, cursor(0, 1, 0), n('G4'));
    expect(performance(s, 0, 0, 'violin').hits.map((h) => h.sound)).toEqual(['voice:pizz', 'voice:strings']);
  });
  it('a trill alternates with the note above for the whole length', () => {
    let s = placeNote(view('flute'), cursor(0, 0, 0), n('A4', { marks: ['trill'] }));
    s = setLength(s, cursor(0, 0, 0), NoteValue.HALF, false);
    const hits = performance(s, 0, 0, 'flute').hits;
    expect(hits.length).toBe(16);
    expect(new Set(hits.map((h) => Math.round(h.freq))).size).toBe(2);
    expect(hits[hits.length - 1].tick).toBeLessThan(2 * PPQ);
  });
  it('a tremolo repeats the note', () => {
    const s = placeNote(view('violin'), cursor(0, 0, 0), n('D5', { roll: 'tremolo' }));
    expect(performance(s, 0, 0, 'violin').hits.length).toBe(8);
  });
  it('every pitched instrument names a voice', () => {
    for (const p of Object.values(PROFILES).filter((x) => x.staves[0].pitched)) expect(typeof p.voice, p.id).toBe('string');
  });
});
