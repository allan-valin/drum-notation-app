import { describe, it, expect } from 'vitest';
import { encode, decode, SCHEMA_VERSION } from '../src/core/json.js';
import { newScore, note, emptyBar, Articulation, Sticking } from '../src/core/score.js';
import { NoteValue } from '../src/core/noteValue.js';
import { placeNote, subdivide } from '../src/core/edit.js';
import { cursor } from '../src/core/cursor.js';

function sample() {
  let s = newScore({ id: 'abc', title: 'Groove', defaultBpm: 92, createdAt: 1, updatedAt: 2 });
  s = subdivide(s, cursor(0, 0, 0), NoteValue.SIXTEENTH, null);
  s = subdivide(s, cursor(0, 1, 0), NoteValue.EIGHTH, 3);
  s = placeNote(s, cursor(0, 0, 0), note('kick'));
  s = placeNote(s, cursor(0, 0, 0), note('hihat', { articulations: [Articulation.ACCENT], sticking: Sticking.R }));
  s = placeNote(s, cursor(0, 1, 2), note('snare', { articulations: [Articulation.GHOST] }));
  return { ...s, updatedAt: 2 };
}

describe('score JSON', () => {
  it('round-trips a score', () => {
    expect(decode(encode(sample()))).toEqual(sample());
  });
  it('carries a schema version', () => {
    expect(JSON.parse(encode(sample())).schema_version).toBe(SCHEMA_VERSION);
  });
  it('stores note values by id, not by object', () => {
    const j = JSON.parse(encode(sample()));
    expect(j.bars[0].beats[0].division).toBe('sixteenth');
  });
  it('rejects a newer schema', () => {
    const j = { ...JSON.parse(encode(sample())), schema_version: SCHEMA_VERSION + 1 };
    expect(() => decode(JSON.stringify(j))).toThrow(/schema/);
  });
  it('rejects a bar whose cell count disagrees with its division', () => {
    const j = JSON.parse(encode(sample()));
    j.bars[0].beats[0].cells.pop();
    expect(() => decode(JSON.stringify(j))).toThrow(/cells/);
  });
  it('rejects an unknown slot', () => {
    const j = JSON.parse(encode(sample()));
    j.bars[0].beats[0].cells[0][0] = 'cowbell';
    expect(() => decode(JSON.stringify(j))).toThrow(/slot/);
  });
  it('fills in a missing id and timestamps on import', () => {
    const j = JSON.parse(encode(sample()));
    delete j.id; delete j.createdAt; delete j.updatedAt;
    const s = decode(JSON.stringify(j));
    expect(typeof s.id).toBe('string');
    expect(typeof s.createdAt).toBe('number');
  });
  it('accepts the minimal hand-written form: bars of beats of cells of slot ids', () => {
    const minimal = {
      schema_version: SCHEMA_VERSION,
      title: 'Mínimo',
      bars: [{ beats: [
        { division: 'eighth', cells: [['kick', 'hihat'], ['hihat']] },
        { division: 'quarter', cells: [['snare']] },
        { division: 'eighth', tuplet: 3, cells: [['snare'], [], ['snare']] },
        { division: 'quarter', cells: [[]] },
      ] }],
    };
    const s = decode(JSON.stringify(minimal));
    expect(s.bars[0].beats[0].cells[0].notes.map((n) => n.slotId)).toEqual(['kick', 'hihat']);
    expect(s.bars[0].beats[2].tuplet).toBe(3);
    expect(s.bars[0].beats[2].cells[1].notes).toEqual([]);
    expect(s.timeSigNum).toBe(4);
  });
});
