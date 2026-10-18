import { Glyphs, Metrics } from './glyphs.js';
import { NoteValue } from './noteValue.js';
import { Articulation, Mark, Roll, Grace } from './score.js';
import { slotById } from './profile.js';
import { beams as beamsOf, beamLevel } from './beaming.js';
import { leafSpans, groupSpans } from './tree.js';
import { parseSlot, keyAlter } from './pitch.js';

/** Vertical centre of a staff position, measured down from the top line; 0 is the bottom line. */
export function yOf(staffPosition, spacing) {
  return (4 - staffPosition * 0.5) * spacing;
}

/** The inverse of `yOf`, rounded to the nearest half-step. How a tap height becomes a slot. */
export function staffPositionAt(y, spacing) {
  return Math.round((4 - y / spacing) * 2);
}

/**
 * Turn a bar into glyphs and positions. Pure: no DOM, no SVG, so the whole of engraving is
 * unit-testable, and the print page reuses it unchanged.
 *
 * Glyph `x` is the glyph origin (left edge for noteheads). Noteheads carry `beat`, `cell`
 * (leaf index in the beat), `path`, `slotId` and `value`, so taps trace back and colours apply.
 * `leaves` lists every leaf's horizontal span for hit-testing. `focusedBeat` gets `focusScale`
 * times the width of an ordinary beat, so one beat is big enough to edit on a phone.
 */
export function layoutBar(bar, staff, config) {
  const sp = config.staffSpacing;
  const focusScale = config.focusScale ?? 2.5;
  const glyphs = [];
  const stems = [];
  const beams = [];
  const texts = [];
  const beatBounds = [];
  const leaves = [];
  const headW = Metrics.noteheadWidth * sp;
  const lead = bar.repeatStart ? 1.8 * sp : 0;
  const tail = bar.repeatEnd ? 1.8 * sp : 0;
  const inner = config.width - lead - tail;
  const weights = bar.beats.map((_, i) => (i === config.focusedBeat ? focusScale : 1));
  const unit = inner / weights.reduce((a, b) => a + b, 0);
  let x = lead;

  if (bar.repeatStart) glyphs.push({ kind: 'barline', glyph: Glyphs.REPEAT_LEFT, x: 0, y: yOf(0, sp) });
  const pitched = !!staff.pitched;
  const key = config.key ?? 0;
  // the alteration in force for each written position so far in this bar (accidentals carry)
  const inForce = new Map();

  bar.beats.forEach((beat, beatIndex) => {
    const beatWidth = unit * weights[beatIndex];
    beatBounds.push([x, x + beatWidth]);
    const spans = leafSpans(beat);
    spans.forEach((l, i) => leaves.push({ beat: beatIndex, index: i, path: l.path, x0: x + l.start * beatWidth, x1: x + (l.start + l.size) * beatWidth }));
    if (bar.simile) { x += beatWidth; return; }

    const centreX = (i) => x + (spans[i].start + spans[i].size / 2) * beatWidth;
    const headX = (i) => centreX(i) - headW / 2;
    const valueOf = (i) => spans[i].parent.division;
    const posOf = (n) => slotById(staff, n.slotId).staffPosition;
    const topOf = (i) => Math.min(...spans[i].leaf.notes.map((n) => yOf(posOf(n), sp)));
    const bottomOf = (i) => Math.max(...spans[i].leaf.notes.map((n) => yOf(posOf(n), sp)));

    const beatBeams = beamsOf(beat);
    const hosts = beatBeams.filter((b) => b.level === 1);
    const hostOf = (i) => hosts.find((h) => i >= h.from && i <= h.to);
    /**
     * Drums: stems always up. Pitched: a beamed group (or a lone note) stems down when its notes
     * sit, on average, on the middle line or above, the usual engraving rule.
     */
    const dirOf = (i) => {
      if (!pitched) return 'up';
      const h = hostOf(i);
      const [a, b] = h && h.from !== h.to ? [h.from, h.to] : [i, i];
      const ps = [];
      for (let k = a; k <= b; k++) ps.push(...spans[k].leaf.notes.map(posOf));
      return ps.length && ps.reduce((m, v) => m + v, 0) / ps.length >= 4 ? 'down' : 'up';
    };
    const stemX = (i) => (dirOf(i) === 'down'
      ? headX(i) + (Metrics.stemThickness * sp) / 2
      : headX(i) + Metrics.stemUpSE.x * sp - (Metrics.stemThickness * sp) / 2);
    const beamY = new Map();
    hosts.forEach((h) => {
      const down = dirOf(h.from) === 'down';
      let edge = down ? -Infinity : Infinity;
      for (let i = h.from; i <= h.to; i++) {
        if (!spans[i].leaf.notes.length) continue;
        edge = down ? Math.max(edge, bottomOf(i)) : Math.min(edge, topOf(i));
      }
      beamY.set(h, down ? edge + Metrics.stemLength * sp : edge - Metrics.stemLength * sp);
    });

    spans.forEach((span, i) => {
      const value = valueOf(i);
      const notes = span.leaf.notes;
      const base = { beat: beatIndex, cell: i, path: span.path, value };
      if (notes.length === 0) {
        const restY = value === NoteValue.WHOLE ? sp : 2 * sp;
        glyphs.push({ ...base, kind: 'rest', glyph: Glyphs.rest(value), x: centreX(i) - 0.5 * sp, y: restY });
        return;
      }
      let topY = Infinity;
      let bottomY = -Infinity;
      const dir = dirOf(i);
      // a chord with notes a step apart: every second head of a cluster goes to the other side of the stem
      const order = [...notes].sort((p, q) => posOf(p) - posOf(q));
      const shifted = new Set();
      for (let k = 1; k < order.length; k++) {
        if (posOf(order[k]) - posOf(order[k - 1]) === 1 && !shifted.has(order[k - 1])) shifted.add(dir === 'up' ? order[k] : order[k - 1]);
      }
      let accidentalColumn = 0;
      [...order].reverse().forEach((n) => {
        if (!pitched) return;
        const { step } = parseSlot(n.slotId);
        const sounding = n.alter ?? keyAlter(key, step);
        const before = inForce.has(n.slotId) ? inForce.get(n.slotId) : keyAlter(key, step);
        inForce.set(n.slotId, sounding);
        if (sounding === before) return;
        const extra = shifted.has(n) && dir === 'down' ? headW : 0;
        glyphs.push({ ...base, kind: 'accidental', glyph: Glyphs.accidental(sounding), x: headX(i) - extra - (1.25 + 1.1 * accidentalColumn) * sp, y: yOf(posOf(n), sp), slotRef: n.slotId });
        accidentalColumn = (accidentalColumn + 1) % 3;
      });
      notes.forEach((n) => {
        const slot = slotById(staff, n.slotId);
        const y = yOf(slot.staffPosition, sp);
        topY = Math.min(topY, y);
        bottomY = Math.max(bottomY, y);
        const dx = shifted.has(n) ? (dir === 'up' ? headW - Metrics.stemThickness * sp : -(headW - Metrics.stemThickness * sp)) : 0;
        glyphs.push({ ...base, kind: 'note', glyph: Glyphs.notehead(n.head ?? slot.notehead, value), x: headX(i) + dx, y, slotId: slot.id, staffPosition: slot.staffPosition });
        if (n.grace === Grace.FLAM) glyphs.push({ ...base, kind: 'grace', glyph: Glyphs.GRACE_SLASH, x: headX(i) - 1.9 * sp, y, slotRef: slot.id });
        if (n.grace === Grace.DRAG) {
          glyphs.push({ ...base, kind: 'grace', glyph: Glyphs.GRACE, x: headX(i) - 3.2 * sp, y, slotRef: slot.id });
          glyphs.push({ ...base, kind: 'grace', glyph: Glyphs.GRACE, x: headX(i) - 1.8 * sp, y, slotRef: slot.id });
        }
        if (n.articulations.includes(Articulation.GHOST)) {
          glyphs.push({ ...base, kind: 'paren', glyph: Glyphs.PAREN_LEFT, x: headX(i) - 0.5 * sp, y, slotRef: slot.id });
          glyphs.push({ ...base, kind: 'paren', glyph: Glyphs.PAREN_RIGHT, x: headX(i) + headW + 0.1 * sp, y, slotRef: slot.id });
        }
      });
      const host = hostOf(i);
      const beamed = host && host.from !== host.to;
      const down = dir === 'down';
      const stemEnd = beamed ? beamY.get(host) : down ? bottomY + Metrics.stemLength * sp : topY - Metrics.stemLength * sp;
      const stemTop = down ? topY : stemEnd;
      if (value !== NoteValue.WHOLE) {
        stems.push(down
          ? { x: stemX(i), y1: topY + Metrics.stemUpSE.y * sp, y2: stemEnd, beat: beatIndex, cell: i, value, dir }
          : { x: stemX(i), y1: bottomY - Metrics.stemUpSE.y * sp, y2: stemEnd, beat: beatIndex, cell: i, value, dir });
      }
      if (!beamed && beamLevel(value) > 0) {
        glyphs.push({ ...base, kind: 'flag', glyph: Glyphs.flag(value, dir), x: stemX(i) - (Metrics.stemThickness * sp) / 2, y: stemEnd });
      }
      if (pitched) {
        // articulations on the notehead side, away from the stem; fermata always above the staff
        let y = down ? topY - 1.1 * sp : bottomY + 1.1 * sp;
        for (const a of ['staccato', 'tenuto', 'accent', 'marcato']) {
          if (!notes.some((n) => n.articulations.includes(a))) continue;
          glyphs.push({ ...base, kind: 'artic', glyph: Glyphs.artic(a, down), x: centreX(i) - 0.5 * sp, y: down ? y : y + 0.3 * sp });
          y += down ? -1.0 * sp : 1.0 * sp;
        }
        if (notes.some((n) => n.articulations.includes(Articulation.FERMATA))) {
          glyphs.push({ ...base, kind: 'artic', glyph: Glyphs.FERMATA, x: centreX(i) - 1.2 * sp, y: Math.min(-1 * sp, topY - 2.5 * sp, stemTop - 1.2 * sp) });
        }
      }
      let markY = stemTop - 0.5 * sp;
      if (!pitched && notes.some((n) => n.articulations.includes(Articulation.ACCENT))) {
        glyphs.push({ ...base, kind: 'accent', glyph: Glyphs.ACCENT, x: centreX(i) - 0.68 * sp, y: markY });
        markY -= 1.3 * sp;
      }
      const MARK_GLYPH = { [Mark.OPEN]: Glyphs.OPEN, [Mark.CLOSED]: Glyphs.CLOSED, [Mark.HALF_OPEN]: Glyphs.HALF_OPEN, [Mark.CHOKE]: Glyphs.CHOKE };
      for (const m of new Set(notes.flatMap((n) => n.marks ?? []))) {
        glyphs.push({ ...base, kind: 'mark', glyph: MARK_GLYPH[m], x: centreX(i) - 0.6 * sp, y: markY });
        markY -= 1.5 * sp;
      }
      const roll = notes.map((n) => n.roll).find((r) => r);
      if (roll && value !== NoteValue.WHOLE) {
        const mid = (bottomY - Metrics.stemUpSE.y * sp + stemTop) / 2;
        if (roll === Roll.BUZZ) glyphs.push({ ...base, kind: 'roll', glyph: Glyphs.BUZZ, x: stemX(i), y: mid + 1.0 * sp });
        else glyphs.push({ ...base, kind: 'roll', glyph: Glyphs.TREMOLO3, x: stemX(i) - 0.6 * sp, y: mid });
      }
      const sticking = notes.map((n) => n.sticking).find((s) => s);
      if (sticking) texts.push({ kind: 'sticking', text: sticking, x: centreX(i), y: yOf(-6, sp), beat: beatIndex, cell: i });
    });

    const stemHalf = (Metrics.stemThickness * sp) / 2;
    const stub = 1.1 * sp;
    beatBeams.forEach((b) => {
      const host = b.level === 1 ? b : hostOf(b.from);
      const step = (b.level - 1) * (Metrics.beamThickness + Metrics.beamSpacing) * sp;
      const y = dirOf(b.from) === 'down'
        ? beamY.get(host) - Metrics.beamThickness * sp - step
        : beamY.get(host) + step;
      let x1 = stemX(b.from) - stemHalf;
      let x2 = stemX(b.to) + stemHalf;
      if (b.stub === 'left') x1 = x2 - stub;
      if (b.stub === 'right') x2 = x1 + stub;
      beams.push({ x1, x2, y1: y, y2: y, level: b.level, beat: beatIndex, value: valueOf(b.from) });
    });

    const tupletY = () => Math.min(0, ...stems.filter((s) => s.beat === beatIndex).map((s) => s.y2)) - 0.6 * sp;
    if (beat.tuplet) {
      glyphs.push({ kind: 'tuplet', glyph: Glyphs.tupletDigit(beat.tuplet), x: x + beatWidth / 2 - 0.4 * sp, y: tupletY(), beat: beatIndex });
    }
    groupSpans(beat).filter((g) => g.group.tuplet).forEach((g) => {
      glyphs.push({ kind: 'tuplet', glyph: Glyphs.tupletDigit(g.group.tuplet), x: x + (g.start + g.size / 2) * beatWidth - 0.4 * sp, y: tupletY() + (g.depth * 0.4 - 0.4) * sp, beat: beatIndex });
    });
    x += beatWidth;
  });

  if (bar.simile) {
    glyphs.push({ kind: 'simile', glyph: Glyphs.SIMILE, x: lead + inner / 2 - 1.06 * sp, y: yOf(4, sp) });
  }
  glyphs.push(bar.repeatEnd
    ? { kind: 'barline', glyph: Glyphs.REPEAT_RIGHT, x: config.width - 1.47 * sp, y: yOf(0, sp) }
    : { kind: 'barline', glyph: Glyphs.BARLINE, x: config.width - Metrics.barlineThickness * sp, y: yOf(0, sp) });

  const ys = [...glyphs.map((g) => g.y), ...stems.map((s) => s.y2), ...texts.map((t) => t.y), 0, 4 * sp];
  // bar text goes above everything else in the bar, so it never collides with marks or beams
  const highest = Math.min(...ys, ...glyphs.filter((g) => g.kind === 'mark' || g.kind === 'accent').map((g) => g.y - 1.2 * sp));
  if (bar.text) texts.push({ kind: 'barText', text: bar.text, x: lead + 0.3 * sp, y: Math.min(-2 * sp, highest - 0.6 * sp) });
  ys.push(...texts.map((t) => t.y - 1.2 * sp));
  const top = Math.min(...ys) - sp;
  const bottom = Math.max(...ys) + sp;
  return { glyphs, stems, beams, texts, beatBounds, leaves, top, bottom };
}

/** Leger lines a notehead needs: positions outside 0..8 on even half-steps up to its own. */
export function legerLines(staffPosition) {
  const lines = [];
  if (staffPosition < 0) for (let p = -2; p >= staffPosition; p -= 2) lines.push(p);
  if (staffPosition > 8) for (let p = 10; p <= staffPosition; p += 2) lines.push(p);
  return lines;
}
