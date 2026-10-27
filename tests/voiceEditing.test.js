import { describe, it, expect } from 'vitest';
import { initialState, reduce } from '../src/core/editorState.js';
import { newScore } from '../src/core/score.js';
import { NoteValue } from '../src/core/noteValue.js';
import { partView } from '../src/core/parts.js';
import { leafAt } from '../src/core/cursor.js';
import { encode, decode, decodeFull } from '../src/core/json.js';
import { performanceAll } from '../src/core/schedule.js';

const run = (st, ...actions) => actions.reduce(reduce, st);
const start = () => initialState(newScore());
const real = (st) => partView(st.full, st.part).bars[0];
const names = (cell) => cell.notes.map((n) => n.slotId).sort();

describe('stem toggle', () => {
  it('new notes take the chosen direction; Auto goes back to the instrument default', () => {
    let st = run(start(), { type: 'setStem', stem: 'up' }, { type: 'tap', staffPosition: 5 });
    expect(leafAt(st.score, st.cursor).notes[0].stem).toBe('up');
    st = run(st, { type: 'setStem', stem: 'up' }, { type: 'next' }, { type: 'tap', staffPosition: 5 });
    expect(st.tool.stem).toBe(null);
    expect(leafAt(st.score, st.cursor).notes[0].stem).toBeUndefined();
  });
  it('in symbol-only mode the toggle flips the note already there', () => {
    const st = run(start(), { type: 'tap', staffPosition: 8 }, { type: 'setWithNote', on: false }, { type: 'setStem', stem: 'down' }, { type: 'tap', staffPosition: 8 });
    expect(leafAt(st.score, st.cursor).notes[0].stem).toBe('down');
  });
});

describe('split voices', () => {
  const groove = () => {
    // 4/4, every beat in eighths: hi-hat on every cell, kick on 1 and 3, snare on 2 and 4
    let st = run(start(), { type: 'setSplitMode', mode: 'bar' }, { type: 'selectValue', value: NoteValue.EIGHTH });
    st = run(st, { type: 'autofill', slotId: 'hihat', pattern: 'cells' }, { type: 'autofill', slotId: 'snare', pattern: 'alt2' }, { type: 'autofill', slotId: 'kick', pattern: 'alt1' });
    return run(st, { type: 'setSplitMode', mode: 'beat' });
  };
  it('the basic rock groove takes three autofills: 8 hi-hats, snare on 2 and 4, kick on 1 and 3', () => {
    const b = real(groove());
    const all = b.beats.flatMap((bt) => bt.cells.map(names));
    expect(all.filter((c) => c.includes('hihat')).length).toBe(8);
    expect(b.beats.map((bt) => names(bt.cells[0]))).toEqual([['hihat', 'kick'], ['hihat', 'snare'], ['hihat', 'kick'], ['hihat', 'snare']]);
  });
  it('with voices split, the lower voice gets its own subdivision', () => {
    let st = run(groove(), { type: 'setSplit', on: true }, { type: 'setVoice', voice: 1 });
    expect(leafAt(st.score, st.cursor).notes.map((n) => n.slotId)).toEqual(['kick']);
    st = run(st, { type: 'setSplitMode', mode: 'bar' }, { type: 'selectValue', value: NoteValue.QUARTER });
    const b = real(st);
    expect(b.lower.map((bt) => bt.cells.length)).toEqual([1, 1, 1, 1]);
    expect(b.lower.map((bt) => names(bt.cells[0]))).toEqual([['kick'], ['snare'], ['kick'], ['snare']]);
    expect(b.beats.every((bt) => bt.cells.length === 2)).toBe(true);
    // the upper voice still has its eighths: 2 + 1 cells to pick from in the first beat
    st = run(st, { type: 'setVoice', voice: 0 });
    expect(st.score.bars[0].beats[0].cells.length).toBe(2);
  });
  it('writing in the lower voice puts the note there whatever its instrument', () => {
    const st = run(start(), { type: 'setSplit', on: true }, { type: 'setVoice', voice: 1 }, { type: 'tap', staffPosition: 8 });
    expect(real(st).beats[0].cells[0].notes[0]).toMatchObject({ slotId: 'hihat', stem: 'down' });
  });
  it('undo restores both voices; split off goes back to one tree for editing', () => {
    let st = run(groove(), { type: 'setSplit', on: true }, { type: 'setVoice', voice: 1 }, { type: 'setSplitMode', mode: 'bar' }, { type: 'selectValue', value: NoteValue.QUARTER });
    expect(real(st).lower).toBeTruthy();
    st = run(st, { type: 'undo' });
    expect(real(st).lower).toBeUndefined();
    st = run(st, { type: 'setSplit', on: false });
    expect(st.score.bars[0].beats[0].cells[0].notes.length).toBe(2);
  });
  it('picking a cell of the other voice from its strip switches voice and changes nothing written', () => {
    const st = run(groove(), { type: 'setSplit', on: true });
    const after = run(st, { type: 'selectCell', voice: 1, beat: 2, path: [1] });
    expect(after.voice).toBe(1);
    expect(after.cursor).toMatchObject({ beat: 2, path: [1] });
    expect(after.full).toBe(st.full);
    // a tap then writes into the lower voice at that cell
    const w = run(after, { type: 'tap', staffPosition: 1 });
    expect(real(w).beats[2].cells[1].notes.map((n) => n.slotId)).toEqual(['hihat', 'kick']);
  });
  it('JSON keeps the lower voice and the stems; playback plays both voices', () => {
    const st = run(groove(), { type: 'setSplit', on: true }, { type: 'setVoice', voice: 1 }, { type: 'setSplitMode', mode: 'bar' }, { type: 'selectValue', value: NoteValue.QUARTER });
    const back = decodeFull(encode(st.full));
    expect(back.bars[0].parts.p1.lower.length).toBe(4);
    expect(decode(encode(st.full)).bars[0].lower[1].cells[0].notes[0].slotId).toBe('snare');
    const hits = performanceAll(st.full, 0, 0).hits.map((h) => h.slotId);
    expect(hits.filter((x) => x === 'hihat').length).toBe(8);
    expect(hits.filter((x) => x === 'kick').length).toBe(2);
    expect(hits.filter((x) => x === 'snare').length).toBe(2);
  });
});
