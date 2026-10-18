import { cellsPerBeat, noteValueFor } from './noteValue.js';
import { leaf, group, emptyBar, emptyBeat, barTimeSig } from './score.js';
import { isGroup, getAt, parentOf, replaceAt, firstNotes } from './tree.js';

/**
 * Write `note` at `c`. A note already on the same slot is replaced; a note on a different
 * slot joins it, because notes in one cell sound together. The cursor does not move: that is
 * what makes entering a kick and a hi-hat together two taps in the same place.
 */
export function placeNote(score, c, note) {
  return mapLeaf(score, c, (l) => leaf([...l.notes.filter((n) => n.slotId !== note.slotId), note]));
}

/** Remove whatever is on `slotId` at `c`, if anything. */
export function deleteNote(score, c, slotId) {
  const l = getAt(score.bars[c.bar].beats[c.beat], c.path);
  if (!l.notes.some((n) => n.slotId === slotId)) return score;
  return mapLeaf(score, c, (x) => leaf(x.notes.filter((n) => n.slotId !== slotId)));
}

/** Empty the leaf at `c` (a rest). */
export function clearLeaf(score, c) {
  const l = getAt(score.bars[c.bar].beats[c.beat], c.path);
  if (l.notes.length === 0) return score;
  return mapLeaf(score, c, () => leaf());
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
