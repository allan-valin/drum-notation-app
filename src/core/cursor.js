import { getAt, leafPaths, parentOf, isGroup, samePath } from './tree.js';

/**
 * Where editing is pointing: a bar, a beat, and the path from the beat down to a leaf.
 * `cursor(0, 1, 2)` is bar 0, beat 1, cell 2; `cursor(0, 1, 2, 0)` goes one level deeper.
 */
export function cursor(bar = 0, beat = 0, ...path) {
  return { bar, beat, path: path.length ? path : [0] };
}

export function beatAt(score, c) {
  return score.bars[c.bar].beats[c.beat];
}

export function leafAt(score, c) {
  return getAt(beatAt(score, c), c.path);
}

/** The written value of the leaf under the cursor: its parent group's division. */
export function leafValue(score, c) {
  return parentOf(beatAt(score, c), c.path).division;
}

/** One position forward, through every leaf of every beat. Stops dead at the end. */
export function next(score, c) {
  const paths = leafPaths(beatAt(score, c));
  const i = paths.findIndex((p) => samePath(p, c.path));
  if (i + 1 < paths.length) return { ...c, path: paths[i + 1] };
  if (c.beat + 1 < score.bars[c.bar].beats.length) return firstLeaf(score, c.bar, c.beat + 1);
  if (c.bar + 1 < score.bars.length) return firstLeaf(score, c.bar + 1, 0);
  return c;
}

/** One position back. Stops dead at the start. */
export function prev(score, c) {
  const paths = leafPaths(beatAt(score, c));
  const i = paths.findIndex((p) => samePath(p, c.path));
  if (i > 0) return { ...c, path: paths[i - 1] };
  if (c.beat > 0) return lastLeaf(score, c.bar, c.beat - 1);
  if (c.bar > 0) return lastLeaf(score, c.bar - 1, score.bars[c.bar - 1].beats.length - 1);
  return c;
}

export function firstLeaf(score, bar, beat) {
  return { bar, beat, path: leafPaths(score.bars[bar].beats[beat])[0] };
}

function lastLeaf(score, bar, beat) {
  const paths = leafPaths(score.bars[bar].beats[beat]);
  return { bar, beat, path: paths[paths.length - 1] };
}

/** Pull a cursor back onto an existing leaf after bars, beats or cells vanish under it. */
export function clamp(score, c) {
  const bar = Math.max(0, Math.min(c.bar, score.bars.length - 1));
  const beat = Math.max(0, Math.min(c.beat, score.bars[bar].beats.length - 1));
  let node = score.bars[bar].beats[beat];
  const path = [];
  for (const i of c.path) {
    if (!isGroup(node)) break;
    const j = Math.max(0, Math.min(i, node.cells.length - 1));
    path.push(j);
    node = node.cells[j];
  }
  while (isGroup(node)) { path.push(0); node = node.cells[0]; }
  return { bar, beat, path };
}

/** "1.2.1" style label: beat, then each index down the path, 1-based. */
export function posLabel(c) {
  return [c.beat + 1, ...c.path.map((i) => i + 1)].join('.');
}
