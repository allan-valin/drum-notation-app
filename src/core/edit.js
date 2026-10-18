import { cellsPerBeat, noteValueFor, NOTE_VALUES } from './noteValue.js';
import { PPQ, beatTicks, leafTicks } from './ticks.js';
import { leaf, group, emptyBar, emptyBeat, barTimeSig } from './score.js';
import { isGroup, getAt, parentOf, replaceAt, firstNotes, samePath } from './tree.js';

/**
 * Write `note` at `c`. A note already on the same slot is replaced; a note on a different
 * slot joins it, because notes in one cell sound together. The cursor does not move: that is
 * what makes entering a kick and a hi-hat together two taps in the same place.
 */
export function placeNote(score, c, note) {
  return mapLeaf(score, c, (l) => withNotes(l, [...l.notes.filter((n) => n.slotId !== note.slotId), note]));
}

/** A cell with new notes, keeping its dynamic and cresc./dim. (and no longer a continuation). */
function withNotes(l, notes) {
  return { notes: [...notes], ...(l.dyn ? { dyn: l.dyn } : {}), ...(l.wedge ? { wedge: l.wedge } : {}) };
}

export const DYNAMICS = ['pp', 'p', 'mp', 'mf', 'f', 'ff', 'fp', 'sfz'];

/** A dynamic on the cell at `c` (choosing the one it has removes it). */
export function setDynamic(score, c, dyn) {
  return mapLeaf(score, c, (l) => {
    const { dyn: had, ...rest } = l;
    return had === dyn ? rest : { ...rest, dyn };
  });
}

/** cresc. or dim. from the cell at `c` to the next dynamic (choosing the one it has removes it). */
export function setWedge(score, c, wedge) {
  return mapLeaf(score, c, (l) => {
    const { wedge: had, ...rest } = l;
    return had === wedge ? rest : { ...rest, wedge };
  });
}

/** Remove whatever is on `slotId` at `c`, if anything. */
export function deleteNote(score, c, slotId) {
  const l = getAt(score.bars[c.bar].beats[c.beat], c.path);
  if (!l.notes.some((n) => n.slotId === slotId)) return score;
  return mapLeaf(score, c, (x) => withNotes(x, x.notes.filter((n) => n.slotId !== slotId)));
}

/** Empty the leaf at `c` (a rest); a continuation stops continuing. */
export function clearLeaf(score, c) {
  const l = getAt(score.bars[c.bar].beats[c.beat], c.path);
  if (l.notes.length === 0 && !l.cont) return score;
  return mapLeaf(score, c, (x) => withNotes(x, []));
}

/**
 * Re-split the whole beat under `c` into equal cells ("Tempo" mode). Any nesting is
 * flattened: each surviving top-level cell keeps the notes of its first leaf; cells beyond
 * the new count are dropped, the only place editing loses notes.
 */
export function splitBeat(score, c, division, tuplet) {
  const [, den] = barTimeSig(score, c.bar);
  return mapBeat(score, c, (b) => {
    const count = cellsPerBeat(division, den, tuplet);
    return group(division, tuplet, Array.from({ length: count }, (_, i) => leaf(b.cells[i] ? firstNotes(b.cells[i]) : [])));
  });
}

/**
 * Split only the leaf under `c` ("Célula" mode). Its notes move to the first part. Returns the
 * score unchanged when `division` is not shorter than the leaf (nothing to split into).
 * On a beat that is a single cell this is the same as splitting the beat, without nesting.
 */
export function splitCell(score, c, division, tuplet) {
  const b = score.bars[c.bar].beats[c.beat];
  const parent = parentOf(b, c.path);
  if (parent === b && b.cells.length === 1) return splitBeat(score, c, division, tuplet);
  const count = tuplet ?? division.divisionsPerWhole / parent.division.divisionsPerWhole;
  if (!Number.isInteger(count) || count < 2) return score;
  const l = getAt(b, c.path);
  return mapBeat(score, c, (beat) =>
    replaceAt(beat, c.path, () => group(division, tuplet, Array.from({ length: count }, (_, i) => leaf(i === 0 ? l.notes : [])))),
  );
}

/**
 * "Célula" mode: make the cell under `c` this value. Shorter splits it (see splitCell). Longer
 * merges back the enclosing part of the beat whose cells have that value, or the whole beat
 * when the value is the beat's or longer. A merge keeps the first notes of the merged part and
 * is refused, `{ refused: 'wouldLoseNotes' }`, when any other note would be deleted. The same
 * value returns the score unchanged.
 */
export function resizeCell(score, c, division, tuplet) {
  const beat = score.bars[c.bar].beats[c.beat];
  const parent = parentOf(beat, c.path);
  if (division.divisionsPerWhole > parent.division.divisionsPerWhole || (tuplet && division !== parent.division)) {
    return splitCell(score, c, division, tuplet);
  }
  if (division === parent.division && !tuplet) return score;
  // longer: find the ancestor cell whose own value is `division`
  for (let k = c.path.length - 1; k >= 1; k--) {
    const prefix = c.path.slice(0, k);
    if (parentOf(beat, prefix).division === division) {
      const node = getAt(beat, prefix);
      if (losesNotes([node], 1)) return { refused: 'wouldLoseNotes' };
      return mapBeat(score, c, (b) => replaceAt(b, prefix, (g) => leaf(firstNotes(g))));
    }
  }
  if (division.divisionsPerWhole <= beat.division.divisionsPerWhole || division.divisionsPerWhole <= barTimeSig(score, c.bar)[1]) {
    const [, den] = barTimeSig(score, c.bar);
    const keep = cellsPerBeat(division, den, null);
    if (losesNotes(beat.cells, keep)) return { refused: 'wouldLoseNotes' };
    return splitBeat(score, c, division, null);
  }
  return { refused: 'notInThisBeat' };
}

/** True if collapsing `cells` to their first `keep` top-level cells (each to its first leaf) drops notes. */
function losesNotes(cells, keep) {
  const leavesOf = (n) => (isGroup(n) ? n.cells.flatMap(leavesOf) : [n]);
  return cells.some((c, i) => {
    const leaves = leavesOf(c);
    const dropped = i < keep ? leaves.slice(1) : leaves;
    return dropped.some((l) => l.notes.length > 0);
  });
}

/** Undo a split: the group containing `c` becomes one leaf with its first notes. */
export function mergeCell(score, c) {
  if (c.path.length < 2) return score;
  const groupPath = c.path.slice(0, -1);
  return mapBeat(score, c, (beat) => replaceAt(beat, groupPath, (g) => leaf(firstNotes(g))));
}

export function addBar(score) {
  const [num, den] = barTimeSig(score, score.bars.length - 1);
  return touch({ ...score, bars: [...score.bars, emptyBar(num, den)] });
}

/** Drop bar `index`. A score always keeps at least one bar. */
export function removeBar(score, index) {
  if (score.bars.length <= 1) return score;
  let bars = score.bars.filter((_, i) => i !== index);
  // a removed bar that set the signature hands it on, so the bars after it keep their shape
  if (score.bars[index].timeSig && bars[index] && !bars[index].timeSig) {
    bars = bars.map((b, i) => (i === index ? { ...b, timeSig: score.bars[index].timeSig } : b));
  }
  if (index === 0 && bars[0].simile) bars = bars.map((b, i) => (i === 0 ? { ...b, simile: false } : b));
  return touch({ ...score, bars });
}

/**
 * Set (or with `null`, clear) the signature of bar `index`. That bar and every following bar
 * that inherits from it are reshaped: beats appended or dropped; a new beat unit rebuilds the
 * beats at that unit, each keeping the notes of its first cell.
 */
export function setTimeSig(score, index, sig) {
  const bars = score.bars.map((b, i) => (i === index ? { ...b, timeSig: sig ? [...sig] : null } : b));
  const next = { ...score, bars };
  const reshaped = bars.map((b, i) => {
    if (i < index) return b;
    if (i > index && b.timeSig) return b; // an explicit signature later on stops the change
    if (i > index && bars.slice(index + 1, i).some((x) => x.timeSig)) return b;
    return reshape(b, barTimeSig(next, i), barTimeSig(score, i));
  });
  return touch({ ...next, bars: reshaped });
}

function reshape(b, [num, den], [, oldDen]) {
  let beats = b.beats;
  if (den !== oldDen) beats = beats.map((x) => leafBeat(firstNotes(x), den));
  if (beats.length > num) beats = beats.slice(0, num);
  while (beats.length < num) beats = [...beats, emptyBeat(noteValueFor(den), den)];
  return { ...b, beats };
}

function leafBeat(notes, den) {
  return group(noteValueFor(den), null, [leaf(notes)]);
}

/**
 * Move bars `from..to` so they sit before the bar that was at index `gap` (gap = bars.length:
 * the end). Returns `{ score, range }`, range being where the block is now. Signatures are
 * written out on the block's first bar and on the bars that end up after the block or after
 * the hole it left, so every bar keeps its own shape; a `%` that lands first loses it.
 */
export function moveBars(score, from, to, gap) {
  if (gap >= from && gap <= to + 1) return { score, range: [from, to] };
  const sigAt = (i) => barTimeSig(score, i);
  const pin = (b, i) => (b.timeSig ? b : { ...b, timeSig: [...sigAt(i)] });
  let bars = score.bars.map((b, i) => (i === from || i === to + 1 || i === gap ? pin(b, i) : b));
  const block = bars.slice(from, to + 1);
  const rest = [...bars.slice(0, from), ...bars.slice(to + 1)];
  const at = gap > to ? gap - block.length : gap;
  bars = [...rest.slice(0, at), ...block, ...rest.slice(at)];
  if (bars[0].simile) bars = bars.map((b, i) => (i === 0 ? { ...b, simile: false } : b));
  return { score: touch({ ...score, bars }), range: [at, at + block.length - 1] };
}

/** Key signature from bar `index` on (fifths, or null to follow the bar before). Notes keep their pitch. */
export function setKey(score, index, fifths) {
  const k = fifths === null || fifths === undefined ? null : Math.max(-7, Math.min(7, fifths));
  if ((score.bars[index].key ?? null) === k) return score;
  return mapBar(score, index, (b) => ({ ...b, key: k }));
}

/** `%`: this bar repeats the previous one. The first bar has nothing to repeat. */
export function toggleSimile(score, index) {
  if (index === 0) return score;
  return mapBar(score, index, (b) => ({ ...b, simile: !b.simile }));
}

/** Free text above a bar: stick changes and other instructions real scores write in words. */
export function setBarText(score, index, text) {
  const clean = String(text ?? '').slice(0, 80);
  if ((score.bars[index].text ?? '') === clean) return score;
  return mapBar(score, index, (b) => ({ ...b, text: clean }));
}

export function toggleRepeatStart(score, index) {
  return mapBar(score, index, (b) => ({ ...b, repeatStart: !b.repeatStart }));
}

export function toggleRepeatEnd(score, index) {
  return mapBar(score, index, (b) => ({ ...b, repeatEnd: !b.repeatEnd }));
}

function touch(score) {
  return { ...score, updatedAt: Date.now() };
}

function mapBar(score, index, f) {
  return touch({ ...score, bars: score.bars.map((b, i) => (i === index ? f(b) : b)) });
}

function mapLeaf(score, c, f) {
  return mapBeat(score, c, (b) => replaceAt(b, c.path, f));
}

function mapBeat(score, c, f) {
  return mapBar(score, c.bar, (bar) => ({ ...bar, beats: bar.beats.map((b, i) => (i === c.beat ? f(b) : b)) }));
}

export { isGroup };

// ---- lengths: notes longer than their cell, dots and ties (pitched instruments) ----------

const ticksOf = (value) => (PPQ * 4) / value.divisionsPerWhole;
const valueOfTicks = (t) => NOTE_VALUES.find((v) => ticksOf(v) === t);

/** Every leaf of a bar in time order, with its start and length in ticks from the bar's start. */
export function barLeaves(score, barIndex) {
  const [, den] = barTimeSig(score, barIndex);
  const bt = beatTicks(den);
  return score.bars[barIndex].beats.flatMap((b, beat) =>
    leafTicks(b, den).map((l) => ({ bar: barIndex, beat, path: l.path, start: beat * bt + l.tick, length: l.length, leaf: l.leaf })));
}

const at = (l) => ({ bar: l.bar, beat: l.beat, path: l.path });
const setCont = (score, c, cont) => mapLeaf(score, c, () => leaf([], { cont }));

/** The continuations right after `c` (in this bar) stop continuing: the note they held ends at `c`. */
function clearChain(score, c) {
  const leaves = barLeaves(score, c.bar);
  let i = leaves.findIndex((l) => l.beat === c.beat && samePath(l.path, c.path)) + 1;
  let s = score;
  while (i > 0 && i < leaves.length && leaves[i].leaf.cont) {
    s = mapLeaf(s, at(leaves[i]), () => leaf());
    i += 1;
  }
  return s;
}

/**
 * Make the note at `c` last `value` (dotted: one and a half times). Longer than a beat: the
 * note moves to the beat's start and the following cells become continuations. A dotted value
 * shorter than a beat splits the beat into thirds of it. A cell boundary that cuts the length
 * is split where it must end. Refused when it would cover notes ({ refused: 'wouldLoseNotes' })
 * or run past the bar ({ refused: 'doesNotFit' }).
 */
export function setLength(score, c, value, dotted) {
  const [num, den] = barTimeSig(score, c.bar);
  const bt = beatTicks(den);
  const D = ticksOf(value) * (dotted ? 1.5 : 1);
  let s = clearChain(score, c);
  const notes = getAt(s.bars[c.bar].beats[c.beat], c.path).notes;
  let start;
  if (D >= bt) {
    s = splitBeat(s, c, noteValueFor(den), null);
    s = mapLeaf(s, { bar: c.bar, beat: c.beat, path: [0] }, () => leaf(notes));
    start = { bar: c.bar, beat: c.beat, path: [0] };
  } else {
    if (!dotted) return splitBeat(s, c, value, null);
    const unit = valueOfTicks(D / 3);
    if (!unit || bt % (D / 3) !== 0) return { refused: 'doesNotFit' };
    const cells = bt / (D / 3);
    const old = barLeaves(s, c.bar).find((l) => l.beat === c.beat && samePath(l.path, c.path));
    const index = Math.min(cells - 1, Math.floor((old.start - c.beat * bt) / (D / 3)));
    s = splitBeat(s, c, unit, null);
    s = mapLeaf(s, { bar: c.bar, beat: c.beat, path: [0] }, () => leaf());
    s = mapLeaf(s, { bar: c.bar, beat: c.beat, path: [index] }, () => leaf(notes));
    start = { bar: c.bar, beat: c.beat, path: [index] };
  }
  const first = barLeaves(s, c.bar).find((l) => l.beat === start.beat && samePath(l.path, start.path));
  const end = first.start + D;
  if (end > num * bt) return { refused: 'doesNotFit' };
  // walk forward, continuing or splitting cells until the length is covered
  for (let guard = 0; guard < 64; guard++) {
    const next = barLeaves(s, c.bar).find((l) => l.start > first.start && l.start < end && !l.leaf.cont);
    if (!next) break;
    if (next.leaf.notes.length) return { refused: 'wouldLoseNotes' };
    if (next.start + next.length <= end) { s = setCont(s, at(next), true); continue; }
    const v = valueOfTicks(end - next.start);
    if (!v || next.length % (end - next.start) !== 0) return { refused: 'doesNotFit' };
    s = splitCell(s, at(next), v, null);
    const parts = barLeaves(s, c.bar).find((l) => l.start === next.start);
    s = setCont(s, at(parts), true);
  }
  return s;
}

/** Toggle a tie into `c`: an empty cell continues the note before it (also from the previous bar). */
export function toggleTie(score, c) {
  const l = getAt(score.bars[c.bar].beats[c.beat], c.path);
  if (l.cont) return setCont(score, c, false);
  if (l.notes.length) return { refused: 'tieNeedsEmpty' };
  const here = barLeaves(score, c.bar);
  const i = here.findIndex((x) => x.beat === c.beat && samePath(x.path, c.path));
  const prev = i > 0 ? here[i - 1] : c.bar > 0 ? barLeaves(score, c.bar - 1).at(-1) : null;
  if (!prev || (!prev.leaf.notes.length && !prev.leaf.cont)) return { refused: 'nothingToTie' };
  return setCont(score, c, true);
}

/**
 * The notes a tie carries into bar `index` from before it (the bar starts with a continuation),
 * looking back over whole bars of held notes. Empty when the bar starts fresh.
 */
export function carryInto(score, index) {
  if (index === 0) return [];
  const first = barLeaves(score, index)[0];
  if (!first?.leaf.cont) return [];
  for (let b = index - 1; b >= 0; b--) {
    const leaves = barLeaves(score, b);
    for (let k = leaves.length - 1; k >= 0; k--) {
      if (leaves[k].leaf.cont) continue;
      return leaves[k].leaf.notes;
    }
  }
  return [];
}

/** True when bar `index + 1` starts by holding a note from bar `index` (draw the tie out). */
export function tiesOut(score, index) {
  return index + 1 < score.bars.length && !!barLeaves(score, index + 1)[0]?.leaf.cont;
}
