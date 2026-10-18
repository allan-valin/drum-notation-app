import { describe, it, expect } from 'vitest';
import { paginate } from '../src/core/pagination.js';

describe('paginate', () => {
  it('fills lines then pages', () => {
    expect(paginate(10, { barsPerLine: 4, linesPerPage: 2 })).toEqual([
      [[0, 1, 2, 3], [4, 5, 6, 7]],
      [[8, 9]],
    ]);
  });
  it('an empty score is one empty page', () => {
    expect(paginate(0, { barsPerLine: 4, linesPerPage: 2 })).toEqual([[]]);
  });
  it('exactly full pages add no blank page', () => {
    expect(paginate(8, { barsPerLine: 4, linesPerPage: 2 }).length).toBe(1);
  });
});
