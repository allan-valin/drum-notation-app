/** Where editing is pointing. Only `next` and `prev` ever move it. */
export function cursor(bar = 0, beat = 0, cell = 0) {
  return { bar, beat, cell };
}

export function beatAt(score, c) {
  return score.bars[c.bar].beats[c.beat];
}

/** One position forward, into the next cell, beat or bar. Stops dead at the end. */
export function next(score, c) {
  const beat = beatAt(score, c);
  if (c.cell + 1 < beat.cells.length) return cursor(c.bar, c.beat, c.cell + 1);
  if (c.beat + 1 < score.bars[c.bar].beats.length) return cursor(c.bar, c.beat + 1, 0);
  if (c.bar + 1 < score.bars.length) return cursor(c.bar + 1, 0, 0);
  return c;
}

/** One position back. Stops dead at the start. */
export function prev(score, c) {
  if (c.cell > 0) return cursor(c.bar, c.beat, c.cell - 1);
  if (c.beat > 0) {
    const target = score.bars[c.bar].beats[c.beat - 1];
    return cursor(c.bar, c.beat - 1, target.cells.length - 1);
  }
  if (c.bar > 0) {
    const prevBar = score.bars[c.bar - 1];
    const lastBeat = prevBar.beats.length - 1;
    return cursor(c.bar - 1, lastBeat, prevBar.beats[lastBeat].cells.length - 1);
  }
  return c;
}

/** Pull a cursor back inside the score after bars or cells vanish under it. */
export function clamp(score, c) {
  const bar = Math.min(c.bar, score.bars.length - 1);
  const beat = Math.min(c.beat, score.bars[bar].beats.length - 1);
  const cell = Math.min(c.cell, score.bars[bar].beats[beat].cells.length - 1);
  return cursor(bar, beat, cell);
}
