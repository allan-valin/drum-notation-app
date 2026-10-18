import { describe, it, expect } from 'vitest';
import { NoteValue } from '../src/core/noteValue.js';
import { note, leaf, group } from '../src/core/score.js';
import { beamGroups, beams } from '../src/core/beaming.js';

const S = () => leaf([note('snare')]);
const R = () => leaf();
const beat = (division, ...filled) => group(division, null, filled.map((f) => (f ? S() : R())));

describe('beamGroups (level-1 runs)', () => {
  it('four consecutive sixteenths beam as one group', () => {
    expect(beamGroups(beat(NoteValue.SIXTEENTH, true, true, true, true))).toEqual([[0, 3]]);
  });
  it('a rest breaks the beam', () => {
    expect(beamGroups(beat(NoteValue.SIXTEENTH, true, true, false, true))).toEqual([[0, 1], [3, 3]]);
  });
  it('quarters never beam', () => {
    expect(beamGroups(beat(NoteValue.QUARTER, true))).toEqual([]);
  });
  it('an empty beat has no groups', () => {
    expect(beamGroups(beat(NoteValue.SIXTEENTH, false, false))).toEqual([]);
  });
});

describe('beams over nested cells', () => {
  it('eighth + two sixteenths: one long beam and one short beam', () => {
    const b = group(NoteValue.EIGHTH, null, [S(), group(NoteValue.SIXTEENTH, null, [S(), S()])]);
    expect(beams(b)).toEqual([
      { level: 1, from: 0, to: 2 },
      { level: 2, from: 1, to: 2 },
    ]);
  });
  it('a lone sixteenth inside an eighth beam gets a stub toward its neighbour', () => {
    const b = group(NoteValue.EIGHTH, null, [S(), group(NoteValue.SIXTEENTH, null, [S(), R()])]);
    expect(beams(b)).toEqual([
      { level: 1, from: 0, to: 1 },
      { level: 2, from: 1, to: 1, stub: 'left' },
    ]);
  });
  it('a single flagged note produces no beam', () => {
    expect(beams(beat(NoteValue.EIGHTH, true, false))).toEqual([]);
  });
});
