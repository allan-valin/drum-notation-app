import { PPQ, beatTicks, leafTicks } from './ticks.js';
import { barTimeSig, Articulation, Mark, Roll, Grace } from './score.js';
import { Notehead, profileById } from './profile.js';
import { midiOf, frequencyOf } from './pitch.js';
import { partView } from './parts.js';

/** Seconds per tick at a tempo in quarter notes per minute. */
export function secondsPerTick(bpm) {
  return 60 / (bpm * PPQ);
}

/**
 * The bars of `a..b` in the order they are played. `||: … :||` plays twice; an end repeat
 * with no start goes back to the start of the range. A repeat cut by the range plays once.
 */
export function playOrder(score, a, b) {
  const order = [];
  const done = new Set();
  let start = a;
  let i = a;
  while (i <= b) {
    const bar = score.bars[i];
    if (bar.repeatStart) start = i;
    order.push(i);
    if (bar.repeatEnd && !done.has(i)) {
      done.add(i);
      i = start;
      continue;
    }
    if (bar.repeatEnd) start = i + 1;
    i += 1;
  }
  return order;
}

/** The sound a note makes on a given instrument, changed by its head and technique marks. */
export function soundFor(note, instrument = 'drums') {
  if (instrument === 'congas') {
    const base = { quinto: 'congaHigh', conga: 'congaMid', tumba: 'congaLow' }[note.slotId] ?? 'congaMid';
    if (note.head === Notehead.CROSS) return base.replace('conga', 'congaSlap');
    if ((note.marks ?? []).includes(Mark.CLOSED)) return base.replace('conga', 'congaMute');
    return base;
  }
  return drumSound(note);
}

function drumSound(note) {
  const marks = note.marks ?? [];
  if (note.head === Notehead.TRIANGLE) return 'cowbell';
  if (note.head === Notehead.CIRCLE_X) return 'china';
  switch (note.slotId) {
    case 'hihat':
      if (note.head === Notehead.DIAMOND) return 'rideBell';
      if (marks.includes(Mark.OPEN)) return 'hihatOpen';
      if (marks.includes(Mark.HALF_OPEN)) return 'hihatHalf';
      return 'hihatClosed';
    case 'hihatPedal': return 'hihatPedal';
    case 'ride': return note.head === Notehead.DIAMOND ? 'rideBell' : 'ride';
    case 'crash':
      if (marks.includes(Mark.CHOKE)) return 'crashChoke';
      return note.head === Notehead.DIAMOND ? 'rideBell' : 'crash';
    case 'snare':
      if (note.head === Notehead.CROSS) return 'crossStick';
      if (note.head === Notehead.SLASHED) return 'rimshot';
      return 'snare';
    default: return note.slotId;
  }
}

const BASE = 0.75;

function velocityOf(note) {
  if (note.articulations.includes(Articulation.ACCENT)) return 1;
  if (note.articulations.includes(Articulation.GHOST)) return 0.3;
  return BASE;
}

/**
 * Everything needed to play bars `a..b`: hits (with tick, sound, loudness and where they are
 * in the score, for the playhead), one metronome click per beat, and the total length. Pure.
 */
export function performance(score, a, b, instrument = score.profileId ?? 'drums') {
  const hits = [];
  const clicks = [];
  let offset = 0;
  for (const shown of playOrder(score, a, b)) {
    let src = shown;
    while (src > 0 && score.bars[src].simile) src -= 1;
    const [num, den] = barTimeSig(score, shown);
    const bt = beatTicks(den);
    const bar = score.bars[src];
    const profile = profileById(instrument);
    const pitchedStaff = profile.staves[0].pitched ? profile.staves[0] : null;
    for (let beat = 0; beat < num; beat++) {
      clicks.push({ tick: offset + beat * bt, accent: beat === 0, bar: shown, beat });
      const group = bar.beats[beat];
      if (!group) continue;
      for (const leaf of leafTicks(group, den)) {
        const at = offset + beat * bt + leaf.tick;
        for (const note of leaf.leaf.notes) {
          if (pitchedStaff) {
            // a pitched note: its own voice, at its frequency, for its written length
            const freq = frequencyOf(midiOf(note, { clef: pitchedStaff.clef, transpose: profile.transpose }));
            hits.push({ bar: shown, beat, path: leaf.path, slotId: note.slotId, sound: `voice:${profile.voice}`, freq, length: leaf.length, tick: at, ahead: 0, velocity: velocityOf(note) });
            continue;
          }
          const where = { bar: shown, beat, path: leaf.path, slotId: note.slotId, sound: soundFor(note, instrument) };
          const velocity = velocityOf(note);
          if (note.grace === Grace.FLAM) hits.push({ ...where, tick: at, ahead: 0.03, velocity: 0.35, grace: true });
          if (note.grace === Grace.DRAG) {
            hits.push({ ...where, tick: at, ahead: 0.06, velocity: 0.3, grace: true });
            hits.push({ ...where, tick: at, ahead: 0.03, velocity: 0.3, grace: true });
          }
          if (note.roll) {
            const step = note.roll === Roll.BUZZ ? PPQ / 12 : PPQ / 8;
            const count = Math.max(2, Math.round(leaf.length / step));
            for (let k = 0; k < count; k++) {
              hits.push({ ...where, tick: at + Math.round(k * step), ahead: 0, velocity: velocity * (note.roll === Roll.BUZZ ? 0.45 : 0.8), roll: true });
            }
          } else {
            hits.push({ ...where, tick: at, ahead: 0, velocity });
          }
        }
      }
    }
    offset += num * bt;
  }
  hits.sort((x, y) => x.tick - y.tick || y.ahead - x.ahead);
  return { hits, clicks, totalTicks: offset, firstBarBeats: barTimeSig(score, a)[0], firstBarUnit: barTimeSig(score, a)[1] };
}

/**
 * Every unmuted part of a full score, mixed: hits from each part (tagged with `part`), one set
 * of metronome clicks. The playhead follows whichever part is being edited, so hits keep
 * their bar, beat and path.
 */
export function performanceAll(full, a, b) {
  const playing = full.parts.filter((p) => !p.muted);
  const base = performance(partView(full, full.parts[0].id), a, b);
  const hits = playing.flatMap((p) => performance(partView(full, p.id), a, b, p.instrument).hits.map((h) => ({ ...h, part: p.id })));
  hits.sort((x, y) => x.tick - y.tick || y.ahead - x.ahead);
  return { ...base, hits };
}
