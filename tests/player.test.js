import { describe, it, expect } from 'vitest';
import { createPlayer } from '../src/audio/player.js';
import { performance } from '../src/core/schedule.js';
import { decode } from '../src/core/json.js';

const q = (...slots) => ({ division: 'quarter', cells: [slots] });
const s = decode({ schema_version: 2, defaultBpm: 120, bars: [{ beats: [q('kick'), q('snare'), q('kick'), q('snare')] }, { beats: [q('kick'), q(), q(), q()] }] });

function rig() {
  let now = 10;
  let tick = null;
  const played = [];
  const clicked = [];
  const heads = [];
  let stopped = 0;
  const player = createPlayer({
    clock: () => now,
    play: (sound, when, velocity) => played.push({ sound, when: +when.toFixed(3), velocity }),
    click: (accent, when) => clicked.push({ accent, when: +when.toFixed(3) }),
    setInterval: (fn) => { tick = fn; return 1; },
    clearInterval: () => { tick = null; },
    onPlayhead: (p) => heads.push(p),
    onStop: () => { stopped += 1; },
  });
  const advance = (to) => { while (now < to - 1e-9) { now = Math.min(to, now + 0.025); tick?.(); } };
  return { player, played, clicked, heads, advance, get stopped() { return stopped; }, get running() { return tick !== null; } };
}

describe('player', () => {
  it('schedules every hit at its time on the audio clock', () => {
    const r = rig();
    r.player.start(performance(s, 0, 1), { bpm: 120 });
    r.advance(15);
    const t0 = r.played[0].when;
    expect(r.played.map((p) => [p.sound, +(p.when - t0).toFixed(3)])).toEqual([
      ['kick', 0], ['snare', 0.5], ['kick', 1], ['snare', 1.5], ['kick', 2],
    ]);
  });
  it('schedules only a little ahead, never the whole score at once', () => {
    const r = rig();
    r.player.start(performance(s, 0, 1), { bpm: 120 });
    expect(r.played.length).toBeLessThanOrEqual(1);
    r.advance(10.6);
    expect(r.played.length).toBeLessThan(5);
  });
  it('stops by itself at the end and says so', () => {
    const r = rig();
    r.player.start(performance(s, 0, 1), { bpm: 120 });
    r.advance(15);
    expect(r.stopped).toBe(1);
    expect(r.running).toBe(false);
  });
  it('loops until stopped', () => {
    const r = rig();
    r.player.start(performance(s, 0, 1), { bpm: 120, loop: true });
    r.advance(10 + 4 * 3 + 0.5);
    expect(r.played.filter((p) => p.sound === 'kick').length).toBeGreaterThanOrEqual(9);
    r.player.stop();
    const n = r.played.length;
    r.advance(30);
    expect(r.played.length).toBe(n);
    expect(r.stopped).toBe(1);
  });
  it('a count-in plays one bar of clicks before the first hit', () => {
    const r = rig();
    r.player.start(performance(s, 0, 1), { bpm: 120, countIn: true });
    r.advance(15);
    const first = r.played[0].when;
    const before = r.clicked.filter((c) => c.when < first - 1e-6);
    expect(before.length).toBe(4);
    expect(before[0].accent).toBe(true);
    expect(+(first - before[0].when).toFixed(3)).toBe(2);
  });
  it('the metronome clicks every beat when on, never when off', () => {
    const on = rig();
    on.player.start(performance(s, 0, 1), { bpm: 120, metronome: true });
    on.advance(15);
    expect(on.clicked.length).toBe(8);
    const off = rig();
    off.player.start(performance(s, 0, 1), { bpm: 120 });
    off.advance(15);
    expect(off.clicked.length).toBe(0);
  });
  it('reports the playhead as time passes, through empty beats too', () => {
    const r = rig();
    r.player.start(performance(s, 0, 1), { bpm: 120 });
    r.advance(15);
    const bars = [...new Set(r.heads.filter(Boolean).map((h) => `${h.bar}.${h.beat}`))];
    expect(bars).toEqual(['0.0', '0.1', '0.2', '0.3', '1.0', '1.1', '1.2', '1.3']);
    expect(r.heads[r.heads.length - 1]).toBe(null);
  });
  it('a grace note sounds just before its beat', () => {
    const g = decode({ schema_version: 2, defaultBpm: 120, bars: [{ beats: [q({ slot: 'snare', grace: 'flam' }), q(), q(), q()] }] });
    const r = rig();
    r.player.start(performance(g, 0, 0), { bpm: 120 });
    r.advance(15);
    expect(+(r.played[1].when - r.played[0].when).toFixed(3)).toBe(0.03);
  });
});
