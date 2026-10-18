import { describe, it, expect } from 'vitest';
import { nearestGap, createDrag } from '../../src/app/lib/drag.js';

/* Feedback D17: blocks stay still while aiming; a caret marks the gap the pointer is over and
 * the move happens on release. The geometry is pure so it is tested without a layout engine. */

// three items on row one, two on row two (x, y, w, h)
const rects = [
  { x: 0, y: 0, width: 100, height: 40 }, { x: 110, y: 0, width: 100, height: 40 }, { x: 220, y: 0, width: 100, height: 40 },
  { x: 0, y: 50, width: 100, height: 40 }, { x: 110, y: 50, width: 100, height: 40 },
];

describe('nearestGap', () => {
  it('returns the gap index (0..n) whose point is closest to the pointer, same row first', () => {
    expect(nearestGap(rects, { x: 2, y: 20 })).toBe(0);         // before the first
    expect(nearestGap(rects, { x: 104, y: 20 })).toBe(1);       // between first and second
    expect(nearestGap(rects, { x: 330, y: 20 })).toBe(3);       // after the last of row one
    expect(nearestGap(rects, { x: 104, y: 70 })).toBe(4);       // between the two of row two
    expect(nearestGap(rects, { x: 300, y: 70 })).toBe(5);       // after everything
  });
  it('prefers the pointer’s own row to a nearer gap on another row', () => {
    expect(nearestGap(rects, { x: 215, y: 72 })).toBe(5);
  });
  it('gives the caret a position: the gap’s x and the row’s top and height', () => {
    expect(nearestGap(rects, { x: 104, y: 20 }, { withPoint: true })).toEqual({ gap: 1, x: 105, y: 0, height: 40 });
    expect(nearestGap(rects, { x: 2, y: 20 }, { withPoint: true })).toEqual({ gap: 0, x: -4, y: 0, height: 40 });
  });
  it('an empty pool has one gap', () => {
    expect(nearestGap([], { x: 10, y: 10 })).toBe(0);
  });
});

describe('createDrag', () => {
  const start = (opts = {}) => {
    const d = createDrag({ threshold: 6, holdMs: 200, ...opts });
    return d;
  };
  it('does not start before the pointer moved past the threshold (a click stays a click)', () => {
    const d = start();
    d.down({ item: 1, x: 10, y: 10, pointerType: 'mouse', at: 0 });
    expect(d.move({ x: 13, y: 12, at: 10 }).dragging).toBe(false);
    expect(d.move({ x: 20, y: 10, at: 20 }).dragging).toBe(true);
    expect(d.state.item).toBe(1);
  });
  it('on touch, starts only after a hold, and a move during the hold cancels it (the page scrolls)', () => {
    const d = start();
    d.down({ item: 2, x: 10, y: 10, pointerType: 'touch', at: 0 });
    expect(d.move({ x: 10, y: 30, at: 50 }).dragging).toBe(false);
    expect(d.state.item).toBe(null);                              // cancelled: scroll wins
    d.down({ item: 2, x: 10, y: 10, pointerType: 'touch', at: 100 });
    expect(d.hold({ at: 300 }).dragging).toBe(true);               // the hold timer fired
    expect(d.move({ x: 50, y: 10, at: 320 }).dragging).toBe(true);
  });
  it('reports the gap while dragging and the move on release; neither before', () => {
    const d = start({ rects: () => rects });
    d.down({ item: 0, x: 50, y: 20, pointerType: 'mouse', at: 0 });
    expect(d.move({ x: 52, y: 20, at: 5 }).gap).toBe(null);
    const mid = d.move({ x: 215, y: 20, at: 10 });
    expect(mid.dragging).toBe(true);
    expect(mid.gap).toBe(2);
    expect(d.up({ x: 215, y: 20, at: 20 })).toEqual({ item: 0, gap: 2 });
    expect(d.state.item).toBe(null);
  });
  it('a release without a drag is a click, not a move; Escape cancels a drag', () => {
    const d = start({ rects: () => rects });
    d.down({ item: 0, x: 50, y: 20, pointerType: 'mouse', at: 0 });
    expect(d.up({ x: 51, y: 20, at: 20 })).toBe(null);
    d.down({ item: 0, x: 50, y: 20, pointerType: 'mouse', at: 0 });
    d.move({ x: 215, y: 20, at: 10 });
    d.cancel();
    expect(d.state.item).toBe(null);
    expect(d.up({ x: 215, y: 20, at: 20 })).toBe(null);
  });
});

import { tokenOffset } from '../../src/app/lib/drag.js';

describe('tokenOffset', () => {
  const items = [{ id: '0', indices: [0] }, { id: '1+2', indices: [1, 2] }, { id: '3', indices: [3] }];
  it('counts the tokens before a gap, leaving the moving item out', () => {
    expect(tokenOffset(items, 0, '3')).toBe(0);
    expect(tokenOffset(items, 1, '3')).toBe(1);
    expect(tokenOffset(items, 2, '3')).toBe(3);
    expect(tokenOffset(items, 3, '3')).toBe(3);      // after itself: no move
    expect(tokenOffset(items, 3, '0')).toBe(3);
    expect(tokenOffset(items, 1, '1+2')).toBe(1);    // its own gap: no move
  });
});
