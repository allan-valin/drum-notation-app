import { describe, it, expect } from 'vitest';
import { newScore, note } from '../src/core/score.js';
import { toFull, addPart, partView, zipPart, movePartBars } from '../src/core/parts.js';
import { cursor } from '../src/core/cursor.js';
import { placeNote, addBar, setTimeSig } from '../src/core/edit.js';
import { initialState, reduce } from '../src/core/editorState.js';

const firsts = (full, id) => partView(full, id).bars.map((b) => b.beats[0].cells[0].notes[0]?.slotId ?? '-');
function score() {
  let s = newScore({ id: 'm', title: 't' });
  s = addBar(addBar(s));
  ['kick', 'snare', 'hihat'].forEach((x, i) => { s = placeNote(s, cursor(i, 0, 0), note(x)); });
  let full = addPart(toFull(s), 'congas');
  const c = full.parts[1].id;
  ['tumba', 'conga', 'quinto'].forEach((x, i) => { full = zipPart(full, c, placeNote(partView(full, c), cursor(i, 0, 0), note(x))); });
  return { full, c };
}

describe('moving one instrument\'s bars', () => {
  it('moves only that part; the others stay where they were', () => {
    const { full, c } = score();
    const r = movePartBars(full, 'p1', 0, 0, 3);
    expect(firsts(r.full, 'p1')).toEqual(['snare', 'hihat', 'kick']);
    expect(firsts(r.full, c)).toEqual(['tumba', 'conga', 'quinto']);
    expect(r.range).toEqual([2, 2]);
  });
  it('refuses when the bars involved have different time signatures', () => {
    let { full } = score();
    const v = setTimeSig(partView(full, 'p1'), 2, [3, 4]);
    // apply the signature to every part, as the editor does
    full = { ...full, bars: full.bars.map((b, i) => (i === 2 ? { ...b, timeSig: [3, 4] } : b)) };
    full = zipPart(full, 'p1', v);
    expect(movePartBars(full, 'p1', 0, 0, 3)).toEqual({ refused: 'signaturesDiffer' });
  });
  it('the editor moves only the part being edited when asked to', () => {
    const { full, c } = score();
    let st = reduce(initialState(full), { type: 'setPart', part: c });
    st = reduce(st, { type: 'moveBars', from: 2, to: 2, gap: 0, onlyPart: true });
    expect(firsts(st.full, c)).toEqual(['quinto', 'tumba', 'conga']);
    expect(firsts(st.full, 'p1')).toEqual(['kick', 'snare', 'hihat']);
    st = reduce(st, { type: 'undo' });
    expect(firsts(st.full, c)).toEqual(['tumba', 'conga', 'quinto']);
  });
});
