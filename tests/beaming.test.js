import { describe, it, expect } from 'vitest';
import { NoteValue } from '../src/core/noteValue.js';
import { note, cell, beat as mkBeat } from '../src/core/score.js';
import { beamGroups } from '../src/core/beaming.js';

const beat = (division, ...filled) =>
  mkBeat(division, null, filled.map((f) => (f ? cell([note('snare')]) : cell([]))));

describe('beamGroups', () => {
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
