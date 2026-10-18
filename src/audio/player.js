import { secondsPerTick } from '../core/schedule.js';
import { beatTicks } from '../core/ticks.js';

const LOOKAHEAD = 0.15; // seconds of audio scheduled ahead of the clock
const INTERVAL = 25;    // ms between scheduler runs
const LEAD_IN = 0.1;    // seconds between pressing play and the first sound

/**
 * Plays a `performance()` against an audio clock. Hits are handed to `play` a little before
 * they are due (the standard look-ahead pattern), so timing stays tight even when the page is
 * busy. `clock`, `play`, `click` and the timer are injected: the browser passes the
 * AudioContext and the synth kit, tests pass a fake clock.
 */
export function createPlayer({ clock, play, click, setInterval: every = globalThis.setInterval, clearInterval: cancel = globalThis.clearInterval, onPlayhead = () => {}, onStop = () => {} }) {
  let timer = null;
  let run = null;

  function stop(silent = false) {
    if (timer !== null) cancel(timer);
    timer = null;
    const was = run;
    run = null;
    if (was) {
      onPlayhead(null);
      if (!silent) onStop();
    }
  }

  function start(perf, { bpm, loop = false, countIn = false, metronome = false } = {}) {
    stop(true);
    if (perf.totalTicks <= 0) { onStop(); return; }
    const spt = secondsPerTick(bpm);
    const countInBeats = countIn ? perf.firstBarBeats : 0;
    const countInBeat = beatTicks(perf.firstBarUnit) * spt;
    const t0 = clock() + LEAD_IN + countInBeats * countInBeat;
    const events = [
      ...perf.hits.map((h) => ({ kind: 'hit', at: h.tick * spt - h.ahead, h })),
      ...(metronome ? perf.clicks.map((c) => ({ kind: 'click', at: c.tick * spt, c })) : []),
    ].sort((a, b) => a.at - b.at);
    const marks = perf.clicks.map((c) => ({ at: c.tick * spt, bar: c.bar, beat: c.beat, path: null }))
      .concat(perf.hits.filter((h) => !h.grace).map((h) => ({ at: h.tick * spt, bar: h.bar, beat: h.beat, path: h.path })))
      .sort((a, b) => a.at - b.at);
    const cycle = perf.totalTicks * spt;
    run = { events, marks, cycle, t0, loop, spt, index: 0, mark: 0, round: 0, last: null };

    for (let k = 0; k < countInBeats; k++) click(k === 0, t0 - (countInBeats - k) * countInBeat);
    timer = every(pump, INTERVAL);
    pump();
  }

  function pump() {
    if (!run) return;
    const now = clock();
    const horizon = now + LOOKAHEAD;
    for (;;) {
      if (run.index >= run.events.length) {
        if (!run.loop) break;
        run.index = 0;
        run.round += 1;
        if (run.events.length === 0) break;
      }
      const e = run.events[run.index];
      const when = run.t0 + run.round * run.cycle + e.at;
      if (when > horizon) break;
      if (e.kind === 'hit') play(e.h.sound, when, e.h.velocity, { freq: e.h.freq, dur: (e.h.length ?? 0) * run.spt });
      else click(e.c.accent, when);
      run.index += 1;
    }
    // playhead: the latest mark whose time has come, in whichever round the clock is in
    const elapsed = now - run.t0;
    if (elapsed >= 0) {
      const round = Math.floor(elapsed / run.cycle);
      const inRound = elapsed - round * run.cycle;
      if (!run.loop && round >= 1) { stop(); return; }
      let current = null;
      for (const m of run.marks) { if (m.at <= inRound + 1e-9) current = m; else break; }
      const key = current && `${round}:${current.bar}:${current.beat}:${current.path?.join('.')}`;
      if (current && key !== run.last) { run.last = key; onPlayhead({ bar: current.bar, beat: current.beat, path: current.path }); }
    }
  }

  return {
    start,
    stop: () => stop(false),
    get playing() { return run !== null; },
  };
}
