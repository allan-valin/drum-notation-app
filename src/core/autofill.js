import { leafPaths } from './tree.js';
import { placeNote } from './edit.js';
import { note, barTimeSig } from './score.js';
import { withStem } from './voices.js';

/** Every way of cutting `n` beats into groups of 2 and 3, in order (7 → 2+2+3, 2+3+2, 3+2+2). */
export function groupings(n) {
  if (n === 0) return [[]];
  const out = [];
  for (const k of [2, 3]) if (k <= n) for (const rest of groupings(n - k)) out.push([k, ...rest]);
  return out;
}

/**
 * The patterns offered for a time signature: every cell, every beat, every other beat (from 1
 * or from 2) and, for odd and compound meters, each grouping of the beats into 2s and 3s
 * (a note on the first beat of each group). The all-2s grouping is "every other beat from 1".
 */
export function patternsFor(num) {
  const out = ['cells', 'beats'];
  if (num >= 2) out.push('alt1', 'alt2');
  if (num >= 5 || (num > 3 && num % 3 === 0)) {
    // 12 beats already give 28 groupings: past 9, only the even ones (3+3+3+3, 2+2…)
    const all = groupings(num).filter((g) => g.some((x) => x === 3));
    const keep = num > 9 ? all.filter((g) => g.every((x) => x === g[0])) : all;
    out.push(...keep.map((g) => `g:${g.join('+')}`));
  }
  return out;
}

/** The cells a pattern writes to in bar `index`, as cursors. */
export function patternCells(score, index, pattern) {
  const beats = score.bars[index].beats;
  const first = (b) => ({ bar: index, beat: b, path: leafPaths(beats[b])[0] });
  if (pattern === 'cells') return beats.flatMap((bt, b) => leafPaths(bt).map((path) => ({ bar: index, beat: b, path })));
  if (pattern === 'beats') return beats.map((_, b) => first(b));
  if (pattern === 'alt1' || pattern === 'alt2') return beats.map((_, b) => b).filter((b) => b % 2 === (pattern === 'alt1' ? 0 : 1)).map(first);
  if (pattern.startsWith('g:')) {
    const starts = [];
    let at = 0;
    for (const k of pattern.slice(2).split('+').map(Number)) { starts.push(at); at += k; }
    return starts.filter((b) => b < beats.length).map(first);
  }
  return [];
}

/**
 * Write `slotId` on every cell of the pattern in bar `index` (a note already there on that
 * instrument is replaced). `stem` forces a direction; otherwise the instrument's own.
 */
export function autofill(score, index, slotId, pattern, staff, stem = null) {
  if (score.bars[index].simile) return { refused: 'simileBar' };
  const [num] = barTimeSig(score, index);
  if (!patternsFor(num).includes(pattern)) return { refused: 'unknownPattern' };
  const n = stem ? withStem(note(slotId), stem, staff) : note(slotId);
  return patternCells(score, index, pattern).reduce((s, c) => placeNote(s, c, n), score);
}
