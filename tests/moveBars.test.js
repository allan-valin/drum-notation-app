import { describe, it, expect } from 'vitest';
import { decode } from '../src/core/json.js';
import { moveBars } from '../src/core/edit.js';
import { barTimeSig } from '../src/core/score.js';
import { initialState, reduce } from '../src/core/editorState.js';
import { cursor } from '../src/core/cursor.js';

const q = (s) => ({ division: 'quarter', cells: [s ? [s] : []] });
const bar4 = (s, more = {}) => ({ beats: [q(s), q(), q(), q()], ...more });
const bar3 = (s, more = {}) => ({ beats: [q(s), q(), q()], ...more });
const score = (bars) => decode({ schema_version: 2, title: 't', bars });
const firsts = (s) => s.bars.map((b) => b.beats[0].cells[0].notes[0]?.slotId ?? '-');

describe('moveBars', () => {
  const s = () => score([bar4('kick'), bar4('snare'), bar4('hihat'), bar4('ride')]);
  it('moves one bar left', () => {
    const r = moveBars(s(), 2, 2, 1);
    expect(firsts(r.score)).toEqual(['kick', 'hihat', 'snare', 'ride']);
    expect(r.range).toEqual([1, 1]);
  });
  it('moves a block right, the gap counted in the old order', () => {
    const r = moveBars(s(), 0, 1, 4);
    expect(firsts(r.score)).toEqual(['hihat', 'ride', 'kick', 'snare']);
    expect(r.range).toEqual([2, 3]);
  });
  it('a gap inside or touching the block changes nothing', () => {
    const x = s();
    expect(moveBars(x, 1, 2, 1).score).toBe(x);
    expect(moveBars(x, 1, 2, 3).score).toBe(x);
    expect(moveBars(x, 1, 2, 2).score).toBe(x);
  });
  it('every bar keeps its time signature wherever it lands', () => {
    const x = score([bar4('kick'), bar3('snare', { timeSig: [3, 4] }), bar3('hihat'), bar4('ride', { timeSig: [4, 4] })]);
    const before = x.bars.map((b, i) => [firsts(x)[i], barTimeSig(x, i).join('/')]);
    const r = moveBars(x, 2, 2, 0).score;
    const after = r.bars.map((b, i) => [firsts(r)[i], barTimeSig(r, i).join('/')]);
    expect(after.sort()).toEqual(before.sort());
    r.bars.forEach((b, i) => expect(b.beats.length).toBe(barTimeSig(r, i)[0]));
  });
  it('a % bar moved to the front loses the %', () => {
    const x = score([bar4('kick'), bar4('', { simile: true })]);
    expect(moveBars(x, 1, 1, 0).score.bars[0].simile).toBe(false);
  });
  it('the reducer moves the block, keeps the cursor on the same bar, and undo restores', () => {
    let st = initialState(s());
    st = reduce(st, { type: 'goTo', cursor: cursor(2, 0, 0) });
    st = reduce(st, { type: 'moveBars', from: 2, to: 2, gap: 0 });
    expect(firsts(st.score)[0]).toBe('hihat');
    expect(st.cursor.bar).toBe(0);
    expect(st.range).toEqual([0, 0]);
    st = reduce(st, { type: 'undo' });
    expect(firsts(st.score)).toEqual(['kick', 'snare', 'hihat', 'ride']);
  });
});
