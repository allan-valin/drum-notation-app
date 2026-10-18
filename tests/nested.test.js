import { describe, it, expect } from 'vitest';
import { NoteValue } from '../src/core/noteValue.js';
import { note, newScore, emptyBar, leaf, group } from '../src/core/score.js';
import { isGroup, leafPaths, leafSpans, getAt, parentOf } from '../src/core/tree.js';
import { cursor, next, prev, leafAt, leafValue } from '../src/core/cursor.js';
import { splitBeat, splitCell, placeNote, setTimeSig, toggleSimile, toggleRepeatStart, toggleRepeatEnd, addBar } from '../src/core/edit.js';
import { leafTicks, barTicks, PPQ } from '../src/core/ticks.js';
import { barTimeSig } from '../src/core/score.js';

const s0 = () => newScore({ title: 't' });

describe('tree helpers', () => {
  const g = group(NoteValue.EIGHTH, null, [leaf(), group(NoteValue.SIXTEENTH, null, [leaf(), leaf()])]);
  it('tells groups from leaves', () => {
    expect(isGroup(g)).toBe(true);
    expect(isGroup(g.cells[0])).toBe(false);
  });
  it('lists leaf paths depth first', () => {
    expect(leafPaths(g)).toEqual([[0], [1, 0], [1, 1]]);
  });
  it('gives each leaf its share of the group', () => {
    expect(leafSpans(g).map((l) => [l.start, l.size])).toEqual([[0, 0.5], [0.5, 0.25], [0.75, 0.25]]);
  });
  it('finds a node and its parent', () => {
    expect(getAt(g, [1, 1])).toBe(g.cells[1].cells[1]);
    expect(parentOf(g, [1, 1])).toBe(g.cells[1]);
    expect(parentOf(g, [0])).toBe(g);
  });
});

describe('splitting one cell (Célula mode)', () => {
  it('eighth beat, second cell split into sixteenths: eighth rest + two sixteenths', () => {
    let s = splitBeat(s0(), cursor(0, 0, 0), NoteValue.EIGHTH, null);
    s = splitCell(s, cursor(0, 0, 1), NoteValue.SIXTEENTH, null);
    const beat = s.bars[0].beats[0];
    expect(beat.cells.length).toBe(2);
    expect(isGroup(beat.cells[0])).toBe(false);
    expect(beat.cells[1].division).toBe(NoteValue.SIXTEENTH);
    expect(beat.cells[1].cells.length).toBe(2);
  });
  it('a sixteenth inside it split into 32nds gives two 32nds', () => {
    let s = splitBeat(s0(), cursor(0, 0, 0), NoteValue.EIGHTH, null);
    s = splitCell(s, cursor(0, 0, 1), NoteValue.SIXTEENTH, null);
    s = splitCell(s, cursor(0, 0, 1, 1), NoteValue.THIRTY_SECOND, null);
    expect(leafPaths(s.bars[0].beats[0])).toEqual([[0], [1, 0], [1, 1, 0], [1, 1, 1]]);
    expect(leafValue(s, cursor(0, 0, 1, 1, 0))).toBe(NoteValue.THIRTY_SECOND);
  });
  it('the notes of the split cell move to its first part', () => {
    let s = splitBeat(s0(), cursor(0, 0, 0), NoteValue.EIGHTH, null);
    s = placeNote(s, cursor(0, 0, 1), note('snare'));
    s = splitCell(s, cursor(0, 0, 1), NoteValue.SIXTEENTH, null);
    expect(leafAt(s, cursor(0, 0, 1, 0)).notes.map((n) => n.slotId)).toEqual(['snare']);
    expect(leafAt(s, cursor(0, 0, 1, 1)).notes).toEqual([]);
  });
  it('refuses a value that is not shorter than the cell', () => {
    const s = splitBeat(s0(), cursor(0, 0, 0), NoteValue.EIGHTH, null);
    expect(splitCell(s, cursor(0, 0, 1), NoteValue.EIGHTH, null)).toBe(s);
    expect(splitCell(s, cursor(0, 0, 1), NoteValue.QUARTER, null)).toBe(s);
  });
  it('a tuplet splits the cell into that many parts', () => {
    let s = splitBeat(s0(), cursor(0, 0, 0), NoteValue.EIGHTH, null);
    s = splitCell(s, cursor(0, 0, 0), NoteValue.SIXTEENTH, 3);
    expect(s.bars[0].beats[0].cells[0].cells.length).toBe(3);
    expect(s.bars[0].beats[0].cells[0].tuplet).toBe(3);
  });
  it('on a beat that is a single cell it splits the beat itself, without nesting', () => {
    const s = splitCell(s0(), cursor(0, 0, 0), NoteValue.SIXTEENTH, null);
    expect(s.bars[0].beats[0].division).toBe(NoteValue.SIXTEENTH);
    expect(s.bars[0].beats[0].cells.every((c) => !isGroup(c))).toBe(true);
  });
  it('splitting the whole beat flattens any nesting', () => {
    let s = splitBeat(s0(), cursor(0, 0, 0), NoteValue.EIGHTH, null);
    s = splitCell(s, cursor(0, 0, 1), NoteValue.SIXTEENTH, null);
    s = splitBeat(s, cursor(0, 0, 0), NoteValue.SIXTEENTH, null);
    expect(leafPaths(s.bars[0].beats[0])).toEqual([[0], [1], [2], [3]]);
  });
});

describe('cursor over nested cells', () => {
  it('walks every leaf in order and back', () => {
    let s = splitBeat(s0(), cursor(0, 0, 0), NoteValue.EIGHTH, null);
    s = splitCell(s, cursor(0, 0, 1), NoteValue.SIXTEENTH, null);
    let c = cursor(0, 0, 0);
    const seen = [];
    for (let i = 0; i < 4; i++) { seen.push([c.beat, ...c.path]); c = next(s, c); }
    expect(seen).toEqual([[0, 0], [0, 1, 0], [0, 1, 1], [1, 0]]);
    expect(prev(s, cursor(0, 1, 0))).toEqual(cursor(0, 0, 1, 1));
  });
});

describe('ticks over nested cells', () => {
  it('an eighth then two sixteenths start at 0, 480, 720', () => {
    let s = splitBeat(s0(), cursor(0, 0, 0), NoteValue.EIGHTH, null);
    s = splitCell(s, cursor(0, 0, 1), NoteValue.SIXTEENTH, null);
    expect(leafTicks(s.bars[0].beats[0], 4).map((l) => l.tick)).toEqual([0, PPQ / 2, (PPQ * 3) / 4]);
  });
});

describe('time signature per bar', () => {
  it('a new bar inherits the previous signature', () => {
    let s = setTimeSig(s0(), 0, [3, 4]);
    s = addBar(s);
    expect(barTimeSig(s, 1)).toEqual([3, 4]);
    expect(s.bars[1].timeSig).toBe(null);
    expect(s.bars[1].beats.length).toBe(3);
  });
  it('setting 3/4 on bar 2 changes it and the bars that inherit, not the ones before', () => {
    let s = addBar(addBar(s0()));
    s = setTimeSig(s, 1, [3, 4]);
    expect(s.bars.map((b) => b.beats.length)).toEqual([4, 3, 3]);
    expect(barTimeSig(s, 0)).toEqual([4, 4]);
  });
  it('a later explicit signature stops the inheritance', () => {
    let s = addBar(addBar(s0()));
    s = setTimeSig(s, 2, [5, 4]);
    s = setTimeSig(s, 1, [3, 4]);
    expect(s.bars.map((b) => b.beats.length)).toEqual([4, 3, 5]);
  });
  it('growing a bar appends empty beats and keeps the notes', () => {
    let s = placeNote(s0(), cursor(0, 0, 0), note('kick'));
    s = setTimeSig(s, 0, [6, 4]);
    expect(s.bars[0].beats.length).toBe(6);
    expect(leafAt(s, cursor(0, 0, 0)).notes[0].slotId).toBe('kick');
  });
  it('changing the beat unit rebuilds the beats at the new unit', () => {
    const s = setTimeSig(s0(), 0, [6, 8]);
    expect(s.bars[0].beats.length).toBe(6);
    expect(s.bars[0].beats[0].division).toBe(NoteValue.EIGHTH);
    expect(barTicks(s, 0)).toBe(6 * (PPQ / 2));
  });
  it('null on the first bar falls back to the score signature', () => {
    let s = setTimeSig(s0(), 0, [3, 4]);
    s = setTimeSig(s, 0, null);
    expect(barTimeSig(s, 0)).toEqual([4, 4]);
    expect(s.bars[0].beats.length).toBe(4);
  });
});

describe('simile and repeat marks', () => {
  it('toggle like switches', () => {
    let s = addBar(s0());
    s = toggleSimile(s, 1);
    expect(s.bars[1].simile).toBe(true);
    expect(toggleSimile(s, 1).bars[1].simile).toBe(false);
    s = toggleRepeatStart(toggleRepeatEnd(s, 1), 0);
    expect(s.bars[0].repeatStart).toBe(true);
    expect(s.bars[1].repeatEnd).toBe(true);
  });
  it('the first bar cannot be a simile: there is nothing before it', () => {
    const s = s0();
    expect(toggleSimile(s, 0)).toBe(s);
  });
  it('a fresh bar has no marks', () => {
    expect(emptyBar(4, 4)).toMatchObject({ timeSig: null, simile: false, repeatStart: false, repeatEnd: false });
  });
});
