import { describe, it, expect } from 'vitest';
import { DRUM_PROFILE, Notehead, slotNearest } from '../src/core/profile.js';

const staff = DRUM_PROFILE.staves[0];
const slot = (id) => staff.slots.find((s) => s.id === id);

describe('drum profile', () => {
  it('is a single five-line staff', () => {
    expect(DRUM_PROFILE.staves.length).toBe(1);
    expect(staff.lineCount).toBe(5);
  });
  it('bass drums sit in the bottom of the staff, the hi-hat pedal below it (Rock Band key)', () => {
    expect(slot('kick').staffPosition).toBe(1);
    expect(slot('kickLeft').staffPosition).toBe(0);
    expect(slot('hihatPedal').staffPosition).toBeLessThan(0);
  });
  it('cymbals sit above the staff and use a cross notehead', () => {
    expect(slot('crash').staffPosition).toBeGreaterThan(8);
    expect(slot('crash').notehead).toBe(Notehead.CROSS);
  });
  it('drums use a normal notehead', () => {
    expect(slot('snare').notehead).toBe(Notehead.NORMAL);
  });
  it('slot ids are unique', () => {
    const ids = staff.slots.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('a tap maps to the nearest slot', () => {
    expect(slotNearest(staff, slot('snare').staffPosition)).toBe(slot('snare'));
  });
  it('a tap far above the staff maps to the highest slot', () => {
    const highest = staff.slots.reduce((a, b) => (b.staffPosition > a.staffPosition ? b : a));
    expect(slotNearest(staff, 99)).toBe(highest);
  });
  it('every slot has a pt-BR name', () => {
    expect(staff.slots.every((s) => typeof s.name === 'string' && s.name.length > 0)).toBe(true);
  });
});
