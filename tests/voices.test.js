import { describe, it, expect } from 'vitest';
import { note, leaf, group, bar, newScore, emptyBar } from '../src/core/score.js';
import { NoteValue } from '../src/core/noteValue.js';
import { stemOf, withStem, voiceBeats, voiceView, zipVoice, normVoices, layoutVoices } from '../src/core/voices.js';
import { DRUM_PROFILE } from '../src/core/profile.js';

const staff = DRUM_PROFILE.staves[0];
const E = NoteValue.EIGHTH;
const Q = NoteValue.QUARTER;
const eighths = (...cells) => group(E, null, cells.map((c) => leaf(c)));
const quarter = (notes) => group(Q, null, [leaf(notes)]);
const ids = (beats) => beats.map((b) => b.cells.map((c) => (c.cells ? c.cells.map((x) => x.notes.map((n) => n.slotId)) : c.notes.map((n) => n.slotId))));
const rock = () => bar([
  eighths([note('kick'), note('hihat')], [note('hihat')]),
  eighths([note('snare'), note('hihat')], [note('hihat')]),
  eighths([note('kick'), note('hihat')], [note('hihat')]),
  eighths([note('snare'), note('hihat')], [note('hihat')]),
]);

describe('stem direction', () => {
  it('snare and both bass drums point down by default, every other piece up', () => {
    for (const id of ['snare', 'kick', 'kickLeft']) expect(stemOf(note(id), staff), id).toBe('down');
    for (const id of ['hihat', 'ride', 'crash', 'highTom', 'floorTom', 'hihatPedal', 'cowbell']) expect(stemOf(note(id), staff), id).toBe('up');
  });
  it('a note can be flipped; flipping back to the default drops the field', () => {
    const up = withStem(note('snare'), 'up', staff);
    expect(stemOf(up, staff)).toBe('up');
    expect(withStem(up, 'down', staff).stem).toBeUndefined();
  });
});

describe('voices on one tree (same rhythm)', () => {
  it('the upper voice holds the up-stem notes, the lower the down-stem ones, same cells', () => {
    const b = rock();
    expect(ids(voiceBeats(b, 0, staff))[0]).toEqual([['hihat'], ['hihat']]);
    expect(ids(voiceBeats(b, 1, staff))[0]).toEqual([['kick'], []]);
  });
  it('writing into one voice keeps the other and stays one tree when the rhythms match', () => {
    const s = newScore({ bars: [rock()] });
    const lower = voiceView(s, 1, staff);
    lower.bars[0].beats[1] = eighths([note('snare')], [note('snare')]);
    const back = zipVoice(s, 1, lower, staff);
    expect(back.bars[0].lower).toBeUndefined();
    expect(ids(back.bars[0].beats)[1]).toEqual([['hihat', 'snare'], ['hihat', 'snare']]);
  });
});

describe('split voices (each its own rhythm)', () => {
  it('a lower voice in quarters under eighths on the hi-hat is kept as its own tree', () => {
    const s = newScore({ bars: [rock()] });
    const lower = voiceView(s, 1, staff);
    lower.bars[0].beats = [quarter([note('kick')]), quarter([note('snare')]), quarter([note('kick')]), quarter([note('snare')])];
    const back = zipVoice(s, 1, lower, staff);
    expect(ids(back.bars[0].beats)[0]).toEqual([['hihat'], ['hihat']]);
    expect(ids(back.bars[0].lower)).toEqual([[['kick']], [['snare']], [['kick']], [['snare']]]);
    // and each voice reads back its own tree
    expect(ids(voiceBeats(back.bars[0], 1, staff))[1]).toEqual([['snare']]);
  });
  it('in a split bar a note goes to the voice its stem names, when that voice has a cell starting there', () => {
    const b = { ...emptyBar(4, 4), beats: [eighths([note('hihat'), note('snare')], []), quarter([]), quarter([]), quarter([])], lower: [quarter([note('kick')]), quarter([]), quarter([]), quarter([])] };
    const n = normVoices(b, staff);
    expect(ids(n.beats)[0]).toEqual([['hihat'], []]);
    expect(ids(n.lower)[0]).toEqual([['kick', 'snare']]);
  });
  it('a split bar whose voices end up in the same rhythm goes back to one tree; an empty lower voice disappears', () => {
    const same = normVoices({ ...rock(), beats: rock().beats.map((bt) => ({ ...bt, cells: bt.cells.map((c) => leaf(c.notes.filter((n) => n.slotId === 'hihat'))) })), lower: rock().beats.map((bt) => ({ ...bt, cells: bt.cells.map((c) => leaf(c.notes.filter((n) => n.slotId !== 'hihat'))) })) }, staff);
    expect(same.lower).toBeUndefined();
    expect(ids(same.beats)[0]).toEqual([['hihat', 'kick'], ['hihat']]);
    const hats = bar([eighths([note('hihat')], [note('hihat')]), quarter([]), quarter([]), quarter([])]);
    const empty = normVoices({ ...hats, lower: [quarter([]), quarter([]), quarter([]), quarter([])] }, staff);
    expect(empty.lower).toBeUndefined();
    expect(ids(empty.beats)[0]).toEqual([['hihat'], ['hihat']]);
  });
});

describe('what the layout draws', () => {
  it('one voice when every note points the same way; two when both directions are written', () => {
    expect(layoutVoices(bar([eighths([note('hihat')], [note('hihat')])]), staff).map((v) => v.dir)).toEqual(['up']);
    expect(layoutVoices(bar([eighths([note('kick')], [])]), staff).map((v) => v.dir)).toEqual(['down']);
    expect(layoutVoices(rock(), staff).map((v) => v.dir)).toEqual(['up', 'down']);
  });
  it('in two voices an empty cell after a note in the same beat lengthens it: kick and snare read as quarters', () => {
    const [, lower] = layoutVoices(rock(), staff);
    expect(lower.beats[0].cells[1]).toMatchObject({ cont: true });
  });
});

import { layoutBar } from '../src/core/layout.js';

describe('two voices on the page', () => {
  const cfg = { width: 400, staffSpacing: 10, focusedBeat: null, den: 4 };
  it('hi-hat stems go up, kick and snare stems go down, each voice with its own beams', () => {
    const r = layoutBar(rock(), staff, cfg);
    const stemAt = (slotId) => {
      const head = r.glyphs.find((g) => g.kind === 'note' && g.slotId === slotId);
      return r.stems.find((s) => s.beat === head.beat && Math.abs(s.x - head.x) < 20 && s.dir === (slotId === 'hihat' ? 'up' : 'down'));
    };
    expect(stemAt('hihat').y2).toBeLessThan(stemAt('hihat').y1);
    expect(stemAt('kick').y2).toBeGreaterThan(stemAt('kick').y1);
    // the kick and snare, lengthened to quarters, carry no beam; the hi-hat eighths do
    expect(r.beams.every((b) => b.voice !== 1)).toBe(true);
    expect(r.beams.filter((b) => b.voice !== 1).length).toBe(4);
  });
  it('a split bar draws both trees and reports where the lower voice cells are', () => {
    const b = { ...rock(), beats: rock().beats.map((bt) => ({ ...bt, cells: bt.cells.map((c) => leaf(c.notes.filter((n) => n.slotId === 'hihat'))) })), lower: [quarter([note('kick')]), quarter([note('snare')]), quarter([]), quarter([note('snare')])] };
    const r = layoutBar(b, staff, cfg);
    expect(r.leaves.length).toBe(8);
    expect(r.lowerLeaves.length).toBe(4);
    // the empty lower beat shows a rest below the middle of the staff
    const rest = r.glyphs.find((g) => g.kind === 'rest' && g.voice === 1);
    expect(rest.y).toBeGreaterThan(2 * 10);
  });
  it('one voice keeps its direction: a bar of kicks only stems down', () => {
    const r = layoutBar(bar([eighths([note('kick')], [note('kick')])]), staff, cfg);
    expect(r.stems.every((s) => s.dir === 'down')).toBe(true);
  });
});
