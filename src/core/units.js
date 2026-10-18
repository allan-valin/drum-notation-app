import { leafSpans } from './tree.js';

import { NOTE_VALUES } from './noteValue.js';
import { PPQ, beatTicks } from './ticks.js';

const ticksOf = (v) => (PPQ * 4) / v.divisionsPerWhole;

/** The written value (and dot) of a length in ticks, if one exists. */
function valueFor(total) {
  for (const v of NOTE_VALUES) {
    if (ticksOf(v) === total) return { value: v, dotted: false };
    if (ticksOf(v) * 1.5 === total) return { value: v, dotted: true };
  }
  return null;
}

/**
 * What gets drawn: notes, rests and held notes, from the cells. A note followed by
 * continuation cells is one unit when their lengths add up to a written value (a half, a
 * dotted quarter…); otherwise it is split into the longest written values, joined by ties.
 * Cells without continuations (all drum cells) are each their own unit, so drums draw as before.
 * `carry`: the notes a tie brings in from the previous bar.
 */
export function drawUnits(bar, den, carry = []) {
  const bt = beatTicks(den);
  const cells = bar.beats.flatMap((b, beat) => leafSpans(b).map((l, idx) => ({
    beat, idx, leaf: l.leaf, value: l.parent.division,
    start: beat * bt + l.start * bt, length: l.size * bt,
  })));
  const units = [];
  let i = 0;
  let lastNotes = carry;
  while (i < cells.length) {
    const head = cells[i];
    const chain = [head];
    let j = i + 1;
    while (j < cells.length && cells[j].leaf.cont) { chain.push(cells[j]); j += 1; }
    if (!head.leaf.cont && head.leaf.notes.length === 0) {
      units.push({ beat: head.beat, idx: head.idx, notes: [], value: head.value, dotted: false, rest: true, tiedIn: false, members: [head] });
      lastNotes = [];
      // continuations after a rest have nothing to hold: draw them as rests too
      for (const c of chain.slice(1)) units.push({ beat: c.beat, idx: c.idx, notes: [], value: c.value, dotted: false, rest: true, tiedIn: false, members: [c] });
      i = j;
      continue;
    }
    const notes = head.leaf.cont ? lastNotes : head.leaf.notes;
    let k = 0;
    let tiedIn = !!head.leaf.cont;
    while (k < chain.length) {
      // the longest prefix of what is left that is one written value
      let take = 1;
      let shape = { value: chain[k].value, dotted: false };
      for (let n = chain.length - k; n >= 2; n--) {
        const total = chain.slice(k, k + n).reduce((m, c) => m + c.length, 0);
        const f = valueFor(total);
        if (f) { take = n; shape = f; break; }
      }
      const members = chain.slice(k, k + take);
      if (take === 1) shape = valueFor(members[0].length) ?? { value: members[0].value, dotted: false };
      units.push({ beat: members[0].beat, idx: members[0].idx, notes: notes.length ? notes : [], value: shape.value, dotted: shape.dotted, rest: notes.length === 0, tiedIn, members });
      tiedIn = true;
      k += take;
    }
    lastNotes = notes;
    i = j;
  }
  return units;
}
