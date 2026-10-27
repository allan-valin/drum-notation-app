import { leafSpans, isGroup, replaceAt } from './tree.js';
import { NOTE_VALUES } from './noteValue.js';
import { PPQ, beatTicks } from './ticks.js';
import { cellMarksOf } from './edit.js';

/**
 * Two voices on a drum staff, as drum grooves are written: hands with stems up, feet (and, on
 * the Rock Band key, the snare) with stems down.
 *
 * A bar stores them one of two ways. Same rhythm: one cell tree (`bar.beats`) and each note's
 * stem says its voice (`note.stem`, else the slot's default). Own rhythm: the upper voice in
 * `bar.beats`, the lower in `bar.lower`, a second tree of beats shaped by the same signature.
 * `normVoices` keeps every bar in the simplest of the two, so a split that ends up in the same
 * rhythm folds back into one tree.
 */

export function stemOf(n, staff) {
  return n.stem ?? staff.slots.find((s) => s.id === n.slotId)?.stem ?? 'up';
}

/** The note with this stem direction; the slot's own direction is not stored. */
export function withStem(n, dir, staff) {
  const { stem, ...rest } = n;
  const def = staff.slots.find((s) => s.id === n.slotId)?.stem ?? 'up';
  return dir === def ? rest : { ...rest, stem: dir };
}

const DIR = ['up', 'down'];

function mapLeaves(g, f) {
  return { ...g, cells: g.cells.map((c) => (isGroup(c) ? mapLeaves(c, f) : f(c))) };
}

/** Voice `v` (0 upper, 1 lower) of a bar as a list of beats. */
export function voiceBeats(bar, v, staff) {
  if (bar.lower) return v === 0 ? bar.beats : bar.lower;
  const dir = DIR[v];
  return bar.beats.map((b) => mapLeaves(b, (l) => {
    const notes = l.notes.filter((n) => stemOf(n, staff) === dir);
    // cell marks (dynamics, lyrics…) belong to the upper voice
    if (v === 0) return { ...l, notes };
    return l.cont ? { notes: [], cont: true } : { notes };
  }));
}

/** The score as the editor sees one voice: every bar's beats are that voice's tree. */
export function voiceView(score, v, staff) {
  return { ...score, bars: score.bars.map((b) => { const { lower, ...rest } = b; return { ...rest, beats: voiceBeats(b, v, staff) }; }) };
}

/** Write an edited voice view back: the other voice is kept, each bar normalised. */
export function zipVoice(score, v, view, staff) {
  return {
    ...view,
    bars: view.bars.map((vb, i) => {
      const orig = score.bars[i] ?? { beats: vb.beats };
      const up = v === 0 ? vb.beats : voiceBeats(orig, 0, staff);
      const down = v === 1 ? vb.beats : voiceBeats(orig, 1, staff);
      const { lower, ...rest } = vb;
      return normVoices({ ...rest, beats: forceStems(up, 'up', staff), lower: forceStems(down, 'down', staff) }, staff);
    }),
  };
}

function forceStems(beats, dir, staff) {
  return beats.map((b) => mapLeaves(b, (l) => ({ ...l, notes: l.notes.map((n) => withStem(n, dir, staff)) })));
}

function sameShape(a, b) {
  if (isGroup(a) !== isGroup(b)) return false;
  if (!isGroup(a)) return !!a.cont === !!b.cont;
  return a.division === b.division && (a.tuplet ?? null) === (b.tuplet ?? null) && a.cells.length === b.cells.length && a.cells.every((c, i) => sameShape(c, b.cells[i]));
}

function merge(a, b) {
  if (isGroup(a)) return { ...a, cells: a.cells.map((c, i) => merge(c, b.cells[i])) };
  if (a.cont) return { ...cellMarksOf(b), ...a };
  return { ...cellMarksOf(b), ...a, notes: [...a.notes, ...b.notes] };
}

const sounding = (beats) => beats.some((b) => leafSpans(b).some((l) => l.leaf.notes.length || l.leaf.cont));
const near = (x, y) => Math.abs(x - y) < 1e-9;

/**
 * The simplest storage for a bar: a note sitting in the wrong voice's tree moves to the other
 * voice's cell that starts at the same moment (if there is one), an empty lower voice goes
 * away, and two voices in the same rhythm become one tree again.
 */
export function normVoices(bar, staff) {
  if (!bar.lower) return bar;
  let beats = bar.beats;
  let lower = bar.lower;
  // notes whose stem names the other voice
  const moveOut = (from, to, dir) => {
    let src = from;
    let dst = to;
    from.forEach((b, bi) => leafSpans(b).forEach((l) => {
      const wrong = l.leaf.notes.filter((n) => stemOf(n, staff) !== dir);
      if (!wrong.length || !dst[bi]) return;
      const target = leafSpans(dst[bi]).find((x) => near(x.start, l.start) && !x.leaf.cont);
      if (!target) return; // nowhere to go at that moment: it stays, drawn with this voice
      src = src.map((x, k) => (k === bi ? replaceAt(x, l.path, (c) => ({ ...c, notes: c.notes.filter((n) => !wrong.includes(n)) })) : x));
      dst = dst.map((x, k) => (k === bi ? replaceAt(x, target.path, (c) => ({ ...c, notes: [...c.notes.filter((n) => !wrong.some((w) => w.slotId === n.slotId)), ...wrong] })) : x));
    }));
    return [src, dst];
  };
  [beats, lower] = moveOut(beats, lower, 'up');
  [lower, beats] = moveOut(lower, beats, 'down');
  const { lower: _, ...rest } = bar;
  if (!sounding(lower)) return { ...rest, beats };
  if (beats.length === lower.length && beats.every((b, i) => sameShape(b, lower[i]))) {
    return { ...rest, beats: beats.map((b, i) => merge(b, lower[i])) };
  }
  return { ...rest, beats, lower };
}

const ticksOf = (v) => (PPQ * 4) / v.divisionsPerWhole;
const isWritten = (t) => NOTE_VALUES.some((v) => ticksOf(v) === t || ticksOf(v) * 1.5 === t);
const hasTuplet = (g) => !!g.tuplet || g.cells.some((c) => isGroup(c) && hasTuplet(c));
const blank = (l) => !l.notes.length && !l.cont && Object.keys(cellMarksOf(l)).length === 0;

/**
 * Two voices in one rhythm: in each voice an empty cell right after a note (same beat) is drawn
 * as part of that note when together they make a written value, so a kick on every beat under
 * eighth notes on the hi-hat reads as quarter notes instead of eighths and eighth rests.
 */
function lengthen(beats, den) {
  const bt = beatTicks(den);
  return beats.map((b) => {
    if (hasTuplet(b)) return b;
    const spans = leafSpans(b);
    let out = b;
    for (let i = 0; i < spans.length; i++) {
      if (!spans[i].leaf.notes.length || spans[i].leaf.cont) continue;
      let take = 0;
      let total = spans[i].size * bt;
      for (let j = i + 1; j < spans.length && blank(spans[j].leaf); j++) {
        total += spans[j].size * bt;
        if (isWritten(Math.round(total))) take = j - i;
      }
      for (let k = 1; k <= take; k++) out = replaceAt(out, spans[i + k].path, () => ({ notes: [], cont: true }));
      i += take;
    }
    return out;
  });
}

/**
 * What the layout draws: one voice when every note points one way (its direction), two when
 * both directions are written or the bar has its own lower voice.
 */
export function layoutVoices(bar, staff, den = 4) {
  if (bar.lower) return [{ beats: bar.beats, dir: 'up' }, { beats: bar.lower, dir: 'down' }];
  const dirs = new Set(bar.beats.flatMap((b) => leafSpans(b).flatMap((l) => l.leaf.notes.map((n) => stemOf(n, staff)))));
  if (dirs.size < 2) return [{ beats: bar.beats, dir: dirs.has('down') ? 'down' : 'up' }];
  return [0, 1].map((v) => ({ beats: lengthen(voiceBeats(bar, v, staff), den), dir: DIR[v] }));
}
