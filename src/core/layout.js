import { Glyphs, Metrics } from './glyphs.js';
import { NoteValue } from './noteValue.js';
import { Articulation } from './score.js';
import { slotById } from './profile.js';
import { beams as beamsOf, beamLevel } from './beaming.js';
import { leafSpans, groupSpans } from './tree.js';

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

  bar.beats.forEach((beat, beatIndex) => {
    const beatWidth = unit * weights[beatIndex];
    beatBounds.push([x, x + beatWidth]);
    const spans = leafSpans(beat);
    spans.forEach((l, i) => leaves.push({ beat: beatIndex, index: i, path: l.path, x0: x + l.start * beatWidth, x1: x + (l.start + l.size) * beatWidth }));
    if (bar.simile) { x += beatWidth; return; }

    const centreX = (i) => x + (spans[i].start + spans[i].size / 2) * beatWidth;
    const headX = (i) => centreX(i) - headW / 2;
    const stemX = (i) => headX(i) + Metrics.stemUpSE.x * sp - (Metrics.stemThickness * sp) / 2;
    const valueOf = (i) => spans[i].parent.division;
    const topOf = (i) => Math.min(...spans[i].leaf.notes.map((n) => yOf(slotById(staff, n.slotId).staffPosition, sp)));

    const beatBeams = beamsOf(beat);
    const hosts = beatBeams.filter((b) => b.level === 1);
    const hostOf = (i) => hosts.find((h) => i >= h.from && i <= h.to);
    const beamY = new Map();
    hosts.forEach((h) => {
      let top = Infinity;
      for (let i = h.from; i <= h.to; i++) if (spans[i].leaf.notes.length) top = Math.min(top, topOf(i));
      beamY.set(h, top - Metrics.stemLength * sp);
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
      notes.forEach((n) => {
        const slot = slotById(staff, n.slotId);
        const y = yOf(slot.staffPosition, sp);
        topY = Math.min(topY, y);
        bottomY = Math.max(bottomY, y);
        glyphs.push({ ...base, kind: 'note', glyph: Glyphs.notehead(slot.notehead, value), x: headX(i), y, slotId: slot.id, staffPosition: slot.staffPosition });
        if (n.articulations.includes(Articulation.GHOST)) {
          glyphs.push({ ...base, kind: 'paren', glyph: Glyphs.PAREN_LEFT, x: headX(i) - 0.5 * sp, y, slotRef: slot.id });
          glyphs.push({ ...base, kind: 'paren', glyph: Glyphs.PAREN_RIGHT, x: headX(i) + headW + 0.1 * sp, y, slotRef: slot.id });
        }
      });
      const host = hostOf(i);
      const beamed = host && host.from !== host.to;
      const stemTop = beamed ? beamY.get(host) : topY - Metrics.stemLength * sp;
      if (value !== NoteValue.WHOLE) {
        stems.push({ x: stemX(i), y1: bottomY - Metrics.stemUpSE.y * sp, y2: stemTop, beat: beatIndex, cell: i, value });
      }
      if (!beamed && beamLevel(value) > 0) {
        glyphs.push({ ...base, kind: 'flag', glyph: Glyphs.flag(value), x: stemX(i) - (Metrics.stemThickness * sp) / 2, y: stemTop });
      }
      if (notes.some((n) => n.articulations.includes(Articulation.ACCENT))) {
        glyphs.push({ ...base, kind: 'accent', glyph: Glyphs.ACCENT, x: centreX(i) - 0.68 * sp, y: stemTop - 0.5 * sp });
      }
      const sticking = notes.map((n) => n.sticking).find((s) => s);
      if (sticking) texts.push({ kind: 'sticking', text: sticking, x: centreX(i), y: yOf(-6, sp), beat: beatIndex, cell: i });
    });

    const stemHalf = (Metrics.stemThickness * sp) / 2;
    const stub = 1.1 * sp;
    beatBeams.forEach((b) => {
      const host = b.level === 1 ? b : hostOf(b.from);
      const y = beamY.get(host) + (b.level - 1) * (Metrics.beamThickness + Metrics.beamSpacing) * sp;
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
