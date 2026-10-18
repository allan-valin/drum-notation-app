import { describe, it, expect } from 'vitest';
import { newScore, note } from '../src/core/score.js';
import { toFull, addPart, removePart, toggleMute, setInstrument, partView, zipPart, groupOf, bandRows } from '../src/core/parts.js';
import { cursor } from '../src/core/cursor.js';
import { placeNote } from '../src/core/edit.js';
import { encode, decodeFull } from '../src/core/json.js';
import { profileById, INSTRUMENTS, GROUPS } from '../src/core/profile.js';
import { performanceAll } from '../src/core/schedule.js';

const base = () => toFull(newScore({ id: 'g', title: 't' }));

describe('grand staff instruments', () => {
  it('piano and harp are offered; their hands are not offered on their own', () => {
    expect(INSTRUMENTS).toEqual(expect.arrayContaining(['piano', 'harp']));
    expect(INSTRUMENTS).not.toContain('pianoRH');
    expect(GROUPS.piano).toEqual(['pianoRH', 'pianoLH']);
    expect(profileById('pianoRH').staves[0].clef).toBe('treble');
    expect(profileById('pianoLH').staves[0].clef).toBe('bass');
  });
  it('adding a piano adds both hands, linked', () => {
    const full = addPart(base(), 'piano');
    const [, rh, lh] = full.parts;
    expect([rh.instrument, lh.instrument]).toEqual(['pianoRH', 'pianoLH']);
    expect(rh.group).toBeTruthy();
    expect(rh.group).toBe(lh.group);
    expect(groupOf(full, lh.id).map((p) => p.id)).toEqual([rh.id, lh.id]);
  });
  it('the band list shows one row per instrument', () => {
    const full = addPart(addPart(base(), 'piano'), 'congas');
    expect(bandRows(full).map((r) => r.instrument)).toEqual(['drums', 'piano', 'congas']);
  });
  it('removing or muting one hand does it to both', () => {
    let full = addPart(base(), 'piano');
    const rh = full.parts[1].id;
    full = toggleMute(full, rh);
    expect(full.parts.slice(1).every((p) => p.muted)).toBe(true);
    full = removePart(full, rh);
    expect(full.parts.map((p) => p.instrument)).toEqual(['drums']);
  });
  it('turning a piano into another instrument replaces both hands, in place', () => {
    let full = addPart(addPart(base(), 'piano'), 'congas');
    full = setInstrument(full, full.parts[1].id, 'keys');
    expect(full.parts.map((p) => p.instrument)).toEqual(['drums', 'keys', 'congas']);
    full = setInstrument(full, full.parts[1].id, 'harp');
    expect(full.parts.map((p) => p.instrument)).toEqual(['drums', 'harpRH', 'harpLH', 'congas']);
  });
  it('each hand keeps its own rhythm and both play', () => {
    let full = addPart(base(), 'piano');
    const [, rh, lh] = full.parts.map((p) => p.id);
    full = zipPart(full, rh, placeNote(partView(full, rh), cursor(0, 0, 0), { ...note('C5'), alter: 0 }));
    full = zipPart(full, lh, placeNote(partView(full, lh), cursor(0, 0, 0), { ...note('C3'), alter: 0 }));
    const hits = performanceAll(full, 0, 0).hits.filter((h) => h.sound === 'voice:piano');
    expect(hits.length).toBe(2);
  });
  it('the link survives a round trip', () => {
    const full = { ...addPart(base(), 'piano'), updatedAt: 1 };
    expect(decodeFull(encode(full))).toEqual(full);
  });
});
