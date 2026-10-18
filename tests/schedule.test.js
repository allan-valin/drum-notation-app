import { describe, it, expect } from 'vitest';
import { decode } from '../src/core/json.js';
import { playOrder, performance, secondsPerTick, soundFor } from '../src/core/schedule.js';
import { PPQ } from '../src/core/ticks.js';
import { note, Mark, Grace, Roll } from '../src/core/score.js';
import { Notehead } from '../src/core/profile.js';

const q = (...slots) => ({ division: 'quarter', cells: [slots] });
const eighthHats = () => ({ division: 'eighth', cells: [['hihat'], ['hihat']] });
const score = (bars, extra = {}) => decode({ schema_version: 2, title: 't', defaultBpm: 120, bars, ...extra });
const plainBar = (slot = 'snare', more = {}) => ({ beats: [q(slot), q(), q(), q()], ...more });

describe('play order', () => {
  it('plays bars in order', () => {
    const s = score([plainBar(), plainBar(), plainBar()]);
    expect(playOrder(s, 0, 2)).toEqual([0, 1, 2]);
  });
  it('a repeat section plays twice', () => {
    const s = score([plainBar(), plainBar('kick', { repeatStart: true }), plainBar('kick', { repeatEnd: true }), plainBar()]);
    expect(playOrder(s, 0, 3)).toEqual([0, 1, 2, 1, 2, 3]);
  });
  it('an end repeat without a start goes back to the beginning', () => {
    const s = score([plainBar(), plainBar('kick', { repeatEnd: true }), plainBar()]);
    expect(playOrder(s, 0, 2)).toEqual([0, 1, 0, 1, 2]);
  });
  it('a range that starts inside a section repeats from the range start', () => {
    const s = score([plainBar('kick', { repeatStart: true }), plainBar(), plainBar('kick', { repeatEnd: true })]);
    expect(playOrder(s, 1, 2)).toEqual([1, 2, 1, 2]);
  });
  it('a range that ends before the end repeat plays once', () => {
    const s = score([plainBar('kick', { repeatStart: true }), plainBar(), plainBar('kick', { repeatEnd: true })]);
    expect(playOrder(s, 0, 1)).toEqual([0, 1]);
  });
});

describe('performance', () => {
  it('a 4/4 bar of eighth hats at 120 BPM: eight hits a quarter of a second apart', () => {
    const s = score([{ beats: [eighthHats(), eighthHats(), eighthHats(), eighthHats()] }]);
    const p = performance(s, 0, 0);
    expect(p.hits.length).toBe(8);
    const spt = secondsPerTick(120);
    expect(p.hits.map((h) => +(h.tick * spt).toFixed(3))).toEqual([0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75]);
    expect(p.totalTicks).toBe(4 * PPQ);
  });
  it('a % bar plays the bar before it, and is reported as itself', () => {
    const s = score([plainBar('kick'), { ...plainBar('snare'), simile: true }]);
    const p = performance(s, 0, 1);
    expect(p.hits.map((h) => [h.bar, h.slotId])).toEqual([[0, 'kick'], [1, 'kick']]);
  });
  it('two % bars in a row both repeat the last written bar', () => {
    const s = score([plainBar('kick'), { ...plainBar(), simile: true }, { ...plainBar(), simile: true }]);
    expect(performance(s, 0, 2).hits.map((h) => h.slotId)).toEqual(['kick', 'kick', 'kick']);
  });
  it('a repeat doubles the hits and the length', () => {
    const s = score([plainBar('kick', { repeatStart: true, repeatEnd: true })]);
    const p = performance(s, 0, 0);
    expect(p.hits.length).toBe(2);
    expect(p.totalTicks).toBe(8 * PPQ);
    expect(p.hits[1].tick).toBe(4 * PPQ);
  });
  it('bars with different signatures add up their own lengths', () => {
    const s = score([plainBar(), { timeSig: [3, 4], beats: [q('kick'), q(), q()] }]);
    const p = performance(s, 0, 1);
    expect(p.totalTicks).toBe(7 * PPQ);
    expect(p.hits[1].tick).toBe(4 * PPQ);
  });
  it('accent is louder and ghost softer than a plain hit', () => {
    const s = score([{ beats: [q({ slot: 'snare', articulations: ['accent'] }), q('snare'), q({ slot: 'snare', articulations: ['ghost'] }), q()] }]);
    const [a, n, g] = performance(s, 0, 0).hits.map((h) => h.velocity);
    expect(a).toBeGreaterThan(n);
    expect(g).toBeLessThan(n);
  });
  it('a flam adds one soft hit just before, a drag two', () => {
    const s = score([{ beats: [q({ slot: 'snare', grace: 'flam' }), q({ slot: 'snare', grace: 'drag' }), q(), q()] }]);
    const hits = performance(s, 0, 0).hits;
    const graces = hits.filter((h) => h.grace);
    expect(graces.length).toBe(3);
    graces.forEach((h) => { expect(h.ahead).toBeGreaterThan(0); expect(h.velocity).toBeLessThan(0.5); });
  });
  it('a buzz roll fills the note with many quiet strokes', () => {
    const s = score([{ beats: [q({ slot: 'snare', roll: 'buzz' }), q(), q(), q()] }]);
    const hits = performance(s, 0, 0).hits.filter((h) => h.slotId === 'snare');
    expect(hits.length).toBeGreaterThanOrEqual(6);
    expect(hits[hits.length - 1].tick).toBeLessThan(PPQ);
  });
  it('one click per beat, the first of each bar accented', () => {
    const s = score([plainBar(), { timeSig: [3, 4], beats: [q(), q(), q()] }]);
    const clicks = performance(s, 0, 1).clicks;
    expect(clicks.map((c) => c.tick / PPQ)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(clicks.filter((c) => c.accent).map((c) => c.tick / PPQ)).toEqual([0, 4]);
  });
  it('every hit knows its bar, beat and cell, for the playhead', () => {
    const s = score([{ beats: [eighthHats(), q(), q(), q()] }]);
    expect(performance(s, 0, 0).hits[1]).toMatchObject({ bar: 0, beat: 0, path: [1] });
  });
});

describe('which sound a note makes', () => {
  it('follows heads and marks', () => {
    expect(soundFor(note('hihat'))).toBe('hihatClosed');
    expect(soundFor(note('hihat', { marks: [Mark.OPEN] }))).toBe('hihatOpen');
    expect(soundFor(note('hihat', { marks: [Mark.HALF_OPEN] }))).toBe('hihatHalf');
    expect(soundFor(note('hihatPedal'))).toBe('hihatPedal');
    expect(soundFor(note('ride', { head: Notehead.DIAMOND }))).toBe('rideBell');
    expect(soundFor(note('crash', { marks: [Mark.CHOKE] }))).toBe('crashChoke');
    expect(soundFor(note('crash', { head: Notehead.CIRCLE_X }))).toBe('china');
    expect(soundFor(note('snare', { head: Notehead.CROSS }))).toBe('crossStick');
    expect(soundFor(note('snare', { head: Notehead.SLASHED }))).toBe('rimshot');
    expect(soundFor(note('midTom', { head: Notehead.TRIANGLE }))).toBe('cowbell');
    expect(soundFor(note('kick'))).toBe('kick');
  });
});
