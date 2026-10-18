import { cellsPerBeat } from './noteValue.js';
import { beat as mkBeat, cell as mkCell, emptyBar } from './score.js';

/**
 * Write `note` at `c`. A note already on the same slot is replaced; a note on a different
 * slot joins it, because notes in one cell sound together. The cursor does not move: that is
 * what makes entering a kick and a hi-hat together two taps in the same place.
 */
export function placeNote(score, c, note) {
  return mapCell(score, c, (cell) => mkCell([...cell.notes.filter((n) => n.slotId !== note.slotId), note]));
}

/** Remove whatever is on `slotId` at `c`, if anything. */
export function deleteNote(score, c, slotId) {
  const cell = score.bars[c.bar].beats[c.beat].cells[c.cell];
  if (!cell.notes.some((n) => n.slotId === slotId)) return score;
  return mapCell(score, c, (cell) => mkCell(cell.notes.filter((n) => n.slotId !== slotId)));
}

/**
 * Re-split the beat under `c`. Notes in cells that survive the change are kept; notes
 * beyond the new cell count are dropped, which is the only place editing loses anything.
 */
export function subdivide(score, c, division, tuplet) {
  return mapBeat(score, c, (beat) => {
    const count = cellsPerBeat(division, score.timeSigDen, tuplet);
    return mkBeat(division, tuplet, Array.from({ length: count }, (_, i) => beat.cells[i] ?? mkCell()));
  });
}

export function addBar(score) {
  return touch({ ...score, bars: [...score.bars, emptyBar(score.timeSigNum, score.timeSigDen)] });
}

/** Drop bar `index`. A score always keeps at least one bar. */
export function removeBar(score, index) {
  if (score.bars.length <= 1) return score;
  return touch({ ...score, bars: score.bars.filter((_, i) => i !== index) });
}

function touch(score) {
  return { ...score, updatedAt: Date.now() };
}

function mapCell(score, c, f) {
  return mapBeat(score, c, (beat) => ({
    ...beat,
    cells: beat.cells.map((cell, i) => (i === c.cell ? f(cell) : cell)),
  }));
}

function mapBeat(score, c, f) {
  return touch({
    ...score,
    bars: score.bars.map((bar, bi) =>
      bi !== c.bar ? bar : { ...bar, beats: bar.beats.map((b, i) => (i === c.beat ? f(b) : b)) },
    ),
  });
}
