/** Helpers over the cell tree: a group has `cells`, a leaf has `notes`. Paths are index lists. */

export function isGroup(node) {
  return Array.isArray(node?.cells);
}

/** Every leaf's path, depth first, left to right. */
export function leafPaths(g, prefix = []) {
  return g.cells.flatMap((c, i) => (isGroup(c) ? leafPaths(c, [...prefix, i]) : [[...prefix, i]]));
}

/** Every leaf with its start and size as fractions of `g`, its parent group and its path. */
export function leafSpans(g, start = 0, size = 1, prefix = []) {
  const step = size / g.cells.length;
  return g.cells.flatMap((c, i) => {
    const s = start + step * i;
    const path = [...prefix, i];
    return isGroup(c) ? leafSpans(c, s, step, path) : [{ path, start: s, size: step, parent: g, leaf: c }];
  });
}

/** Every group below `g` (not `g` itself) with its span, for tuplet brackets and hit areas. */
export function groupSpans(g, start = 0, size = 1, prefix = [], depth = 1) {
  const step = size / g.cells.length;
  return g.cells.flatMap((c, i) => {
    if (!isGroup(c)) return [];
    const s = start + step * i;
    const path = [...prefix, i];
    return [{ path, start: s, size: step, group: c, depth }, ...groupSpans(c, s, step, path, depth + 1)];
  });
}

export function getAt(g, path) {
  return path.reduce((node, i) => node?.cells?.[i], g);
}

export function parentOf(g, path) {
  return getAt(g, path.slice(0, -1));
}

/** A copy of `g` with the node at `path` replaced by `f(node)`. */
export function replaceAt(g, path, f) {
  if (path.length === 0) return f(g);
  const [i, ...rest] = path;
  return { ...g, cells: g.cells.map((c, j) => (j === i ? replaceAt(c, rest, f) : c)) };
}

/** Notes of the first leaf under `node`: what survives when a subtree collapses to one cell. */
export function firstNotes(node) {
  while (isGroup(node)) node = node.cells[0];
  return node?.notes ?? [];
}

export function samePath(a, b) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}
