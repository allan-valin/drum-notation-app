/*
// Ported from casus (same author), tests included, 2026-10-18.
 * Caret-preview drag (feedback D17): nothing moves while the reader aims. A ghost follows
 * the pointer, a caret marks the gap under it, and the move happens on release. The geometry
 * and the state machine are pure; BlockPane.svelte wires pointer events to them.
 */

/** Gap points of a wrapped row layout: gap i sits before item i (i < n) and after the last. */
function gaps(rects) {
  const out = [];
  // group into rows by vertical overlap of centres
  const rows = [];
  for (let i = 0; i < rects.length; i += 1) {
    const r = rects[i];
    const cy = r.y + r.height / 2;
    let row = rows.find((w) => cy >= w.top && cy <= w.bottom);
    if (!row) { row = { top: r.y, bottom: r.y + r.height, items: [] }; rows.push(row); }
    row.top = Math.min(row.top, r.y); row.bottom = Math.max(row.bottom, r.y + r.height);
    row.items.push(i);
  }
  for (const row of rows) {
    const h = row.bottom - row.top;
    let prev = null;
    for (const i of row.items) {
      const r = rects[i];
      const x = prev ? (prev.x + prev.width + r.x) / 2 : r.x - 4;
      out.push({ gap: i, x, y: row.top, height: h, row });
      prev = r;
    }
    const last = rects[row.items[row.items.length - 1]];
    const next = row.items[row.items.length - 1] + 1;
    out.push({ gap: next, x: last.x + last.width + 4, y: row.top, height: h, row });
  }
  return out;
}

/**
 * nearestGap(rects, point[, { withPoint }]) -> gap index, or { gap, x, y, height }.
 * The pointer's own row wins; inside it, the closest gap by x. Off every row, the nearest row.
 */
export function nearestGap(rects, point, { withPoint = false } = {}) {
  if (rects.length === 0) return withPoint ? { gap: 0, x: 0, y: 0, height: 0 } : 0;
  const all = gaps(rects);
  const dy = (g) => (point.y < g.row.top ? g.row.top - point.y : point.y > g.row.bottom ? point.y - g.row.bottom : 0);
  const best = all.reduce((b, g) => {
    const d = dy(g) * 1000 + Math.abs(g.x - point.x);
    return !b || d < b.d ? { g, d } : b;
  }, null).g;
  return withPoint ? { gap: best.gap, x: best.x, y: best.y, height: best.height } : best.gap;
}

/**
 * createDrag({ threshold, holdMs, rects }) -> { down, move, hold, up, cancel, state }
 * - mouse/pen: the drag starts once the pointer moved `threshold` px (a click stays a click)
 * - touch: the drag starts after `holdMs` still; a move during the hold cancels it, the page scrolls
 * `rects()` returns the current item boxes (minus nothing: the dragged item stays in place, dimmed).
 */
export function createDrag({ threshold = 6, holdMs = 200, rects = () => [] } = {}) {
  const idle = () => ({ item: null, dragging: false, gap: null, caret: null, origin: null, pointerType: null, downAt: 0, x: 0, y: 0 });
  const state = idle();
  const report = () => ({ dragging: state.dragging, gap: state.gap, caret: state.caret, item: state.item });

  function begin() {
    state.dragging = true;
    aim();
  }
  function aim() {
    const c = nearestGap(rects(), { x: state.x, y: state.y }, { withPoint: true });
    state.gap = c.gap;
    state.caret = c;
  }
  return {
    state,
    down({ item, x, y, pointerType = 'mouse', at = 0 }) {
      Object.assign(state, idle(), { item, origin: { x, y }, pointerType, downAt: at, x, y });
      return report();
    },
    /** the hold timer fired (touch): start if the finger is still down and has not moved */
    hold({ at = 0 } = {}) {
      if (state.item === null || state.dragging) return report();
      if (state.pointerType === 'touch' && at - state.downAt >= holdMs) begin();
      return report();
    },
    move({ x, y, at = 0 }) {
      if (state.item === null) return report();
      state.x = x; state.y = y;
      if (state.dragging) { aim(); return report(); }
      const far = Math.hypot(x - state.origin.x, y - state.origin.y) >= threshold;
      if (state.pointerType === 'touch') {
        if (far && at - state.downAt < holdMs) Object.assign(state, idle());   // a scroll, not a drag
        else if (far) begin();
      } else if (far) begin();
      return report();
    },
    /** -> { item, gap } when a drag ends on a gap; null for a plain click or a cancelled drag */
    up({ x, y } = {}) {
      if (state.item === null) return null;
      if (!state.dragging) { Object.assign(state, idle()); return null; }
      if (x !== undefined) { state.x = x; state.y = y; aim(); }
      const result = { item: state.item, gap: state.gap };
      Object.assign(state, idle());
      return result;
    },
    cancel() { Object.assign(state, idle()); },
  };
}

/** Tokens before gap `gap` in `items`, not counting the item being moved: the `to` of reader.moveItem. */
export function tokenOffset(items, gap, movingId) {
  return items.slice(0, gap).filter((i) => String(i.id) !== String(movingId)).reduce((n, i) => n + i.indices.length, 0);
}
