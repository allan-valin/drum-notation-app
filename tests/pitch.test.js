import { describe, it, expect } from 'vitest';
import { CLEFS, parseSlot, slotOf, staffPositionOf, makePitchedStaff, keyAlter, keyAccidentals, midiOf, frequencyOf } from '../src/core/pitch.js';

describe('pitch', () => {
  it('names slots by written letter and octave', () => {
    expect(parseSlot('E4')).toEqual({ step: 2, octave: 4 });
    expect(slotOf(6, 3)).toBe('B3');
  });
  it('places the bottom line of each clef where it belongs', () => {
    expect(staffPositionOf('E4', 'treble')).toBe(0);
    expect(staffPositionOf('F5', 'treble')).toBe(8);
    expect(staffPositionOf('G2', 'bass')).toBe(0);
    expect(staffPositionOf('A3', 'bass')).toBe(8);
    expect(staffPositionOf('C4', 'alto')).toBe(4);
    expect(staffPositionOf('E4', 'treble8vb')).toBe(0);
  });
  it('builds a staff whose slots cover the range, one per line and space', () => {
    const staff = makePitchedStaff('treble', 'C4', 'C6');
    expect(staff.slots.length).toBe(15);
    expect(staff.slots[0]).toMatchObject({ id: 'C4', staffPosition: -2 });
    expect(staff.clef).toBe('treble');
  });
  it('reads key signatures by fifths', () => {
    expect(keyAlter(2, parseSlot('F4').step)).toBe(1);   // D major: F#
    expect(keyAlter(2, parseSlot('G4').step)).toBe(0);
    expect(keyAlter(-1, parseSlot('B4').step)).toBe(-1); // F major: Bb
  });
  it('lays key signature accidentals in the standard order and octave for the clef', () => {
    expect(keyAccidentals(3, 'treble')).toEqual([{ slot: 'F5', alter: 1 }, { slot: 'C5', alter: 1 }, { slot: 'G5', alter: 1 }]);
    expect(keyAccidentals(-2, 'bass')).toEqual([{ slot: 'B2', alter: -1 }, { slot: 'E3', alter: -1 }]);
  });
  it('turns written pitch into MIDI and frequency, with octave-down clefs and transposition', () => {
    expect(midiOf({ slotId: 'A4', alter: 0 }, { clef: 'treble' })).toBe(69);
    expect(midiOf({ slotId: 'C4', alter: 1 }, { clef: 'treble' })).toBe(61);
    expect(midiOf({ slotId: 'E4', alter: 0 }, { clef: 'treble8vb' })).toBe(52);
    expect(midiOf({ slotId: 'D5', alter: 0 }, { clef: 'treble', transpose: -2 })).toBe(72);
    expect(frequencyOf(69)).toBeCloseTo(440);
    expect(frequencyOf(69.5)).toBeCloseTo(440 * 2 ** (0.5 / 12));
  });
  it('every clef has a glyph line', () => {
    for (const c of Object.values(CLEFS)) expect(typeof c.glyphPosition).toBe('number');
  });
});
