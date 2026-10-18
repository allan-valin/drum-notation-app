import { describe, it, expect } from 'vitest';
import { newScore, note } from '../src/core/score.js';
import { cursor, leafAt } from '../src/core/cursor.js';
import { placeNote, addBar, setTimeSig, moveBars, toggleRepeatEnd } from '../src/core/edit.js';
import { toFull, partView, zipPart, applyAll, addPart, removePart, setInstrument, toggleMute, isEmptyPart, partLabelIndex } from '../src/core/parts.js';
import { encode, decode, decodeFull, SCHEMA_VERSION } from '../src/core/json.js';
import { performanceAll } from '../src/core/schedule.js';
import { initialState, reduce } from '../src/core/editorState.js';
import { barTimeSig } from '../src/core/score.js';

const single = () => newScore({ id: 's', title: 'T', createdAt: 1, updatedAt: 1 });

describe('parts', () => {
  it('an old one-part score becomes a full score with one drum part, and its view is the same score', () => {
    const s = single();
    const full = toFull(s);
    expect(full.parts).toEqual([{ id: 'p1', instrument: 'drums', muted: false }]);
    expect(partView(full, 'p1')).toEqual(s);
  });
  it('editing a view and zipping it back changes only that part', () => {
    let full = addPart(toFull(single()), 'congas');
    const [a, b] = full.parts.map((p) => p.id);
    const edited = placeNote(partView(full, a), cursor(0, 0, 0), note('snare'));
    full = zipPart(full, a, edited);
    expect(leafAt(partView(full, a), cursor(0, 0, 0)).notes[0].slotId).toBe('snare');
    expect(leafAt(partView(full, b), cursor(0, 0, 0)).notes).toEqual([]);
  });
  it('a new part has the same bars and signatures as the score, empty', () => {
    let s = setTimeSig(addBar(single()), 1, [3, 4]);
    const full = addPart(toFull(s), 'congas');
    const v = partView(full, full.parts[1].id);
    expect(v.profileId).toBe('congas');
    expect(v.bars.map((b) => b.beats.length)).toEqual([4, 3]);
    expect(v.bars.every((b) => b.beats.every((bt) => bt.cells.every((c) => c.notes.length === 0)))).toBe(true);
  });
  it('bar operations run on every part, so parts stay aligned', () => {
    let full = addPart(toFull(single()), 'congas');
    full = applyAll(full, (v) => addBar(v));
    full = applyAll(full, (v) => setTimeSig(v, 1, [3, 4]));
    for (const p of full.parts) expect(partView(full, p.id).bars.map((b) => b.beats.length)).toEqual([4, 3]);
    full = applyAll(full, (v) => moveBars(v, 1, 1, 0).score);
    for (const p of full.parts) expect(barTimeSig(partView(full, p.id), 0)).toEqual([3, 4]);
  });
  it('repeat marks are shared by all parts', () => {
    let full = addPart(toFull(single()), 'congas');
    full = zipPart(full, 'p1', toggleRepeatEnd(partView(full, 'p1'), 0));
    expect(partView(full, full.parts[1].id).bars[0].repeatEnd).toBe(true);
  });
  it('a score keeps at least one part', () => {
    const full = toFull(single());
    expect(removePart(full, 'p1')).toBe(full);
    const two = addPart(full, 'congas');
    expect(removePart(two, 'p1').parts.map((p) => p.instrument)).toEqual(['congas']);
  });
  it('changing the instrument of an empty part is free; of a written part it clears the notes', () => {
    let full = toFull(single());
    expect(isEmptyPart(full, 'p1')).toBe(true);
    full = zipPart(full, 'p1', placeNote(partView(full, 'p1'), cursor(0, 0, 0), note('kick')));
    expect(isEmptyPart(full, 'p1')).toBe(false);
    const changed = setInstrument(full, 'p1', 'congas');
    expect(changed.parts[0].instrument).toBe('congas');
    expect(isEmptyPart(changed, 'p1')).toBe(true);
  });
  it('mute toggles', () => {
    const full = toggleMute(toFull(single()), 'p1');
    expect(full.parts[0].muted).toBe(true);
  });
  it('labels number repeated instruments', () => {
    const full = addPart(addPart(toFull(single()), 'congas'), 'drums');
    expect(full.parts.map((p) => partLabelIndex(full, p.id))).toEqual([1, null, 2]);
  });
});

describe('schema v3', () => {
  it('is version 3', () => expect(SCHEMA_VERSION).toBe(3));
  it('round-trips a full score with two parts', () => {
    let full = addPart(toFull(single()), 'congas');
    full = zipPart(full, 'p1', placeNote(partView(full, 'p1'), cursor(0, 0, 0), note('kick')));
    full = zipPart(full, full.parts[1].id, placeNote(partView(full, full.parts[1].id), cursor(0, 1, 0), note('conga')));
    full = { ...full, updatedAt: 1 };
    expect(decodeFull(encode(full))).toEqual(full);
  });
  it('reads v2 files as one drum part', () => {
    const v2 = { schema_version: 2, title: 'old', bars: [{ beats: [{ division: 'quarter', cells: [['kick']] }, { division: 'quarter', cells: [[]] }, { division: 'quarter', cells: [[]] }, { division: 'quarter', cells: [[]] }] }] };
    const full = decodeFull(JSON.stringify(v2));
    expect(full.parts.length).toBe(1);
    expect(full.parts[0].instrument).toBe('drums');
    expect(decode(JSON.stringify(v2)).bars[0].beats[0].cells[0].notes[0].slotId).toBe('kick');
  });
  it('checks each part against its own instrument', () => {
    const full = addPart(toFull(single()), 'congas');
    const j = JSON.parse(encode(full));
    j.bars[0].parts[full.parts[1].id].beats[0].cells[0] = ['kick'];
    expect(() => decodeFull(JSON.stringify(j))).toThrow(/kick/);
  });
});

describe('playing several parts', () => {
  it('mixes the unmuted parts and says which part each hit belongs to', () => {
    let full = addPart(toFull(single()), 'congas');
    const c = full.parts[1].id;
    full = zipPart(full, 'p1', placeNote(partView(full, 'p1'), cursor(0, 0, 0), note('kick')));
    full = zipPart(full, c, placeNote(partView(full, c), cursor(0, 0, 0), note('conga')));
    const p = performanceAll(full, 0, 0);
    expect(p.hits.map((h) => [h.part, h.slotId]).sort()).toEqual([['p1', 'kick'], [c, 'conga']].sort());
    const muted = performanceAll(toggleMute(full, c), 0, 0);
    expect(muted.hits.map((h) => h.slotId)).toEqual(['kick']);
    expect(p.clicks.length).toBe(4);
  });
});

describe('editor with parts', () => {
  it('edits the chosen part, and bar actions reach every part', () => {
    let st = initialState(addPart(toFull(single()), 'congas'));
    const congas = st.full.parts[1].id;
    st = reduce(st, { type: 'setPart', part: congas });
    expect(st.score.profileId).toBe('congas');
    st = reduce(st, { type: 'tap', staffPosition: 4 });
    expect(partView(st.full, 'p1').bars[0].beats[0].cells[0].notes).toEqual([]);
    expect(partView(st.full, congas).bars[0].beats[0].cells[0].notes.length).toBe(1);
    st = reduce(st, { type: 'addBar' });
    expect(partView(st.full, 'p1').bars.length).toBe(2);
    st = reduce(st, { type: 'undo' });
    expect(partView(st.full, 'p1').bars.length).toBe(1);
    expect(st.score.bars.length).toBe(1);
  });
  it('switching part drops tools the new instrument does not have', () => {
    let st = initialState(addPart(toFull(single()), 'congas'));
    st = reduce(st, { type: 'setHead', head: 'diamond' });
    st = reduce(st, { type: 'setSticking', sticking: 'R' });
    st = reduce(st, { type: 'setPart', part: st.full.parts[1].id });
    expect(st.tool.head).toBe(null);
    expect(st.tool.sticking).toBe('R'); // congas are played with hands too
  });
});
