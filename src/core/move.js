import { leafTicks, barTicks, beatTicks } from './ticks.js';
import { barTimeSig, emptyBeat } from './score.js';
import { noteValueFor } from './noteValue.js';
import { getAt, samePath } from './tree.js';
import { slotById, slotFor } from './profile.js';

/**
 * Moving written notes and beats in time, as a drag does: everything keeps its distance from
 * everything else moved with it (beats 2 and 4 dragged back a beat land on 1 and 3).
 */

/** Ticks from the start of the score to the start of the leaf at `c`. */
export function absTick(score, c) {
  let t = 0;
  for (let b = 0; b < c.bar; b++) t += barTicks(score, b);
  const [, den] = barTimeSig(score, c.bar);
  const l = leafTicks(score.bars[c.bar].beats[c.beat], den).find((x) => samePath(x.path, c.path));
  return t + c.beat * beatTicks(den) + (l ? l.tick : 0);
}

/** The cell that starts exactly at `tick` (held cells do not count), or a reason there is none. */
export function cellAt(score, tick) {
  if (tick < 0) return { refused: 'outOfScore' };
  let start = 0;
  for (let b = 0; b < score.bars.length; b++) {
    const len = barTicks(score, b);
    if (tick < start + len) {
      if (score.bars[b].simile) return { refused: 'simileBar' };
      const [, den] = barTimeSig(score, b);
      const bt = beatTicks(den);
      const beat = Math.floor((tick - start) / bt);
      const l = leafTicks(score.bars[b].beats[beat], den).find((x) => start + beat * bt + x.tick === tick && !x.leaf.cont);
      return l ? { bar: b, beat, path: l.path } : { refused: 'noCellThere' };
    }
    start += len;
  }
  return { refused: 'outOfScore' };
}

const mapLeaf = (score, c, f) => ({
  ...score,
  bars: score.bars.map((bar, i) => (i !== c.bar ? bar : {
    ...bar,
    beats: bar.beats.map((bt, k) => (k !== c.beat ? bt : replace(bt, c.path, f))),
  })),
});
function replace(g, path, f) {
  if (!path.length) return f(g);
  const [i, ...rest] = path;
  return { ...g, cells: g.cells.map((x, j) => (j === i ? replace(x, rest, f) : x)) };
}

/**
 * Move the notes of each source cell (all of them, or only `slotIds`) by `delta` ticks and
 * `dPos` staff positions (a different height is a different instrument). All are lifted
 * first, then written, so moved notes never collide with each other on the way.
 */
export function moveNotes(score, sources, delta, dPos, staff) {
  const lifted = [];
  for (const c of sources) {
    const leaf = getAt(score.bars[c.bar]?.beats[c.beat], c.path);
    if (!leaf?.notes) continue;
    const notes = leaf.notes.filter((n) => !c.slotIds || c.slotIds.includes(n.slotId));
    if (!notes.length) continue;
    const to = cellAt(score, absTick(score, c) + delta);
    if (to.refused) return to;
    lifted.push({ from: c, to, notes });
  }
  if (!lifted.length) return { refused: 'nothingSelected' };
  let s = score;
  for (const m of lifted) s = mapLeaf(s, m.from, (l) => ({ ...l, notes: l.notes.filter((n) => !m.notes.includes(n)) }));
  for (const m of lifted) {
    const moved = m.notes.map((n) => {
      if (!dPos) return n;
      const was = slotById(staff, n.slotId);
      const slot = slotFor(staff, was.staffPosition + dPos, n.head ?? was.notehead);
      // a pitched note takes the key signature at its new letter
      const { alter, ...rest } = n;
      return { ...(staff.pitched ? rest : n), slotId: slot.id };
    });
    s = mapLeaf(s, m.to, (l) => {
      const { cont, ...keep } = l;
      return { ...keep, notes: [...l.notes.filter((x) => !moved.some((y) => y.slotId === x.slotId)), ...moved] };
    });
  }
  return { ...s, updatedAt: Date.now() };
}

/** Beats as one running count across bars: [bar, beat] ↔ index. */
export function beatList(score) {
  return score.bars.flatMap((b, bar) => b.beats.map((_, beat) => ({ bar, beat, den: barTimeSig(score, bar)[1] })));
}

/**
 * Move whole beats (with their subdivision, notes and marks) by `delta` beats. The places they
 * leave become empty one-cell beats. Refused across different beat units, into a % bar or off
 * the score.
 */
export function moveBeats(score, beats, delta) {
  const list = beatList(score);
  const index = (x) => list.findIndex((y) => y.bar === x.bar && y.beat === x.beat);
  const moves = [];
  for (const b of beats) {
    const i = index(b);
    const j = i + delta;
    if (i < 0) continue;
    if (j < 0 || j >= list.length) return { refused: 'outOfScore' };
    if (list[j].den !== list[i].den) return { refused: 'beatsDiffer' };
    if (score.bars[list[j].bar].simile) return { refused: 'simileBar' };
    moves.push({ from: list[i], to: list[j], group: score.bars[b.bar].beats[b.beat] });
  }
  if (!moves.length) return { refused: 'nothingSelected' };
  const set = (s, at, g) => ({ ...s, bars: s.bars.map((bar, i) => (i !== at.bar ? bar : { ...bar, beats: bar.beats.map((x, k) => (k === at.beat ? g : x)) })) });
  let s = score;
  for (const m of moves) s = set(s, m.from, emptyBeat(noteValueFor(m.from.den), m.from.den));
  for (const m of moves) s = set(s, m.to, m.group);
  return { ...s, updatedAt: Date.now() };
}
