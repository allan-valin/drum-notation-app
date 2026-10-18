import { PPQ, beatTicks, leafTicks } from './ticks.js';
import { barTimeSig, Articulation, Mark, Roll, Grace } from './score.js';
import { Notehead, profileById } from './profile.js';
import { midiOf, frequencyOf } from './pitch.js';
import { parseChord, chordMidis } from './chords.js';
import { partView } from './parts.js';

/** Seconds per tick at a tempo in quarter notes per minute. */
export function secondsPerTick(bpm) {
  return 60 / (bpm * PPQ);
}

/**
 * The bars of `a..b` in the order they are played. `||: … :||` plays twice; an end repeat
 * with no start goes back to the start of the range. A repeat cut by the range plays once.
 */
/**
 * Swing: an eighth on the off-beat moves to the last third of the beat (triplet feel), and the
 * on-beat eighth before it lengthens to match. Quarter-note beats only.
 */
function swingIt(hits) {
  const half = PPQ / 2;
  for (const h of hits) {
    const inBeat = h.tick % PPQ;
    if (inBeat === half) {
      h.tick += PPQ / 6;
      if (h.length === half) h.length = PPQ / 3;
    } else if (inBeat === 0 && h.length === half) {
      h.length = (2 * PPQ) / 3;
    }
  }
}

const LEVEL = { pp: 0.35, p: 0.48, mp: 0.62, mf: 0.75, f: 0.88, ff: 1, fp: 0.48, sfz: null };

/**
 * Loudness from the marks: a level holds from one dynamic to the next (mf before any); cresc.
 * and dim. ramp toward the next dynamic (or a step up/down if none follows); sfz and fp make
 * the hits at their moment loud. Each hit's own weight (accent, ghost, roll, grace) scales.
 */
function applyDynamics(hits, marks, end) {
  if (!marks.length) return;
  const levelAt = (tick) => {
    let level = LEVEL.mf;
    let ramp = null;
    for (let k = 0; k < marks.length && marks[k].tick <= tick; k++) {
      const m = marks[k];
      if (m.dyn && LEVEL[m.dyn] !== null) level = LEVEL[m.dyn];
      if (m.wedge) {
        const next = marks.slice(k + 1).find((x) => x.dyn && LEVEL[x.dyn] !== null);
        const target = next ? LEVEL[next.dyn] : Math.max(0.3, Math.min(1, level + (m.wedge === 'cresc' ? 0.25 : -0.25)));
        ramp = { from: m.tick, to: next ? next.tick : end, a: level, b: target };
      } else if (m.dyn) ramp = null;
    }
    if (ramp && tick < ramp.to) return ramp.a + (ramp.b - ramp.a) * ((tick - ramp.from) / (ramp.to - ramp.from || 1));
    return ramp ? ramp.b : level;
  };
  const accentAt = new Set(marks.filter((m) => m.dyn === 'sfz' || m.dyn === 'fp').map((m) => m.tick));
  for (const h of hits) {
    if (accentAt.has(h.tick) && !h.grace) { h.velocity = 1; continue; }
    h.velocity = Math.min(1, h.velocity * (levelAt(h.tick) / LEVEL.mf));
  }
}

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
  if (instrument === 'taiko') return { don: 'taikoDon', tsu: 'taikoTsu', ka: 'taikoKa' }[note.slotId] ?? 'taikoDon';
  if (['darbuka', 'riq', 'daf'].includes(instrument)) {
    return `${instrument}${{ dum: 'Dum', tak: 'Tak', ka: 'Ka' }[note.slotId] ?? 'Tak'}`;
  }
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
  let open = []; // pitched notes still sounding, lengthened by continuation cells
  const marks = []; // { tick, dyn?, wedge? } in played order, for loudness
  let chord = null; // the chord symbol in force, for rhythm slashes
  let repeating = []; // trills and tremolos still going: held cells keep repeating them
  const pedals = []; // { tick, kind } in played order
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
        if (leaf.leaf.dyn || leaf.leaf.wedge) marks.push({ tick: at, dyn: leaf.leaf.dyn, wedge: leaf.leaf.wedge });
        if (leaf.leaf.chord) chord = parseChord(leaf.leaf.chord);
        if (leaf.leaf.ped) pedals.push({ tick: at, kind: leaf.leaf.ped });
        if (pitchedStaff) {
          if (leaf.leaf.cont) {
            open.forEach((h) => { h.length += leaf.length; });
            repeating.forEach((r) => r.emit(at, leaf.length, shown, beat, leaf.path));
            continue;
          }
          open = [];
          repeating = [];
        }
        for (const note of leaf.leaf.notes) {
          if (pitchedStaff && note.head === 'slash') {
            // a rhythm slash: the chord symbol in force, voiced for the instrument, in this rhythm
            if (!chord) continue;
            const midis = chordMidis(chord, { centre: profile.voice === 'guitar' ? 57 : 60, bassOnly: profile.voice === 'bass' || profile.voice === 'upright' });
            for (const m of midis) {
              const hit = { bar: shown, beat, path: leaf.path, slotId: note.slotId, sound: `voice:${profile.voice}`, freq: frequencyOf(m), length: leaf.length, tick: at, ahead: 0, velocity: velocityOf(note) * 0.8 };
              hits.push(hit);
              open.push(hit);
            }
            continue;
          }
          if (pitchedStaff) {
            // a pitched note: its own voice, at its frequency, for its written length
            const freq = frequencyOf(midiOf(note, { clef: pitchedStaff.clef, transpose: profile.transpose }));
            const marksOf = note.marks ?? [];
            const bend = marksOf.find((m) => ['fall', 'doit', 'scoop', 'plop'].includes(m)) ?? null;
            // strings: pizz. plucks, a harmonic sounds an octave up with a flute-like tone
            let voice = profile.voice;
            let f = freq;
            if (marksOf.includes('pizz')) voice = 'pizz';
            if (marksOf.includes('harmonic')) { voice = 'harmonic'; f = freq * 2; }
            const sound = `voice:${voice}`;
            if (marksOf.includes('trill') || note.roll === 'tremolo') {
              // trill: alternate with a tone above; tremolo: repeat the note; 32nds either way
              const step = PPQ / 8;
              const trill = marksOf.includes('trill');
              let k = 0;
              const r = {
                emit: (from, length, barShown, beatIndex, path) => {
                  const count = Math.max(1, Math.round(length / step));
                  for (let j = 0; j < count; j++, k++) {
                    const up = trill && k % 2 === 1;
                    hits.push({ bar: barShown, beat: beatIndex, path, slotId: note.slotId, sound, freq: up ? f * 2 ** (2 / 12) : f, length: step, tick: from + Math.round(j * step), ahead: 0, velocity: velocityOf(note) * 0.85 });
                  }
                },
              };
              r.emit(at, leaf.length, shown, beat, leaf.path);
              repeating.push(r);
              continue;
            }
            // let ring: at least three beats
            const ring = marksOf.includes('lv') ? 3 * PPQ : 0;
            const hit = { bar: shown, beat, path: leaf.path, slotId: note.slotId, sound, freq: f, length: Math.max(leaf.length, ring), tick: at, ahead: 0, velocity: velocityOf(note), ...(bend ? { bend } : {}) };
            hits.push(hit);
            open.push(hit);
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
  // sustain pedal: a note played while it is down sounds until it comes up (or the end)
  for (let k = 0; k < pedals.length; k++) {
    if (pedals[k].kind !== 'down') continue;
    const up = pedals.slice(k + 1).find((x) => x.kind === 'up');
    const end = up ? up.tick : offset;
    for (const h of hits) if (h.freq && h.tick >= pedals[k].tick && h.tick < end) h.length = Math.max(h.length, end - h.tick);
  }
  if (score.swing) swingIt(hits);
  hits.sort((x, y) => x.tick - y.tick || y.ahead - x.ahead);
  applyDynamics(hits, marks, offset);
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
