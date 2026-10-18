import { describe, it, expect } from 'vitest';
import { note } from '../src/core/score.js';
import { profileById, INSTRUMENTS } from '../src/core/profile.js';
import { soundFor } from '../src/core/schedule.js';
import { VOICES } from '../src/audio/voices.js';

describe('Japanese instruments on a Western staff', () => {
  it('koto, shamisen and shakuhachi are pitched with their own voices', () => {
    for (const id of ['koto', 'shamisen', 'shakuhachi']) {
      const p = profileById(id);
      expect(INSTRUMENTS).toContain(id);
      expect(p.staves[0].pitched).toBe(true);
      expect(VOICES).toContain(p.voice);
    }
  });
  it('taiko: don below, tsu in the middle, ka (rim) above with an X', () => {
    const staff = profileById('taiko').staves[0];
    const at = (id) => staff.slots.find((s) => s.id === id);
    expect(at('don').staffPosition).toBeLessThan(at('tsu').staffPosition);
    expect(at('tsu').staffPosition).toBeLessThan(at('ka').staffPosition);
    expect(at('ka').notehead).toBe('cross');
    expect(soundFor(note('don'), 'taiko')).toBe('taikoDon');
    expect(soundFor(note('ka'), 'taiko')).toBe('taikoKa');
  });
});
